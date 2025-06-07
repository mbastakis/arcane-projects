<script lang="ts">
  import { normalizePath, TFile } from "obsidian";
  import {
    Button,
    ModalButtonGroup,
    ModalContent,
    ModalLayout,
    Select,
    SettingItem,
    TextInput,
  } from "obsidian-svelte";

  import { isValidPath } from "src/lib/obsidian";

  import { app } from "src/lib/stores/obsidian";
  import { settings } from "src/lib/stores/settings";
  import type { ProjectDefinition } from "src/settings/settings";
  import { onMount } from "svelte";

  let inputRef: HTMLInputElement;

  export let name: string;
  export let project: ProjectDefinition;
  export let onSave: (
    name: string,
    templatePath: string,
    project: ProjectDefinition
  ) => void;

  let templatePath = project.templates.at(0) ?? "";

  $: nameError = validateName(name);

  function getNewNotesFolder(project: ProjectDefinition) {
    if (project.newNotesFolder) {
      return project.newNotesFolder;
    }

    if (project.dataSource.kind === "folder") {
      return project.dataSource.config.path;
    }

    return "";
  }

  function validateName(name: string) {
    if (name.trim() === "") {
      return "Name can't be empty.";
    }

    const existingFile = $app.vault.getAbstractFileByPath(
      normalizePath(getNewNotesFolder(project) + "/" + name + ".md")
    );

    if (existingFile instanceof TFile) {
      return "A note with that name already exists.";
    }

    if (!isValidPath(name)) {
      return "Contains illegal characters.";
    }

    if (name.startsWith(".")) {
      return "File name must not start with a dot.";
    }

    return "";
  }

  onMount(() => {
    if (inputRef) inputRef.select();
  });
</script>

<ModalLayout title="Create new note">
  <ModalContent>
    <SettingItem
      name="Name"
      description=""
    >
      <TextInput
        bind:ref={inputRef}
        value={name}
        on:input={({ detail: value }) => (name = value)}
        autoFocus
        error={!!nameError}
        helperText={nameError}
        on:keydown={(ev) => {
          if (ev.key === "Enter" && !nameError) {
            ev.preventDefault();
            onSave(name, templatePath, project);
          }
        }}
      />
    </SettingItem>

    <SettingItem
      name="Project"
      description=""
    >
      <Select
        value={project.id}
        on:change={({ detail: id }) => {
          const res = $settings.projects.find((w) => w.id === id);
          if (res) {
            project = res;
          }
        }}
        options={$settings.projects.map((project) => ({
          label: project.name,
          value: project.id,
        }))}
      />
    </SettingItem>

    {#if project.templates.length}
      <SettingItem
        name="Template"
        description=""
      >
        <Select
          value={templatePath}
          on:change={({ detail: value }) => (templatePath = value)}
          options={project.templates.map((path) => ({
            label: path,
            value: path,
          }))}
          placeholder="None"
          allowEmpty
        />
      </SettingItem>
    {/if}
  </ModalContent>
  <ModalButtonGroup>
    <Button
      variant={"primary"}
      disabled={!!nameError}
      on:click={() => {
        onSave(name, templatePath, project);
      }}
    >
      Create note
    </Button>
  </ModalButtonGroup>
</ModalLayout>
