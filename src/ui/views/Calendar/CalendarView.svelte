<script lang="ts">
  import dayjs from "dayjs";
  import { Notice } from "obsidian";
  import { Select, Typography } from "obsidian-svelte";
  import { createDataRecord } from "src/lib/dataApi";
  import {
    DataFieldType,
    type DataFrame,
    type DataRecord,
  } from "src/lib/dataframe/dataframe";
  import type { VirtualEventInstance } from "src/lib/googleCalendar/types";
  import { updateRecordValues } from "src/lib/datasources/helpers";
  import { i18n } from "src/lib/stores/i18n";
  import { app } from "src/lib/stores/obsidian";
  import { settings } from "src/lib/stores/settings";
  import type { ViewApi } from "src/lib/viewApi";
  import type { ProjectDefinition } from "src/settings/settings";
  import { Field } from "src/ui/components/Field";
  import {
    ViewContent,
    ViewHeader,
    ViewLayout,
    ViewToolbar,
  } from "src/ui/components/Layout";
  import { CreateNoteModal } from "src/ui/modals/createNoteModal";
  import { EditNoteModal } from "src/ui/modals/editNoteModal";
  import {
    fieldToSelectableValue,
    getRecordColorContext,
  } from "src/ui/views/helpers";
  import { get } from "svelte/store";
  import {
    addInterval,
    chunkDates,
    computeDateInterval,
    generateDates,
    generateTitle,
    getFirstDayOfWeek,
    isCalendarInterval,
    subtractInterval,
  } from "./calendar";
  import { groupRecordsWithRecurrence } from "src/lib/googleCalendar/mapping";
  import Calendar from "./components/Calendar/Calendar.svelte";
  import Day from "./components/Calendar/Day.svelte";
  import Week from "./components/Calendar/Week.svelte";
  import WeekHeader from "./components/Calendar/WeekHeader.svelte";
  import Weekday from "./components/Calendar/Weekday.svelte";
  import Navigation from "./components/Navigation/Navigation.svelte";
  import GoogleCalendarSync from "./components/GoogleCalendarSync.svelte";
  import type { CalendarConfig } from "./types";
  import { GoogleCalendarSyncManager } from "src/lib/googleCalendar/syncManager";
  import { onMount, onDestroy } from "svelte";

  export let project: ProjectDefinition;
  export let frame: DataFrame;
  export let readonly: boolean;
  export let api: ViewApi;
  export let getRecordColor: (record: DataRecord) => string | null;
  export let config: CalendarConfig | undefined;
  export let onConfigChange: (cfg: CalendarConfig) => void;

  // Google Calendar sync manager
  let syncManager: GoogleCalendarSyncManager | null = null;

  function saveConfig(cfg: CalendarConfig) {
    config = cfg;
    onConfigChange(cfg);
  }

  // Initialize Google Calendar sync manager
  onMount(() => {
    syncManager = new GoogleCalendarSyncManager(api.dataApi);
  });

  onDestroy(() => {
    if (syncManager) {
      syncManager.destroy();
    }
  });

  // Hook into record updates to trigger sync
  async function handleRecordUpdate(record: DataRecord) {
    if (syncManager) {
      try {
        await syncManager.onRecordUpdate(record);
      } catch (error) {
        console.error('Failed to sync record update:', error);
      }
    }
  }

  // Hook into record deletion to trigger sync
  async function handleRecordDelete(record: DataRecord, isVirtual: boolean = false) {
    try {
      // Always try to sync the deletion with Google Calendar for calendar events
      if (syncManager) {
        await syncManager.onRecordDelete(record);
      }
      
      // Only delete from local data store if it's not a virtual event
      if (!isVirtual) {
        api.deleteRecord(record.id);
      }
      
    } catch (error) {
      console.error('Failed to delete record:', error);
      new Notice('Failed to delete record. Please try again.');
    }
  }

  $: ({ fields, records } = frame);

  let anchorDate: dayjs.Dayjs = dayjs();

  $: dateFields = fields
    .filter((field) => !field.repeated)
    .filter((field) => field.type === DataFieldType.Date);
  $: dateField =
    dateFields.find((field) => config?.dateField === field.name) ??
    dateFields.find((field) => field.name === "due") ??
    dateFields[0];

  $: booleanFields = fields
    .filter((field) => !field.repeated)
    .filter((field) => field.type === DataFieldType.Boolean);
  $: booleanField = fields.find((field) => config?.checkField === field.name);

  $: interval = config?.interval ?? "week";

  $: firstDayOfWeek = getFirstDayOfWeek(
    $settings.preferences.locale.firstDayOfWeek
  );

  $: dateInterval = computeDateInterval(anchorDate, interval, firstDayOfWeek);

  $: groupedRecords = dateField
    ? groupRecordsWithRecurrence(records, dateField.name, dateInterval[0], dateInterval[1])
    : {};
  $: title = dateInterval ? generateTitle(dateInterval) : "";
  $: dates = dateInterval ? generateDates(dateInterval) : [];

  $: numColumns = Math.min(dates.length, 7);
  $: weeks = chunkDates(dates, numColumns);
  $: weekDays = dates.slice(0, numColumns);

  function handleIntervalChange(interval: string) {
    if (isCalendarInterval(interval)) {
      saveConfig({ ...config, interval });
    }
  }
  function handleDateFieldChange(dateField: string) {
    saveConfig({ ...config, dateField });
  }
  function handleCheckFieldChange(checkField: string) {
    saveConfig({ ...config, checkField });
  }

  function handleRecordChange(date: dayjs.Dayjs, record: DataRecord | VirtualEventInstance) {
    const actualRecord = ('isVirtual' in record) ? record.record : record;
    
    if (dateField) {
      if (dateField.type === DataFieldType.Date) {
        const newDatetime = dayjs(actualRecord.values[dateField.name] as string)
          .set("year", date.year())
          .set("month", date.month())
          .set("date", date.date());
        const updatedRecord = updateRecordValues(actualRecord, {
          [dateField.name]: newDatetime.format(
            dateField.typeConfig?.time ? "YYYY-MM-DDTHH:mm" : "YYYY-MM-DD"
          ),
        });
        api.updateRecord(updatedRecord, fields);
        // Trigger Google Calendar sync
        handleRecordUpdate(updatedRecord);
      }
    }
  }

  function handleRecordCheck(record: DataRecord | VirtualEventInstance, checked: boolean) {
    const actualRecord = ('isVirtual' in record) ? record.record : record;
    
    if (booleanField) {
      const updatedRecord = updateRecordValues(actualRecord, {
        [booleanField.name]: checked,
      });
      api.updateRecord(updatedRecord, fields);
      // Trigger Google Calendar sync
      handleRecordUpdate(updatedRecord);
    }
  }

  function handleRecordClick(entry: DataRecord | VirtualEventInstance) {
    const actualRecord = ('isVirtual' in entry) ? entry.record : entry;
    
    if (actualRecord) {
      new EditNoteModal(
        get(app),
        fields,
        (record) => {
          api.updateRecord(record, fields);
          // Trigger Google Calendar sync
          handleRecordUpdate(record);
        },
        actualRecord
      ).open();
    }
  }

  function handleRecordAdd(date: dayjs.Dayjs) {
    if (!dateField) {
      new Notice("Select a Date field to create calendar events.");
      return;
    }

    if (readonly) {
      new Notice("Can't create calendar events in read-only projects.");
      return;
    }

    // Find the calendar event template if available
    const calendarTemplate = project.templates.find(template => 
      template.includes("Templates/Calendar/Event-Note") || 
      template.includes("Event-Note.md")
    );

    // Use calendar template as the default if available, otherwise use first template
    const defaultTemplate = calendarTemplate || project.templates.at(0) || "";

    new CreateNoteModal($app, { ...project, templates: [defaultTemplate, ...project.templates.filter(t => t !== defaultTemplate)] }, (name, templatePath) => {
      if (dateField) {
        api.addRecord(
          createDataRecord(name, project, {
            [dateField.name]: date.toDate(),
          }),
          fields,
          templatePath
        );
      }
    }).open();
  }

  getRecordColorContext.set(getRecordColor);
