<script lang="ts">
  import type { DataField } from "src/lib/dataframe/dataframe";
  import type { SortDefinition } from "src/settings/settings";
  import SortOptions from "./SortOptions.svelte";
  import PopoverButton from "../PopoverButton.svelte";


  export let value: SortDefinition | undefined;
  export let onChange: (value: SortDefinition) => void;

  export let fields: DataField[];
  export let disabled: boolean = false;
</script>

<PopoverButton
  label="Sort"
  icon="sort-desc"
  count={value?.criteria.length ?? 0}
  {disabled}
>
  <SortOptions
    value={value ?? {
      criteria: [],
    }}
    {fields}
    {onChange}
  />
</PopoverButton>
