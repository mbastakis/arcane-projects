<script lang="ts">
  import { Button, IconButton } from "obsidian-svelte";

  export let onNext: () => void;
  export let onPrevious: () => void;
  export let onToday: () => void;
</script>

<div>
  <IconButton icon="chevron-left" onClick={onPrevious} />
  <Button on:click={onToday}>Today</Button>
  <IconButton icon="chevron-right" onClick={onNext} />
</div>

<style>
  div {
    display: flex;
    gap: 4px;
    align-items: center;
  }
</style>
