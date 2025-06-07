import { App, Modal } from "obsidian";

import { nextUniqueFieldName } from "src/lib/helpers";

import CreateField from "./components/CreateField.svelte";
import type {
  DataField,
  DataValue,
  Optional,
} from "src/lib/dataframe/dataframe";

export class CreateFieldModal extends Modal {
  component?: CreateField;

  constructor(
    app: App,
    readonly fields: DataField[],
    readonly onCreate: (field: DataField, value: Optional<DataValue>) => void
  ) {
    super(app);
  }

  onOpen() {
    this.component = new CreateField({
      target: this.contentEl,
      props: {
        existingFields: this.fields,
        defaultName: nextUniqueFieldName(
          this.fields,
          "Untitled Field"
        ),
        onCreate: (field: DataField, value: Optional<DataValue>) => {
          this.onCreate(field, value);
          this.close();
        },
      },
    });
  }

  onClose() {
    if (this.component) {
      this.component.$destroy();
    }
  }
}
