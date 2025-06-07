<script lang="ts">
  import {
    Button,
    ModalButtonGroup,
    ModalContent,
    ModalLayout,
    Select,
    SettingItem,
    Switch,
    TextInput,
  } from "obsidian-svelte";
  import MultiTextInput from "src/ui/components/MultiTextInput/MultiTextInput.svelte";
  import { DataFieldType, type DataField } from "src/lib/dataframe/dataframe";


  export let title: string;
  export let field: DataField;
  export let editable: boolean;
  export let existingFields: DataField[];
  export let onSave: (field: DataField) => void;

  $: fieldNameError = validateFieldName(field.name);

  function validateFieldName(fieldName: string) {
    if (fieldName.trim() === "") {        return "Field name cannot be empty";
    }
    if (existingFields.findIndex((field) => field.name === fieldName) !== -1)        return "Field name already exists";
    return "";
  }

  function handleNameChange(value: CustomEvent<string>) {
    field = {
      ...field,
      name: value.detail,
    };
  }

  function handleTypeChange(value: CustomEvent<string>) {
    field = {
      ...field,
      type: value.detail as DataFieldType,
    };
  }

  function handleOptionsChange(options: string[]) {
    field = {
      ...field,
      typeConfig: {
        ...field.typeConfig,
        options,
      },
    };
  }

  function handleRichTextChange({ detail: richText }: CustomEvent<boolean>) {
    field = {
      ...field,
      typeConfig: {
        ...field.typeConfig,
        richText,
      },
    };
  }

  function handleTimeChange({ detail: time }: CustomEvent<boolean>) {
    field = {
      ...field,
      typeConfig: {
        ...field.typeConfig,
        time,
      },
    };
  }

  $: options = [
    { label: "Text", value: DataFieldType.String },
    { label: "Number", value: DataFieldType.Number },
    { label: "Boolean", value: DataFieldType.Boolean },
    { label: "Date", value: DataFieldType.Date },
    { label: "Unknown", value: DataFieldType.Unknown },
  ];
</script>

<ModalLayout {title}>
  <ModalContent>
    <SettingItem name="Name">
      <TextInput
        readonly={!editable}
        value={field.name}
        error={!!fieldNameError}
        helperText={fieldNameError}
        on:input={handleNameChange}
      />
    </SettingItem>
    <SettingItem
      name="Type"
      description="Type of this field"
    >
      <Select
        disabled
        value={field.type}
        {options}
        on:change={handleTypeChange}
      />
    </SettingItem>
    {#if field.type === DataFieldType.String && !field.repeated && !field.identifier}
      <SettingItem
        name="Options"
        description="Enter a list of options"
        vertical
      >
        <MultiTextInput
          options={field.typeConfig?.options ?? []}
          onChange={handleOptionsChange}
        />
      </SettingItem>
      <SettingItem
        name="Rich text"
        description="Allow rich text in this field"
      >
        <Switch
          checked={field.typeConfig?.richText ?? false}
          on:check={handleRichTextChange}
        />
      </SettingItem>
    {/if}
    {#if field.type === DataFieldType.String && field.repeated && !field.identifier}
      <SettingItem
        name="Rich text"
        description="Allow rich text in this field"
      >
        <Switch
          checked={field.typeConfig?.richText ?? false}
          on:check={handleRichTextChange}
        />
      </SettingItem>
    {/if}
    {#if field.type === DataFieldType.Date && !field.repeated}
      <SettingItem
        name="Include time"
        description="Include time in this date field"
      >
        <Switch
          checked={field.typeConfig?.time ?? false}
          on:check={handleTimeChange}
        />
      </SettingItem>
    {/if}
  </ModalContent>
  <ModalButtonGroup>
    <Button
      variant="primary"
      disabled={!!fieldNameError}
      on:click={() => {
        // uniquify options items and omit empty
        if (field?.typeConfig && field.typeConfig?.options) {
          const options = field.typeConfig.options;
          field = {
            ...field,
            typeConfig: {
              ...field.typeConfig,
              options: [...new Set(options)].filter((v) => v !== ""),
            },
          };
        }

        onSave(field);
      }}>Save</Button
    >
  </ModalButtonGroup>
</ModalLayout>
