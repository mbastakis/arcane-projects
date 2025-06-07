<script lang="ts">
  import {
    Button,
    ModalButtonGroup,
    ModalContent,
    ModalLayout,
    Typography,
  } from "obsidian-svelte";



  export let title: string;
  export let message: string;
  export let cta: string;
  export let onConfirm: () => void;
  export let onCancel: () => void;
</script>

<ModalLayout {title}>
  <ModalContent>
    <Typography variant="body">{message}</Typography>
  </ModalContent>
  <ModalButtonGroup>
    <Button
      variant={cta === "Delete"
        ? "destructive"
        : "primary"}
      on:click={() => {
        onConfirm();
      }}>{cta}</Button
    >
    <Button
      on:click={() => {
        onCancel();
      }}
    >
      Cancel
    </Button>
  </ModalButtonGroup>
</ModalLayout>
