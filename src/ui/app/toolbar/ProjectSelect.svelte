<script lang="ts">
  import { produce } from "immer";
  import { Menu, Notice } from "obsidian";
  import { IconButton, Select } from "obsidian-svelte";

  import { app } from "src/lib/stores/obsidian";
  import { settings } from "src/lib/stores/settings";
  import { ConfirmDialogModal } from "src/ui/modals/confirmDialog";
  import { CreateProjectModal } from "src/ui/modals/createProjectModal";
  import type { ProjectDefinition, ProjectId } from "src/settings/settings";
  import { Flair } from "src/ui/components/Flair";

  export let projectId: ProjectId | undefined;
  export let projects: ProjectDefinition[];

  $: project = projects.find((project) => project.id === projectId);

  export let onProjectChange: (projectId: ProjectId) => void;
  export let onProjectAdd: () => void;
</script>

<span>
  <Select
    value={projectId ?? ""}
    options={produce(
      projects.map((project) => ({
        label: project.name,
        value: project.id,
      })),
      (draft) => {
        draft.sort((a, b) =>
          a.label.localeCompare(b.label, undefined, { numeric: true })
        );
      }
    )}
    on:change={({ detail: value }) => onProjectChange(value)}
    placeholder="No projects"
  />

  <IconButton
    icon="more-vertical"
    size="sm"
    disabled={!projects.length}
    tooltip="More options"
    onClick={(event) => {
      const menu = new Menu();

      menu.addItem((item) => {
        item
          .setTitle("Edit project")
          .setIcon("edit")
          .onClick(() => {
            if (project) {
              new CreateProjectModal(
                $app,
                "Edit project",
                "Update",
                settings.updateProject,
                project
              ).open();
            }
          });
      });

      menu.addItem((item) => {
        item
          .setTitle("Duplicate project")
          .setIcon("copy")
          .onClick(() => {
            if (projectId) {
              const id = settings.duplicateProject(projectId);
              onProjectChange(id);
            }
          });
      });

      menu.addItem((item) => {
        item
          .setTitle("Archive project")
          .setIcon("archive")
          .onClick(() => {
            new ConfirmDialogModal(
              $app,
              "Archive project",
              `Are you sure you want to archive "${project?.name ?? ""}"?`,
              "Archive",
              () => {
                if (projectId) {
                  if ($settings.archives.length === 0) {
                    new Notice("You can access archived projects from the settings.", 15000);
                  }
                  settings.archiveProject(projectId);
                }
              }
            ).open();
          });
      });

      menu.addItem((item) => {
        item
          .setTitle("Delete project")
          .setIcon("trash")
          .setWarning(true)
          .onClick(() => {
            new ConfirmDialogModal(
              $app,
              "Delete project",
              `Are you sure you want to delete "${project?.name ?? ""}"? This action cannot be undone.`,
              "Delete",
              () => {
                if (projectId) {
                  settings.deleteProject(projectId);
                }
              }
            ).open();
          });
      });

      menu.showAtMouseEvent(event);
    }}
  />
  <IconButton
    icon="folder-plus"
    size="md"
    tooltip="Create project"
    onClick={() => onProjectAdd()}
  />
  {#if project?.dataSource.kind === "dataview"}
    <Flair variant="primary" tooltip="This project is based on a Dataview query and cannot be edited."
      >Read only</Flair
    >
  {/if}
</span>

<style>
  span {
    display: flex;
    align-items: center;
    gap: 4px;
  }
</style>
