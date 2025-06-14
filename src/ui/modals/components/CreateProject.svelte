<script lang="ts">
  import moment from "moment";
  import {
    Button,
    Callout,
    FileAutocomplete,
    ModalButtonGroup,
    ModalContent,
    ModalLayout,
    Select,
    SettingItem,
    Switch,
    TextArea,
    TextInput,
    Typography,
  } from "obsidian-svelte";

  import { FileListInput } from "src/ui/components/FileListInput";
  import { Accordion, AccordionItem } from "src/ui/components/Accordion";
  import { notEmpty } from "src/lib/helpers";
  import { getFoldersInFolder, isValidPath } from "src/lib/obsidian";
  import { capabilities } from "src/lib/stores/capabilities";

  import { app } from "src/lib/stores/obsidian";
  import { settings } from "src/lib/stores/settings";
  import { interpolateTemplate } from "src/lib/templates/interpolate";
  import type { ProjectDefinition } from "src/settings/settings";

  export let title: string;
  export let cta: string;
  export let onSave: (project: ProjectDefinition) => void;
  export let project: ProjectDefinition;

  let originalName = project.name;

  $: projects = $settings.projects;

  $: defaultName = interpolateTemplate(project.defaultName ?? "", {
    date: (format) => moment().format(format || "YYYY-MM-DD"),
    time: (format) => moment().format(format || "HH:mm"),
  });

  $: ({ name } = project);
  $: nameError = validateName(name);

  const dataSourceOptions = [
    { label: "Folder", value: "folder" },
    { label: "Tag", value: "tag" },
  ];

  if ($capabilities.dataview) {
    dataSourceOptions.push({
      label: "Dataview",
      value: "dataview",
    });
  }

  function handleDataSourceChange({ detail: value }: CustomEvent<string>) {
    switch (value) {
      case "folder":
        project = {
          ...project,
          dataSource: {
            kind: "folder",
            config: { path: "", recursive: false },
          },
        };
        break;
      case "tag":
        project = {
          ...project,
          dataSource: { kind: "tag", config: { tag: "", hierarchy: false } },
        };
        break;
      case "dataview":
        project = {
          ...project,
          dataSource: { kind: "dataview", config: { query: "" } },
        };
        break;
    }
  }

  function validateName(name: string) {
    if (name === originalName) {
      return "";
    }

    if (name.trim() === "") {
      return "Name is required";
    }

    if (projects.find((project) => project.name === name)) {
      return "A project with this name already exists";
    }

    return "";
  }
</script>

