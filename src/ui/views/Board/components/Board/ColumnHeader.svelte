<script lang="ts">
  import { MarkdownRenderer, Menu } from "obsidian";
  import { app, view } from "src/lib/stores/obsidian";
  import { getContext } from "svelte";
  import { TextInput, IconButton } from "obsidian-svelte";
  import { Flair } from "src/ui/components/Flair";
  import { handleHoverLink } from "src/ui/views/helpers";

  export let value: string;
  export let count: number;
  export let checkedCount: number;
  export let checkField: string | undefined;
  export let collapse: boolean = false;
  export let richText: boolean = false;
  const sourcePath = getContext<string>("sourcePath") ?? "";

  function useMarkdown(node: HTMLElement, value: string) {
    MarkdownRenderer.render($app, value, node, sourcePath, $view);

    return {
      update(newValue: string) {
        node.empty();
        MarkdownRenderer.render($app, newValue, node, sourcePath, $view);
      },
    };
  }

  export let onColumnMenu: () => Menu;
  export let onColumnCollapse: (name: string) => void;

  function handleClick(event: MouseEvent) {
    const targetEl = event.target as HTMLElement;
    const closestAnchor =
      targetEl.tagName === "A" ? targetEl : targetEl.closest("a");

    if (!closestAnchor) {
      return;
    }

    event.stopPropagation();

    if (closestAnchor.hasClass("internal-link")) {
      event.preventDefault();

      const href = closestAnchor.getAttr("href");
      const newLeaf = event.button === 1 || event.ctrlKey || event.metaKey;

      if (href) {
        $app.workspace.openLinkText(href, sourcePath, newLeaf);
      }
    }
  }

  export let onValidate: (value: string) => boolean;
  export let onColumnRename: (value: string) => void;
  export let editing: boolean = false;

  let inputRef: HTMLInputElement;
  $: if (editing && inputRef) {
    inputRef.focus();
    inputRef.select();
  }
  let fallback: string = value;
  function rollback() {
    value = fallback;
  }
  $: error = !onValidate(value);
</script>

<div
  class="projects--board--column--header"
  on:dblclick={() => {
    editing = true;
  }}
>
  {#if editing}
    <div class="title-container">
      <TextInput
        noPadding
        embed
        bind:ref={inputRef}
        bind:value
        on:keydown={(event) => {
          if (event.key === "Enter") {
            editing = false;

            if (fallback == value) {
              return;
            }

            if (!error) {
              fallback = value;

              onColumnRename(value);
            } else {
              rollback();
            }
          }
          if (event.key === "Escape") {
            editing = false;
            rollback();
          }
        }}
        on:blur={() => {
          editing = false;

          if (fallback == value) {
            return;
          }

          if (!error) {
            fallback = value;
            onColumnRename(value);
          } else {
            rollback();
          }
        }}
      />
    </div>
  {:else if richText}
    <div class="title-container">
      <span
        class:collapse
        use:useMarkdown={value}
        on:mouseover={(event) => handleHoverLink(event, "")}
        on:focus
        on:click={handleClick}
        on:keypress
      />
      <IconButton
        icon={collapse ? "chevrons-left-right" : "chevrons-right-left"}
        size="sm"
        onClick={() => onColumnCollapse(value)}
        tooltip={collapse ? "Expand column" : "Collapse column"}
      />
    </div>
  {:else}
    <div class="title-container">
      <span class:collapse>
        {value}
      </span>
      <IconButton
        icon={collapse ? "chevrons-left-right" : "chevrons-right-left"}
        size="sm"
        onClick={() => onColumnCollapse(value)}
        tooltip={collapse ? "Expand column" : "Collapse column"}
      />
    </div>
  {/if}
  <div class="right">
    {#if collapse || checkField}
      <Flair variant="primary">
        {checkField ? `${checkedCount}/${count}` : count}
      </Flair>
    {/if}
    <IconButton
      icon="more-vertical"
      size="sm"
      onClick={(event) => {
        onColumnMenu().showAtMouseEvent(event);
      }}
    />
  </div>
</div>

<style>
  span {
    overflow: hidden;
    text-overflow: ellipsis;
  }

  span :global(p:first-child) {
    margin-top: 0;
  }

  span :global(p:last-child) {
    margin-bottom: 0;
  }

  .projects--board--column--header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .title-container {
    display: flex;
    align-items: center;
    gap: 4px;
    flex: 1;
    min-width: 0;
  }

  .title-container span {
    flex: 1;
    min-width: 0;
  }

  .right {
    display: flex;
    align-items: center;
  }

  .collapse {
    max-height: 24px;
    overflow-y: auto;
  }
</style>
