<script lang="ts">
  // import { InternalLink } from "obsidian-svelte";
  import InternalLink from "src/ui/components/InternalLink.svelte";
  import { getDisplayName } from "src/ui/views/Board/components/Board/boardHelpers";
  import Event from "./Event.svelte";
  import { dndzone } from "svelte-dnd-action";
  import { app } from "src/lib/stores/obsidian";
  import type {
    DataRecord,
    DataValue,
    Optional,
  } from "src/lib/dataframe/dataframe";
  import type { VirtualEventInstance } from "src/lib/googleCalendar/types";
  import { isCalendarEvent } from "src/lib/googleCalendar/mapping";
  import { getRecordColorContext, handleHoverLink } from "src/ui/views/helpers";
  import { settings } from "src/lib/stores/settings";

  export let records: (DataRecord | VirtualEventInstance)[];
  export let checkField: string | undefined;

  export let onRecordClick: (record: DataRecord | VirtualEventInstance) => void;
  export let onRecordCheck: (record: DataRecord | VirtualEventInstance, checked: boolean) => void;
  export let onRecordChange: (record: DataRecord | VirtualEventInstance) => void;
  export let onRecordDelete: (record: DataRecord | VirtualEventInstance) => void;

  function asOptionalBoolean(value: Optional<DataValue>): Optional<boolean> {
    if (typeof value === "boolean") {
      return value;
    }
    return null;
  }

  const flipDurationMs = 200;

  function handleDndConsider(e: CustomEvent<DndEvent<DataRecord | VirtualEventInstance>>) {
    // Filter out virtual events from DnD operations
    records = e.detail.items.filter(item => !('isVirtual' in item));
  }

  function handleDndFinalize(e: CustomEvent<DndEvent<DataRecord | VirtualEventInstance>>) {
    // Filter out virtual events from DnD operations
    records = e.detail.items.filter(item => !('isVirtual' in item));
    records.forEach(item => {
      if (!('isVirtual' in item)) {
        onRecordChange(item);
      }
    });
  }

  // Helper function to check if an event can be deleted
  function canDeleteEvent(item: DataRecord | VirtualEventInstance): boolean {
    // Virtual events (Google Calendar) can always be deleted
    if ('isVirtual' in item) {
      return true;
    }
    
    // Regular events can be deleted if they are calendar events
    return isCalendarEvent(item);
  }

  // Helper function to get the actual record to display
  function getActualRecord(item: DataRecord | VirtualEventInstance): DataRecord {
    return ('isVirtual' in item) ? item.record : item;
  }

  // Helper function to get the display ID 
  function getRecordId(item: DataRecord | VirtualEventInstance): string {
    return ('isVirtual' in item) ? item.record.id : item.id;
  }

  const getRecordColor = getRecordColorContext.get();
</script>

<div
  use:dndzone={{
    type: "entries",
    items: records,
    flipDurationMs,
    dropTargetStyle: {
      outline: "none",
      borderRadius: "5px",
      background: "hsla(var(--interactive-accent-hsl), 0.3)",
    },
  }}
  on:consider={handleDndConsider}
  on:finalize={handleDndFinalize}
>
  {#each records as record (record.id)}
    {@const actualRecord = getActualRecord(record)}
    {@const recordId = getRecordId(record)}
    {#if getDisplayName(recordId)}
      <Event
        color={getRecordColor(actualRecord)}
        checked={checkField !== undefined
          ? asOptionalBoolean(actualRecord.values[checkField])
          : undefined}
        canDelete={canDeleteEvent(record)}
        on:check={({ detail: checked }) => onRecordCheck(record, checked)}
        on:delete={() => onRecordDelete(record)}
      >
        <InternalLink
          linkText={recordId}
          sourcePath={recordId}
          resolved
          tooltip={getDisplayName(recordId)}
          on:open={({ detail: { linkText, sourcePath, newLeaf } }) => {
            let openEditor =
              $settings.preferences.linkBehavior == "open-editor";

            if (newLeaf) {
              openEditor = !openEditor;
            }

            if (openEditor) {
              onRecordClick(record);
            } else {
              $app.workspace.openLinkText(linkText, sourcePath, true);
            }
          }}
          on:hover={({ detail: { event, sourcePath } }) => {
            handleHoverLink(event, sourcePath);
          }}
        >
          {getDisplayName(recordId)}
          {'isVirtual' in record ? ' (recurring)' : ''}
        </InternalLink>
      </Event>
    {/if}
  {/each}
</div>

<style>
  div {
    display: flex;
    flex-direction: column;
    gap: 2px;
    height: 100%;
    width: 100%;
    overflow-y: auto;
  }
</style>
