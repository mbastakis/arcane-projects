<script lang="ts">
  import {
    Callout,
    IconButton,
    SettingItem,
    Typography,
  } from "obsidian-svelte";

  import { app } from "src/lib/stores/obsidian";
  import { ConfirmDialogModal } from "src/ui/modals/confirmDialog";
  import type { ProjectDefinition, ProjectId } from "src/settings/settings";
  import { normalizePath } from "obsidian";

  const dataSourceDetail = (archive: ProjectDefinition) => {
    switch (archive.dataSource.kind) {
      case "folder":
        return `Folder: "${normalizePath(
          archive.dataSource.config.path
        )}", subfolder: ${archive.dataSource.config.recursive}`;
      case "tag":
        return `Tag: ${
          archive.dataSource.config.tag
        }, hierarchy: ${archive.dataSource.config.hierarchy}`;
      case "dataview":
        return `Dataview query: ${
          archive.dataSource.config.query
        }`;
    }
  };

  const getDescription = (archive: ProjectDefinition) => {
    return [`${archive.views.length} view(s).`, dataSourceDetail(archive)].join(
      " "
    );
  };

  export let archives: ProjectDefinition[];
  export let onRestore: (archiveId: ProjectId) => void;
  export let onDelete: (archiveId: ProjectId) => void;
</script>

{#if !archives.length}
  <Callout title={"Info"} icon="info" variant="info">
    <Typography variant="body">No archived projects yet.</Typography>
  </Callout>
{:else}
  {#each archives as archive}
    <SettingItem name={`${archive.name}`} description={getDescription(archive)}>
      <IconButton
        icon="archive-restore"
        tooltip="Restore this archive"
        onClick={() => onRestore(archive.id)}
      />
      <IconButton
        icon="trash-2"
        tooltip="Delete this archive"
        onClick={() => {
          new ConfirmDialogModal(
            $app,
            "Delete archive",
            `Are you sure you want to delete the archive "${archive?.name ?? ""}"? This action cannot be undone.`,
            "Delete",
            () => {
              onDelete(archive.id);
            }
          ).open();
        }}
      />
    </SettingItem>
  {/each}
{/if}
