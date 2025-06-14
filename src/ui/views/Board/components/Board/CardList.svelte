<script lang="ts">
  // import { Checkbox, InternalLink} from "obsidian-svelte";
  import { Checkbox } from "obsidian-svelte";
  import InternalLink from "src/ui/components/InternalLink.svelte";

  import {
    isString,
    type DataField,
    type DataRecord,
  } from "src/lib/dataframe/dataframe";
  import { app } from "src/lib/stores/obsidian";
  import { settings } from "src/lib/stores/settings";
  import CardMetadata from "src/ui/components/CardMetadata/CardMetadata.svelte";
  import ColorItem from "src/ui/components/ColorItem/ColorItem.svelte";
  import {
    getRecordColorContext,
    handleHoverLink,
    sortRecordsContext,
    menuOnContextMenu,
  } from "src/ui/views/helpers";
  import { Menu } from "obsidian";

  import {
    SHADOW_ITEM_MARKER_PROPERTY_NAME,
    TRIGGERS,
    dndzone,
  } from "svelte-dnd-action";
  import { flip } from "svelte/animate";
  import { getDisplayName } from "./boardHelpers";
  import type {
    DropTrigger,
    OnRecordClick,
    OnRecordCheck,
    OnRecordSetDone,
    OnRecordDrop,
  } from "./types";

  export let items: DataRecord[];
  export let onRecordClick: OnRecordClick;
  export let onRecordCheck: OnRecordCheck;
  export let onRecordSetDone: OnRecordSetDone;
  export let onDrop: OnRecordDrop;
  export let includeFields: DataField[];
  export let checkField: string | undefined;
  export let customHeader: DataField | undefined;
  export let boardEditing: boolean;

  const getRecordColor = getRecordColorContext.get();
  const sortRecords = sortRecordsContext.get();

  const flipDurationMs = 200;

  let dragItem: DataRecord | undefined;
  function handleDndConsider({ detail }: CustomEvent<DndEvent<DataRecord>>) {
    if (detail.info.trigger === TRIGGERS.DRAG_STARTED) {
      dragItem = items.find((item) => item.id === detail.info.id);
    }
    items = sortRecords(detail.items);
  }

  function handleDndFinalize({ detail }: CustomEvent<DndEvent<DataRecord>>) {
    items = sortRecords(detail.items);
    if (detail.info.trigger === TRIGGERS.DROPPED_INTO_ZONE) {
      dragItem = items.find((item) => item.id === detail.info.id);
    }
    if (dragItem) {
      onDrop(dragItem, items, detail.info.trigger as DropTrigger);
      dragItem = undefined;
    }
  }

  const isPlaceholder = (item: DataRecord) =>
    !!(item as any)[SHADOW_ITEM_MARKER_PROPERTY_NAME];

  function handleRecordMenu(record: DataRecord) {
    const menu = new Menu();

    menu.addItem((item) => {
      item
        .setTitle("Edit note")
        .setIcon("edit")
        .onClick(() => {
          onRecordClick(record);
        });
    });

    menu.addItem((item) => {
      item
        .setTitle("Set to Done")
        .setIcon("checkmark")
        .onClick(() => {
          onRecordSetDone(record);
        });
    });

    menu.addSeparator();

    menu.addItem((item) => {
      item
        .setTitle("Open in new tab")
        .setIcon("external-link")
        .onClick(() => {
          $app.workspace.openLinkText(record.id, "", true);
        });
    });

    return menu;
  }
</script>

<div
  class="projects--board--card-list"
  on:consider={handleDndConsider}
  on:finalize={handleDndFinalize}
  use:dndzone={{
    type: "card",
    items,
    flipDurationMs,
    dropTargetStyle: {
      outline: "none",
      borderRadius: "5px",
      background: "var(--board-column-drag-accent)",
      transition: "all 150ms ease-in-out",
    },
    dragDisabled: boardEditing,
    morphDisabled: true,
  }}
>
  {#each items as item (item.id)}
    {@const color = getRecordColor(item)}

    <article
      class="projects--board--card"
      class:projects--board--card-placeholder={isPlaceholder(item)}
      on:keypress
      on:click={() => onRecordClick(item)}
      on:contextmenu={(event) => {
        menuOnContextMenu(event, handleRecordMenu(item));
      }}
      animate:flip={{ duration: flipDurationMs }}
    >
      <ColorItem {color}>
        <div slot="header" class="card-header">
          {#if checkField}
            <span class="checkbox-wrapper">
              <Checkbox
                checked={checkField !== undefined
                  ? !!item.values[checkField]
                  : false}
                on:check={({ detail: checked }) => onRecordCheck(item, checked)}
              />
            </span>
          {/if}
          {#if !customHeader}
            <InternalLink
              linkText={item.id}
              sourcePath={item.id}
              resolved
              on:open={({ detail: { linkText, sourcePath, newLeaf } }) => {
                let openEditor =
                  $settings.preferences.linkBehavior == "open-editor";

                if (newLeaf) {
                  openEditor = !openEditor;
                }

                if (openEditor) {
                  onRecordClick(item);
                } else {
                  $app.workspace.openLinkText(linkText, sourcePath, true);
                }
              }}
              on:hover={({ detail: { event, sourcePath } }) => {
                handleHoverLink(event, sourcePath);
              }}
            >
              {@const path = item.values["path"]}
              {getDisplayName(isString(path) ? path : item.id)}
            </InternalLink>
          {:else}
            <CardMetadata fields={[customHeader]} record={item} />
          {/if}
        </div>
        <CardMetadata fields={includeFields} record={item} />
      </ColorItem>
    </article>
  {/each}
</div>

<style>
  div.card-header {
    display: flex;
    gap: 4px;
    align-items: center;
  }

  .checkbox-wrapper {
    display: flex;
    flex-direction: column;
    align-self: start;
    margin-top: 4px;
  }
</style>
