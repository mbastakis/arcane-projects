<script lang="ts">
  import { createEventDispatcher } from "svelte";

  /**
   * Specifies the time value in HH:mm format.
   */
  export let value: string | null;

  /**
   * Specifies whether to remove decorations so that it can be embedded in other
   * components.
   */
  export let embed: boolean = false;

  const dispatch = createEventDispatcher<{
    change: string | null;
    input: string | null;
  }>();

  function handleChange(event: Event) {
    if (event.currentTarget instanceof HTMLInputElement) {
      dispatch("change", event.currentTarget.value || null);
    }
  }

  function handleInput(event: Event) {
    if (event.currentTarget instanceof HTMLInputElement) {
      dispatch("input", event.currentTarget.value || null);
    }
  }
</script>

<input
  type="time"
  class:embed
  value={value || ""}
  on:change={handleChange}
  on:input={handleInput}
  style:font-family="inherit"
  style:font-size="inherit"
  style:background="var(--background-primary)"
  style:border="1px solid var(--background-modifier-border)"
  style:border-radius="var(--border-radius)"
  style:color="var(--text-normal)"
  style:padding="4px 8px"
/>

<style>
  input {
    width: 100%;
  }

  input.embed {
    border: none;
    background: transparent;
    padding: 0;
  }

  input:focus {
    outline: none;
    border-color: var(--background-modifier-border-focus);
  }
</style>
