import { produce } from "immer";
import type { DataviewApi, Link } from "obsidian-dataview";
import {
  emptyDataFrame,
  type DataField,
  type DataFrame,
  type DataRecord,
} from "src/lib/dataframe/dataframe";
import type { IFileSystem } from "src/lib/filesystem/filesystem";
import { i18n } from "src/lib/stores/i18n";
import type {
  ProjectDefinition,
  ProjectsPluginPreferences,
} from "src/settings/settings";
import { get } from "svelte/store";
import { DataSource } from "..";
import { parseRecords } from "../helpers";
import { detectSchema } from "./schema";
import { standardizeValues } from "./standardize";

export class UnsupportedCapability extends Error {
  constructor(message: string) {
    super(message);
    this.name = get(i18n).t("errors.missingDataview.title");
  }
}

/**
 * DataviewDataSource returns a collection of notes using Dataview queries.
 */
export class DataviewDataSource extends DataSource {
  constructor(
    readonly fileSystem: IFileSystem,
    project: ProjectDefinition,
    preferences: ProjectsPluginPreferences,
    readonly api: DataviewApi
  ) {
    super(project, preferences);
  }

  async queryOne(): Promise<DataFrame> {
    return this.queryAll();
  }

  async queryAll(): Promise<DataFrame> {
    if (this.project.dataSource.kind !== "dataview") {
      return emptyDataFrame;
    }

    try {
      const query = this.project.dataSource.config.query ?? "";
      
      // Use the modern dv.query API with proper error handling
      const result = await this.api.query(query);

      if (!result?.successful) {
        throw new Error(`Dataview query failed: ${result?.error || 'Unknown error'}`);
      }

      if (result.value.type !== "table") {
        throw new Error(`Expected table result, got ${result.value.type}`);
      }

      const rows = this.parseTableResult(result.value);
      const standardizedRecords = this.standardizeRecords(rows);

      let fields = this.sortFields(
        detectSchema(standardizedRecords),
        result.value.headers
      );

      // Apply field configuration from project settings
      for (const f in this.project.fieldConfig) {
        fields = fields.map<DataField>((field) =>
          field.name !== f
            ? field
            : {
                ...field,
                typeConfig: {
                  ...this.project.fieldConfig?.[f],
                  ...field.typeConfig,
                },
              }
        );
      }

      const records = parseRecords(standardizedRecords, fields);

      return { fields, records };
    } catch (error) {
      throw new Error(`Dataview query execution failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  sortFields(fields: DataField[], headers: string[]): DataField[] {
    return produce(fields, (draft) => {
      draft.sort((a, b) => {
        const aval = headers.indexOf(a.name);
        const bval = headers.indexOf(b.name);

        const distance = aval - bval;

        if (distance !== 0) {
          return distance;
        }

        return a.name.localeCompare(b.name, undefined, { numeric: true });
      });
    });
  }

  includes(path: string): boolean {
    return !this.project.excludedNotes?.includes(path);
  }

  readonly(): boolean {
    return true;
  }

  standardizeRecords(rows: Array<Record<string, any>>): DataRecord[] {
    const records: DataRecord[] = [];

    const columnName = this.api.settings.tableIdColumnName;

    rows
      .map((row) => ({ id: row[columnName] as Link, row }))
      .forEach(({ id, row }) =>
        records.push({ id: id.path, values: standardizeValues(row) })
      );

    return records;
  }

  private parseTableResult(value: any): Array<Record<string, any>> {
    const headers: string[] = value.headers;
    const rows: Array<Record<string, any>> = [];

    value.values.forEach((row: any[]) => {
      const values: Record<string, any> = {};

      headers.forEach((header, index) => {
        const value = row[index];
        values[header] = value;
      });

      rows.push(values);
    });

    return rows;
  }
}