<ModalLayout {title}>
  <ModalContent>
    <SettingItem
      name="Name"
      description="The name of the project."
    >
      <TextInput
        value={project.name}
        on:input={({ detail: name }) => (project = { ...project, name })}
        autoFocus
        error={!!nameError}
        helperText={nameError}
      />
    </SettingItem>
    <SettingItem
      name="Default view"
      description="The default view for the project."
    >
      <Switch
        checked={project.isDefault ?? false}
        on:check={({ detail: isDefault }) =>
          (project = { ...project, isDefault })}
      />
    </SettingItem>

    <SettingItem
      name="Data source"
      description="The data source for the project."
    >
      <Select
        value={project.dataSource.kind}
        options={dataSourceOptions}
        on:change={handleDataSourceChange}
      />
    </SettingItem>

    {#if project.dataSource.kind === "folder"}
      <SettingItem
        name="Path"
        description="The path to the folder containing the notes for this project."
        vertical
      >
        <FileAutocomplete
          files={getFoldersInFolder($app.vault.getRoot())}
          value={project.dataSource.config.path}
          on:change={({ detail: path }) => {
            if (project.dataSource.kind === "folder") {
              project = {
                ...project,
                dataSource: {
                  kind: project.dataSource.kind,
                  config: { ...project.dataSource.config, path },
                },
              };
            }
          }}
          getLabel={(file) => file.path}
          placeholder={"/"}
          width="100%"
        />
      </SettingItem>

      <SettingItem
        name="Include subfolders"
        description="Include notes from subfolders."
      >
        <Switch
          checked={project.dataSource.config.recursive}
          on:check={({ detail: recursive }) => {
            if (project.dataSource.kind === "folder") {
              project = {
                ...project,
                dataSource: {
                  kind: project.dataSource.kind,
                  config: { ...project.dataSource.config, recursive },
                },
              };
            }
          }}
        />
      </SettingItem>
    {/if}

    {#if project.dataSource.kind === "tag"}
      <SettingItem
        name="Tag"
        description="The tag to include notes from."
        vertical
      >
        <TextInput
          placeholder="#tag"
          value={project.dataSource.config.tag ?? ""}
          on:input={({ detail: tag }) => {
            if (project.dataSource.kind === "tag") {
              project = {
                ...project,
                dataSource: {
                  kind: project.dataSource.kind,
                  config: { ...project.dataSource.config, tag },
                },
              };
            }
          }}
          width="100%"
        />
      </SettingItem>

      <SettingItem
        name="Include tag hierarchy"
        description="Include notes with nested tags."
      >
        <Switch
          checked={project.dataSource.config.hierarchy}
          on:check={({ detail: hierarchy }) => {
            if (project.dataSource.kind === "tag") {
              project = {
                ...project,
                dataSource: {
                  kind: project.dataSource.kind,
                  config: { ...project.dataSource.config, hierarchy },
                },
              };
            }
          }}
        />
      </SettingItem>
    {/if}

    {#if project.dataSource.kind === "dataview"}
      {#if $capabilities.dataview}
        <SettingItem
          name="Query"
          description="The Dataview query to use for this project."
          vertical
        >
          <TextArea
            placeholder={`TABLE status AS "Status" FROM "Work"`}
            value={project.dataSource.config.query ?? ""}
            on:input={({ detail: query }) => {
              if (project.dataSource.kind === "dataview") {
                project = {
                  ...project,
                  dataSource: {
                    kind: project.dataSource.kind,
                    config: { ...project.dataSource.config, query },
                  },
                };
              }
            }}
            rows={6}
            width="100%"
          />
        </SettingItem>
      {:else}
        <Callout
          title="Dataview is not available"
          icon="zap"
          variant="danger"
        >
          <Typography variant="body">
            The Dataview plugin is required to use this data source. Please
            install and enable Dataview to continue.
          </Typography>
        </Callout>
      {/if}
    {/if}

    <Accordion>
      <AccordionItem>
        <div slot="header" class="setting-item-info" style:margin-top="8px">
          <div class="setting-item-name">
            More settings
          </div>
        </div>
        <SettingItem
          name="New notes folder"
          description="The folder where new notes created in this project will be saved."
        >
          <FileAutocomplete
            files={getFoldersInFolder($app.vault.getRoot())}
            value={project.newNotesFolder}
            placeholder={project.dataSource.kind === "folder"
              ? project.dataSource.config.path
              : "/"}
            on:change={({ detail: newNotesFolder }) => {
              project = {
                ...project,
                newNotesFolder,
              };
            }}
            getLabel={(file) => file.path}
          />
        </SettingItem>

        <SettingItem
          name="Default note name"
          description="The default name for new notes created in this project. Use {'{'}date{'}'} for the current date and {'{'}time{'}'} for the current time."
          vertical
        >
          <TextInput
            value={project.defaultName ?? ""}
            on:input={({ detail: defaultName }) =>
              (project = { ...project, defaultName })}
            width="100%"
          />
          <small>
            {defaultName}
          </small>
          {#if !isValidPath(defaultName)}
            <small class="error"
              >File name is not valid</small
            >
          {/if}
        </SettingItem>

        <SettingItem
          name="Templates"
          description="Templates to use when creating new notes in this project."
          vertical
        >
          <FileListInput
            buttonText="Add template"
            paths={project.templates ?? []}
            onPathsChange={(templates) => (project = { ...project, templates })}
          />
        </SettingItem>

        <SettingItem
          name="Exclude"
          description="Folders and files to exclude from this project."
          vertical
        >
          <FileListInput
            buttonText="Add path"
            paths={project.excludedNotes ?? []}
            onPathsChange={(excludedNotes) =>
              (project = { ...project, excludedNotes })}
          />
        </SettingItem>
      </AccordionItem>
    </Accordion>
  </ModalContent>
  <ModalButtonGroup>
    <Button
      variant="primary"
      disabled={!!nameError}
      on:click={() => {
        onSave({
          ...project,
          templates: project.templates?.filter(notEmpty) ?? [],
        });
      }}>{cta}</Button
    >
  </ModalButtonGroup>
</ModalLayout>

<style>
  small {
    font-size: var(--font-ui-smaller);
    color: var(--text-accent);
    font-weight: var(--font-semibold);
  }
  .error {
    color: var(--text-error);
  }
</style>
