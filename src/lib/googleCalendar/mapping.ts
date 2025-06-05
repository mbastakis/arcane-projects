import dayjs from 'dayjs';
import type { DataRecord } from '../dataframe/dataframe';
import { isDate } from '../dataframe/dataframe';
import type { GoogleCalendarEvent, GoogleCalendarFrontmatter, CalendarEventMapping, VirtualEventInstance } from './types';
import { isValidDateString } from './types';

/**
 * Safely parses a date string with validation
 */
function safeDateParse(dateStr: string | undefined, fieldName: string): dayjs.Dayjs {
  if (!dateStr) {
    throw new Error(`${fieldName} is required but not provided`);
  }
  
  if (!isValidDateString(dateStr)) {
    throw new Error(`Invalid date format for ${fieldName}: ${dateStr}`);
  }
  
  const parsed = dayjs(dateStr);
  if (!parsed.isValid()) {
    throw new Error(`Invalid date for ${fieldName}: ${dateStr}`);
  }
  
  return parsed;
}

/**
 * Maps a Google Calendar event to an Obsidian note's frontmatter format
 */
export function mapGoogleEventToFrontmatter(event: GoogleCalendarEvent): GoogleCalendarFrontmatter {
  const startDateTime = event.start.dateTime || event.start.date;
  const endDateTime = event.end.dateTime || event.end.date;
  
  // Determine if this is an all-day event
  const isAllDay = !event.start.dateTime;
  
  // Use base event ID for recurring events, regular ID for one-time events
  const baseEventId = event.recurringEventId || event.id;
  
  const frontmatter: GoogleCalendarFrontmatter = {
    'google-event-id': baseEventId,
    'google-calendar-sync': true,
    'google-calendar-last-sync': dayjs().toISOString(),
    tags: ['arcane-default', 'calendar-event'], // Add required tags for calendar view filtering
  };

  if (event.description) {
    frontmatter.description = event.description;
  }

  if (event.location) {
    frontmatter.location = event.location;
  }

  // Always store recurrence information if present (this is the master recurring event)
  if (event.recurrence && event.recurrence.length > 0) {
    frontmatter['google-recurrence'] = event.recurrence;
    frontmatter['google-is-recurring'] = true;
  }
  
  // Store recurring event ID if this is an instance of a recurring event
  if (event.recurringEventId) {
    frontmatter['google-recurring-event-id'] = event.recurringEventId;
    frontmatter['google-is-recurring'] = true;
  }

  if (isAllDay) {
    // For all-day events, use due-date
    frontmatter['due-date'] = safeDateParse(startDateTime, 'start date').format('YYYY-MM-DD');
  } else {
    // For timed events, use start-time and end-time for easier editing
    const startTime = safeDateParse(startDateTime, 'start date');
    const endTime = safeDateParse(endDateTime, 'end date');
    
    frontmatter['start-time'] = startTime.format('HH:mm');
    frontmatter['end-time'] = endTime.format('HH:mm');
    frontmatter['due-date'] = startTime.format('YYYY-MM-DD');
    
    // Also keep ISO format for precise sync
    frontmatter['start-date'] = startTime.toISOString();
    frontmatter['end-date'] = endTime.toISOString();
  }

  return frontmatter;
}

/**
 * Maps an Obsidian DataRecord to a Google Calendar event format
 */
