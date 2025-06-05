<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { Menu } from "obsidian";
  import { Checkbox } from "obsidian-svelte";
  import ColorPill from "./ColorPill.svelte";
  import Ellipsis from "./Ellipsis.svelte";
  import { menuOnContextMenu } from "src/ui/views/helpers";
  import { i18n } from "src/lib/stores/i18n";

  /**
   * Specifies an optional color of the calendar event.
   */
  export let color: string | null = null;

  /**
   * Specifies an optional checkbox.
   *
   * If undefined, no field has been set.
   * If null, field has been set, but note doesn't have the property.
   */
  export let checked: boolean | null | undefined = undefined;

  /**
   * Specifies whether this event can be deleted (for Google Calendar events).
   */
  export let canDelete: boolean = false;

  /**
   * Internal hover state.
   */
  let hover: boolean = false;

  const dispatch = createEventDispatcher();

  function handleContextMenu(event: MouseEvent) {
    if (!canDelete) return;
    
    event.preventDefault();
    event.stopPropagation();
    
    const menu = new Menu().addItem((item) => {
      item
        .setTitle($i18n.t("views.calendar.delete-event") || "Delete event")
        .setIcon("trash")
        .onClick(() => {
          dispatch('delete');
        });
    });
    menuOnContextMenu(event, menu);
  }
</script>

<div 
  on:mouseenter={() => (hover = true)} 
  on:mouseleave={() => (hover = false)}
  on:contextmenu={handleContextMenu}
>
  {#if color}
    <ColorPill {color} />
  {/if}

  {#if checked !== undefined && checked !== null}
    <Checkbox bind:checked on:check />
  {:else if checked === null && hover}
    <Checkbox checked={false} on:check />
  {/if}

  <Ellipsis>
    <slot />
  </Ellipsis>
</div>

<style>
  div {
    display: flex;
    gap: 4px;
    align-items: center;
    padding: 0.2em 0.4em;
    font-size: var(--font-ui-smaller);
    border: 1px solid var(--background-modifier-border);
    background-color: var(--background-primary);
    border-radius: var(--radius-s);
  }

  /* Remove default checkbox margin. */
  div :global(input[type="checkbox"]) {
    margin: 0;
  }
</style>