</script>

<ViewLayout>
  <ViewHeader>
    <ViewToolbar variant="secondary">
      <Navigation
        slot="left"
        onNext={() => (anchorDate = addInterval(anchorDate, interval))}
        onPrevious={() => (anchorDate = subtractInterval(anchorDate, interval))}
        onToday={() => (anchorDate = dayjs())}
      />
      <Typography slot="middle" variant="h2" nomargin>{title}</Typography>
      <svelte:fragment slot="right">
        <Field name={$i18n.t("views.calendar.fields.date")}>
          <Select
            value={dateField?.name ?? ""}
            options={dateFields.map(fieldToSelectableValue)}
            placeholder={$i18n.t("views.calendar.fields.none") ?? ""}
            on:change={({ detail }) => handleDateFieldChange(detail)}
          />
        </Field>
        <Field name={$i18n.t("views.calendar.fields.check")}>
          <Select
            allowEmpty
            value={booleanField?.name ?? ""}
            options={booleanFields.map(fieldToSelectableValue)}
            placeholder={$i18n.t("views.calendar.fields.none") ?? ""}
            on:change={({ detail }) => handleCheckFieldChange(detail)}
          />
        </Field>
        <Select
          value={config?.interval ?? "week"}
          options={[
            {
              label: $i18n.t("views.calendar.intervals.month", {
                count: 1,
              }),
              value: "month",
            },
            {
              label: $i18n.t("views.calendar.intervals.weekWithCount", {
                count: 2,
              }),
              value: "2weeks",
            },
            {
              label: $i18n.t("views.calendar.intervals.week", {
                count: 1,
              }),
              value: "week",
            },
            {
              label: $i18n.t("views.calendar.intervals.dayWithCount", {
                count: 3,
              }),
              value: "3days",
            },
            {
              label: $i18n.t("views.calendar.intervals.day", {
                count: 1,
              }),
              value: "day",
            },
          ]}
          on:change={({ detail }) => handleIntervalChange(detail)}
        />
      </svelte:fragment>
    </ViewToolbar>
    
    <!-- Google Calendar Sync Status -->
    <GoogleCalendarSync {syncManager} />
  </ViewHeader>
  <ViewContent>
    <Calendar>
      <WeekHeader>
        {#each weekDays as weekDay}
          <Weekday
            width={100 / weekDays.length}
            weekend={weekDay.day() === 0 || weekDay.day() === 6}
          >
            {$i18n.t("views.calendar.weekday", {
              value: weekDay.toDate(),
              formatParams: {
                value: { weekday: "short" },
              },
            })}
          </Weekday>
        {/each}
      </WeekHeader>
      {#each weeks as week}
        <Week height={100 / weeks.length}>
          {#each week as date}
            <Day
              width={100 / week.length}
              {date}
              checkField={booleanField?.name}
              records={groupedRecords[date.format("YYYY-MM-DD")] || []}
              onRecordClick={handleRecordClick}
              onRecordChange={(record) => {
                handleRecordChange(date, record);
              }}
              onRecordCheck={(record, checked) => {
                handleRecordCheck(record, checked);
              }}
              onRecordAdd={() => {
                handleRecordAdd(date);
              }}
              onRecordDelete={(record) => {
                const isVirtual = 'isVirtual' in record;
                const actualRecord = isVirtual ? record.record : record;
                handleRecordDelete(actualRecord, isVirtual);
              }}
            />
          {/each}
        </Week>
      {/each}
    </Calendar>
  </ViewContent>
</ViewLayout>