export function mapRecordToGoogleEvent(record: DataRecord): Partial<GoogleCalendarEvent> {
  const values = record.values;
  
  // Extract title from record (could be from title field or note name)
  const summary = values['title'] || values['name'] || 'Untitled Event';
  
  const event: Partial<GoogleCalendarEvent> = {
    summary: summary as string,
  };

  // Add description if available
  if (values['description']) {
    event.description = values['description'] as string;
  }

  // Add location if available
  if (values['location']) {
    event.location = values['location'] as string;
  }

  // Determine event timing
  const startDate = values['start-date'];
  const endDate = values['end-date'];
  const dueDate = values['due-date'] || values['due'];
  const startTime = values['start-time'];
  const endTime = values['end-time'];

  if (startDate && endDate) {
    // Multi-day or timed event using existing ISO format
    const start = safeDateParse(startDate as string, 'start-date');
    const end = safeDateParse(endDate as string, 'end-date');
    
    // Check if times are included
    if (start.hour() !== 0 || start.minute() !== 0 || end.hour() !== 0 || end.minute() !== 0) {
      // Timed event
      event.start = { dateTime: start.toISOString() };
      event.end = { dateTime: end.toISOString() };
    } else {
      // All-day event spanning multiple days
      event.start = { date: start.format('YYYY-MM-DD') };
      event.end = { date: end.add(1, 'day').format('YYYY-MM-DD') }; // Google Calendar uses exclusive end dates
    }
  } else if (dueDate && startTime && endTime) {
    // Event with due-date and separate start-time/end-time fields
    const dueDay = safeDateParse(dueDate as string, 'due-date');
    
    // Parse time strings (HH:mm format) with validation
    const startTimeParts = (startTime as string).split(':');
    const endTimeParts = (endTime as string).split(':');
    
    if (startTimeParts.length !== 2 || endTimeParts.length !== 2) {
      throw new Error('Invalid time format. Expected HH:mm format');
    }
    
    const startHour = parseInt(startTimeParts[0] || '0', 10);
    const startMinute = parseInt(startTimeParts[1] || '0', 10);
    const endHour = parseInt(endTimeParts[0] || '0', 10);
    const endMinute = parseInt(endTimeParts[1] || '0', 10);
    
    if (isNaN(startHour) || isNaN(startMinute) || isNaN(endHour) || isNaN(endMinute) ||
        startHour < 0 || startHour > 23 || startMinute < 0 || startMinute > 59 ||
        endHour < 0 || endHour > 23 || endMinute < 0 || endMinute > 59) {
      throw new Error('Invalid time values in start-time or end-time');
    }
    
    const start = dueDay.hour(startHour).minute(startMinute).second(0);
    const end = dueDay.hour(endHour).minute(endMinute).second(0);
    
    // Timed event
    event.start = { dateTime: start.toISOString() };
    event.end = { dateTime: end.toISOString() };
  } else if (dueDate) {
    // Single-day event
    const due = safeDateParse(dueDate as string, 'due-date');
    
    if (due.hour() !== 0 || due.minute() !== 0) {
      // Timed event (1 hour duration by default)
      event.start = { dateTime: due.toISOString() };
      event.end = { dateTime: due.add(1, 'hour').toISOString() };
    } else {
      // All-day event
      event.start = { date: due.format('YYYY-MM-DD') };
      event.end = { date: due.add(1, 'day').format('YYYY-MM-DD') };
    }
  } else {
    throw new Error('No valid date information found in record');
  }

  return event;
}

/**
 * Determines if a DataRecord represents a calendar event that should be synced
 */
export function isCalendarEvent(record: DataRecord): boolean {
  const values = record.values;
  
  // Check if Google Calendar sync is enabled for this record
  if (values['google-calendar-sync'] === false) {
    return false;
  }

  // Must have either start/end dates or a due date
  const hasStartEnd = values['start-date'] && values['end-date'];
  const hasDue = values['due-date'] || values['due'];
  
  return !!(hasStartEnd || hasDue);
}

/**
 * Determines if a DataRecord should be synced to Google Calendar
 */
export function shouldSyncToGoogle(record: DataRecord): boolean {
  if (!isCalendarEvent(record)) {
    return false;
  }

  // Check if Google Calendar sync is explicitly enabled
  const syncEnabled = record.values['google-calendar-sync'];
  return syncEnabled === true || syncEnabled === undefined; // Default to enabled if not specified
}

/**
 * Checks if a record has been modified since last sync
 */
export function isRecordModified(record: DataRecord): boolean {
  const lastSync = record.values['google-calendar-last-sync'];
  if (!lastSync) {
    return true; // Never synced before
  }

  // In a real implementation, you'd compare file modification time
  // For now, we'll assume it's modified if there's no Google event ID
  return !record.values['google-event-id'];
}

/**
 * Extracts Google Calendar metadata from a DataRecord
 */
export function extractGoogleCalendarMetadata(record: DataRecord): {
  eventId?: string;
  calendarId?: string;
  lastSync?: string;
  syncEnabled: boolean;
} {
  const values = record.values;
  
  return {
    eventId: values['google-event-id'] as string,
    calendarId: values['google-calendar-id'] as string,
    lastSync: values['google-calendar-last-sync'] as string,
    syncEnabled: values['google-calendar-sync'] !== false,
  };
}

/**
 * Creates a mapping record for tracking sync relationships
 */
