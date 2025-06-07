<script lang="ts">
  import { produce } from "immer";
  import {
    Button,
    Callout,
    ModalButtonGroup,
    ModalContent,
    ModalLayout,
    SettingItem,
    Typography,
  } from "obsidian-svelte";

  import { FieldControl } from "src/ui/components/FieldControl";
  import type { DataField, DataRecord } from "src/lib/dataframe/dataframe";

  import { isGoogleCalendarEvent, getGoogleCalendarFieldNames } from "src/lib/googleCalendar/mapping";

  export let fields: DataField[];
  export let record: DataRecord;

  // Filter out Google Calendar fields for non-calendar events
  $: isCalendarEvent = isGoogleCalendarEvent(record);
  $: googleCalendarFieldNames = getGoogleCalendarFieldNames();
  
  $: filteredFields = fields.filter((field) => {
    // Always show the field if it's a calendar event
    if (isCalendarEvent) return true;
    
    // Hide Google Calendar specific fields for non-calendar events
    return !googleCalendarFieldNames.includes(field.name);
  });

  $: editableFields = filteredFields.filter((field) => !field.derived);

  export let onSave: (record: DataRecord) => void;
</script>

<ModalLayout title="Edit note">
  {#if !editableFields.length}
    <Callout
      title="No editable fields"
      icon="info"
      variant="info"
    >
      <Typography variant="body">
        This note has no editable fields.
      </Typography>
    </Callout>
    <ModalContent>
      {#each filteredFields as field (field.name)}
        <SettingItem name={field.name}>
          <FieldControl
            {field}
            value={record.values[field.name]}
            onChange={(value) => {
              record = produce(record, (draft) => {
                // @ts-ignore
                draft.values[field.name] = value;
              });
            }}
            readonly={true}
          />
        </SettingItem>
      {/each}
    </ModalContent>
  {/if}
  <ModalContent>
    {#each editableFields as field (field.name)}
      <SettingItem name={field.name}>
        <FieldControl
          {field}
          value={record.values[field.name]}
          onChange={(value) => {
            record = produce(record, (draft) => {
              // @ts-ignore
              draft.values[field.name] = value;
            });
          }}
        />
      </SettingItem>
    {/each}
  </ModalContent>
  <ModalButtonGroup>
    <Button
      variant="primary"
      on:click={() => {
        onSave(record);
      }}
      >{editableFields.length
        ? "Save"
        : "Confirm"}</Button
    >
  </ModalButtonGroup>
</ModalLayout>
