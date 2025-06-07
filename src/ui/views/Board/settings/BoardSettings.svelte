<script lang="ts">
  import { produce } from "immer";
  import {
    ModalContent,
    ModalLayout,
    NumberInput,
    Select,
    SettingItem,
  } from "obsidian-svelte";
  import { DataFieldType, type DataField } from "src/lib/dataframe/dataframe";

  import { fieldToSelectableValue } from "../../helpers";
  import { getFieldsByType } from "../board";
  import type { BoardConfig } from "../types";

  export let config: BoardConfig;
  export let fields: DataField[];
  export let onSave: (config: BoardConfig) => void;

  let columnWidthValue = config.columnWidth ?? null;

  $: headerField = config.headerField ?? "";

  $: orderSyncField = config.orderSyncField ?? "";
  $: validOrderSyncFields = getFieldsByType(fields, DataFieldType.Number);

  const updateConfig = <T extends keyof BoardConfig>(
    key: T,
    value: BoardConfig[T] | null
  ) =>
    onSave(
      produce(config, (draft) => {
        const { [key]: _, ...rest } = draft;
        return value ? { ...rest, [key]: value } : rest;
      })
    );
</script>

<ModalLayout title="Board settings">
  <ModalContent>
    <SettingItem
      name="Column width"
      description="Maximum width of each column"
    >
      <NumberInput
        placeholder="270"
        bind:value={columnWidthValue}
        on:blur={() => updateConfig("columnWidth", columnWidthValue)}
      />
    </SettingItem>
    <SettingItem
      name="Custom header"
      description="Display field instead of column name"
    >
      <Select
        value={headerField ?? ""}
        options={fields.map(fieldToSelectableValue)}
        placeholder="None"
        allowEmpty
        on:change={(event) => {
          headerField = event.detail;
          updateConfig("headerField", headerField);
        }}
      />
    </SettingItem>
    <SettingItem
      name="Order sync field"
      description="Field to sync sorting order"
    >
      <Select
        value={orderSyncField ?? ""}
        options={validOrderSyncFields.map(fieldToSelectableValue)}
        placeholder="None"
        allowEmpty
        on:change={(event) => {
          orderSyncField = event.detail;
          updateConfig("orderSyncField", orderSyncField);
        }}
      />
    </SettingItem>
  </ModalContent>
</ModalLayout>