export function createEventMapping(
  noteId: string,
  googleEventId: string,
  calendarId: string,
  syncDirection: CalendarEventMapping['syncDirection'] = 'bidirectional'
): CalendarEventMapping {
  return {
    noteId,
    googleEventId,
    calendarId,
    lastSynced: new Date(),
    syncDirection,
  };
}

/**
 * Determines conflict resolution strategy based on modification times
 */
export function resolveConflict(
  record: DataRecord,
  googleEvent: GoogleCalendarEvent,
  recordModified: Date,
  eventModified: Date
): 'use-obsidian' | 'use-google' | 'manual-resolution' {
  // Simple strategy: use the most recently modified version
  if (recordModified > eventModified) {
    return 'use-obsidian';
  } else if (eventModified > recordModified) {
    return 'use-google';
  } else {
    return 'manual-resolution';
  }
}

/**
 * Parses RRULE string and generates occurrence dates
 */
export function parseRecurrenceRule(
  rrule: string,
  startDate: dayjs.Dayjs,
  viewStart: dayjs.Dayjs,
  viewEnd: dayjs.Dayjs
): dayjs.Dayjs[] {
  const occurrences: dayjs.Dayjs[] = [];
  
  // Parse RRULE components
  const parts = rrule.split(';');
  const ruleMap: Record<string, string> = {};
  
  parts.forEach(part => {
    const [key, value] = part.split('=');
    if (key && value) {
      ruleMap[key] = value;
    }
  });
  
  const freq = ruleMap['FREQ'];
  const interval = parseInt(ruleMap['INTERVAL'] || '1');
  const count = ruleMap['COUNT'] ? parseInt(ruleMap['COUNT']) : null;
  const until = ruleMap['UNTIL'] ? dayjs(ruleMap['UNTIL']) : null;
  const byDay = ruleMap['BYDAY']?.split(',') || [];
  const byMonthDay = ruleMap['BYMONTHDAY']?.split(',').map(d => parseInt(d)) || [];
  const byMonth = ruleMap['BYMONTH']?.split(',').map(m => parseInt(m)) || [];
  
  let current = startDate;
  let occurrenceCount = 0;
  const maxOccurrences = count || 365; // Limit to prevent infinite loops (1 year max)
  
  // Always include the original start date if it's in the view range
  if (current.isAfter(viewStart.subtract(1, 'day')) && current.isBefore(viewEnd.add(1, 'day'))) {
    occurrences.push(current);
  }
  occurrenceCount++;
  
  while (occurrenceCount < maxOccurrences && current.isBefore(viewEnd.add(1, 'year'))) {
    // Check termination conditions
    if (until && current.isAfter(until)) {
      break;
    }
    
    if (count && occurrenceCount >= count) {
      break;
    }
    
    // Move to next potential occurrence based on frequency
    switch (freq) {
      case 'DAILY':
        current = current.add(interval, 'day');
        break;
      case 'WEEKLY':
        if (byDay.length > 0) {
          // Handle specific days of the week
          current = getNextWeeklyOccurrence(current, interval, byDay);
        } else {
          current = current.add(interval, 'week');
        }
        break;
      case 'MONTHLY':
        if (byMonthDay.length > 0) {
          // Handle specific days of the month
          current = getNextMonthlyOccurrence(current, interval, byMonthDay);
        } else {
          current = current.add(interval, 'month');
        }
        break;
      case 'YEARLY':
        current = current.add(interval, 'year');
        break;
      default:
        // Unknown frequency, break to prevent infinite loop
        console.warn(`Unknown RRULE frequency: ${freq}`);
        break;
    }
    
    if (!current) break; // Safety check
    
    // Check if this occurrence should be included
    let shouldInclude = true;
    
    // Apply BYMONTH filter
    if (byMonth.length > 0 && !byMonth.includes(current.month() + 1)) {
      shouldInclude = false;
    }
    
    if (shouldInclude && current.isAfter(viewStart.subtract(1, 'day')) && current.isBefore(viewEnd.add(1, 'day'))) {
      occurrences.push(current);
    }
    
    occurrenceCount++;
  }
  
  return occurrences;
}

/**
 * Helper function to get next weekly occurrence with specific days
 */
