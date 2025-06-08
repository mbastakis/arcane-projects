<script lang="ts">
  import {
    Button,
    ModalButtonGroup,
    ModalContent,
    ModalLayout,
    Select,
    SettingItem,
    TextInput,
  } from "obsidian-svelte";
  import { v4 as uuidv4 } from "uuid";

  import { nextUniqueViewName } from "src/lib/helpers";
  import { customViews } from "src/lib/stores/customViews";

  import { settings } from "src/lib/stores/settings";
  import {
    DEFAULT_VIEW,
    type ProjectDefinition,
    type ProjectId,
    type ViewDefinition,
    type ViewType,
  } from "src/settings/settings";

  export let onSave: (projectId: ProjectId, view: ViewDefinition) => void;
  export let project: ProjectDefinition;

  let name: string = "";
  let type: ViewType = "table";

  const options = Object.values($customViews).map((view) => {
    if (
      ["table", "board", "calendar"].includes(view.getViewType()) // Maybe we need a enum of integrated view types here
    ) {
      const viewTypeNames = {
        table: "Table",
        board: "Board", 
        calendar: "Calendar"
      };
      return {
        label: viewTypeNames[view.getViewType()] || view.getViewType(),
        value: view.getViewType(),
      };
    } else {
      return {
        label: view.getDisplayName(),
        value: view.getViewType(),
      };
    }
  });

  $: selectedOption = options.find((option) => option.value === type);

  $: nameError = validateName(name);

  function validateName(name: string) {
    if (project.views.find((view) => view.name === name)) {
      return "A view with this name already exists";
    }
    return "";
  }
</script>

<ModalLayout title="Create view">
  <ModalContent>
    <SettingItem
      name="Type"
      description="Choose which type of view to create"
    >
      <Select
        value={type}
        {options}
        on:change={({ detail: value }) => {
          type = value;
        }}
      />
    </SettingItem>

    <SettingItem
      name="Name"
      description="The name of the view"
    >
      <TextInput
        value={name}
        on:input={({ detail: value }) => (name = value)}
        placeholder="Optional"
        error={!!nameError}
        helperText={nameError}
      />
    </SettingItem>

    <SettingItem
      name="Project"
      description="Select which project this view belongs to"
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
  </ModalContent>
  <ModalButtonGroup>
    <Button
      variant="primary"
      on:click={() => {
        onSave(
          project.id,
          Object.assign({}, DEFAULT_VIEW, {
            id: uuidv4(),
            name:
              name ||
              nextUniqueViewName(project.views, selectedOption?.label ?? type),
            type,
          })
        );
      }}>Create</Button
    >
  </ModalButtonGroup>
</ModalLayout>