function getNextWeeklyOccurrence(current: dayjs.Dayjs, interval: number, byDay: string[]): dayjs.Dayjs {
  const dayMap: Record<string, number> = {
    'SU': 0, 'MO': 1, 'TU': 2, 'WE': 3, 'TH': 4, 'FR': 5, 'SA': 6
  };
  
  const targetDays = byDay.map(day => dayMap[day]).filter(d => d !== undefined).sort();
  
  if (targetDays.length === 0) {
    return current.add(interval, 'week');
  }
  
  const currentDay = current.day();
  let nextDay = targetDays.find(day => day > currentDay);
  
  if (nextDay !== undefined) {
    // Next occurrence is later this week
    return current.day(nextDay);
  } else {
    // Next occurrence is next week (or after interval weeks)
    const weeksToAdd = interval;
    const firstTargetDay = targetDays[0];
    if (firstTargetDay !== undefined) {
      return current.add(weeksToAdd, 'week').day(firstTargetDay);
    }
    return current.add(weeksToAdd, 'week');
  }
}

/**
 * Helper function to get next monthly occurrence with specific days
 */
function getNextMonthlyOccurrence(current: dayjs.Dayjs, interval: number, byMonthDay: number[]): dayjs.Dayjs {
  const currentDay = current.date();
  let nextDay = byMonthDay.find(day => day > currentDay);
  
  if (nextDay !== undefined && nextDay <= current.daysInMonth()) {
    // Next occurrence is later this month
    return current.date(nextDay);
  } else {
    // Next occurrence is next month (or after interval months)
    const nextMonth = current.add(interval, 'month');
    const firstDay = byMonthDay[0];
    if (firstDay !== undefined) {
      const validDay = Math.min(firstDay, nextMonth.daysInMonth());
      return nextMonth.date(validDay);
    }
    return nextMonth;
  }
}

/**
 * Creates virtual event instances for recurring events
 */
export function createVirtualEventInstances(
  record: DataRecord,
  viewStart: dayjs.Dayjs,
  viewEnd: dayjs.Dayjs
): VirtualEventInstance[] {
  const values = record.values;
  const recurrence = values['google-recurrence'] as string[];
  const isRecurring = values['google-is-recurring'] as boolean;
  
  if (!isRecurring || !recurrence || recurrence.length === 0) {
    return [];
  }
  
  const eventId = values['google-event-id'] as string || record.id;
  const startDate = values['start-date'] || values['due-date'] || values['due'];
  
  if (!startDate) {
    return [];
  }
  
  const baseDate = dayjs(startDate as string);
  const instances: VirtualEventInstance[] = [];
  
  // Process each recurrence rule
  recurrence.forEach(rrule => {
    if (rrule.startsWith('RRULE:')) {
      const rule = rrule.substring(6); // Remove 'RRULE:' prefix
      const occurrences = parseRecurrenceRule(rule, baseDate, viewStart, viewEnd);
      
      occurrences.forEach(occurrenceDate => {
        // Create virtual instances for ALL occurrences (including the original)
        // The calendar view will handle showing the actual record vs virtual instances
        instances.push({
          id: `${eventId}-${occurrenceDate.format('YYYY-MM-DD')}`,
          baseEventId: eventId,
          record: record,
          instanceDate: occurrenceDate.format('YYYY-MM-DD'),
          isVirtual: true,
        });
      });
    }
  });
  
  return instances;
}

/**
 * Groups records by date, including virtual instances for recurring events
 */
export function groupRecordsWithRecurrence(
  records: DataRecord[],
  field: string,
  viewStart: dayjs.Dayjs,
  viewEnd: dayjs.Dayjs
): Record<string, (DataRecord | VirtualEventInstance)[]> {
  const res: Record<string, (DataRecord | VirtualEventInstance)[]> = {};
  
  records.forEach((record) => {
    const values = record.values;
    const isRecurring = values['google-is-recurring'] as boolean;
    
    if (isRecurring) {
      // For recurring events, only add virtual instances (not the original record on its original date)
      const virtualInstances = createVirtualEventInstances(record, viewStart, viewEnd);
      virtualInstances.forEach(instance => {
        const dateStr = instance.instanceDate;
        if (!(dateStr in res)) {
          res[dateStr] = [];
        }
        res[dateStr]?.push(instance);
      });
    } else {
      // For non-recurring events, handle normally
      const dateValue = record.values[field];
      if (dateValue && isDate(dateValue)) {
        const start = dayjs(dateValue);
        if (start.isValid()) {
          const dateStr = start.format("YYYY-MM-DD");
          if (!(dateStr in res)) {
            res[dateStr] = [];
          }
          res[dateStr]?.push(record);
        }
      }
    }
  });
  
  return res;
}
