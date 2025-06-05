import { Notice } from 'obsidian';
import dayjs from 'dayjs';
import type { DataRecord, DataFrame } from '../dataframe/dataframe';
import type { DataApi } from '../dataApi';
import type { GoogleCalendarAPI } from './api';
import type { 
  GoogleCalendarConfig, 
  GoogleCalendarEvent, 
  SyncStatus,
  CalendarEventMapping,
  SyncConflict 
} from './types';
import { GoogleCalendarError, GoogleCalendarErrorType } from './types';
import {
  mapGoogleEventToFrontmatter,
  mapRecordToGoogleEvent,
  isCalendarEvent,
  shouldSyncToGoogle,
  isRecordModified,
  extractGoogleCalendarMetadata,
  createEventMapping
} from './mapping';

export class GoogleCalendarSyncEngine {
  private syncInProgress = false;
  private eventMappings: Map<string, CalendarEventMapping> = new Map();
  private conflicts: SyncConflict[] = [];

  constructor(
    private api: GoogleCalendarAPI,
    private dataApi: DataApi,
    private config: GoogleCalendarConfig
  ) {}

  /**
   * Gets the current sync status
   */
  getSyncStatus(): SyncStatus {
    return {
      isActive: this.syncInProgress,
      lastSync: this.config.lastSync ? new Date(this.config.lastSync) : undefined,
      pendingChanges: this.conflicts.length,
    };
  }

  /**
   * Performs a full bidirectional sync
   */
  async performSync(
    calendarId: string,
    dataFrame: DataFrame,
    dateRange?: { start: string; end: string }
  ): Promise<{
    obsidianToGoogle: number;
    googleToObsidian: number;
    conflicts: SyncConflict[];
  }> {
    // Validate inputs
    if (!calendarId?.trim()) {
      throw new GoogleCalendarError(
        GoogleCalendarErrorType.INVALID_CONFIGURATION,
        'Calendar ID is required for sync'
      );
    }

    if (!dataFrame || !Array.isArray(dataFrame.records)) {
      throw new GoogleCalendarError(
        GoogleCalendarErrorType.VALIDATION_ERROR,
        'Invalid data frame provided for sync'
      );
    }

    if (this.syncInProgress) {
      throw new GoogleCalendarError(
        GoogleCalendarErrorType.SYNC_IN_PROGRESS,
        'Sync already in progress'
      );
    }

    this.syncInProgress = true;
    
    try {
      new Notice('Starting Google Calendar sync...');
      
      // Clear previous conflicts
      this.conflicts = [];
      
      // Get Google Calendar events
      const timeMin = dateRange?.start || dayjs().subtract(1, 'month').toISOString();
      const timeMax = dateRange?.end || dayjs().add(3, 'months').toISOString();
      
      const googleEvents = await this.api.getEvents(calendarId, timeMin, timeMax);
      
      // Get calendar events from Obsidian
      const calendarRecords = dataFrame.records.filter(isCalendarEvent);
      
      // Sync Obsidian → Google Calendar
      const obsidianToGoogleCount = await this.syncObsidianToGoogle(
        calendarId,
        calendarRecords
      );
      
      // Sync Google Calendar → Obsidian
      const googleToObsidianCount = await this.syncGoogleToObsidian(
        calendarId,
        googleEvents,
        calendarRecords
      );
      
      // Update last sync time
      this.config.lastSync = dayjs().toISOString();
      
      new Notice(
        `Sync completed: ${obsidianToGoogleCount} events to Google, ${googleToObsidianCount} from Google`
      );
      
      return {
        obsidianToGoogle: obsidianToGoogleCount,
        googleToObsidian: googleToObsidianCount,
        conflicts: this.conflicts,
      };
      
    } catch (error) {
      console.error('Sync error:', error);
      const calendarError = GoogleCalendarError.fromError(error);
      new Notice(`Sync failed: ${calendarError.message}`);
      throw calendarError;
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Syncs Obsidian calendar events to Google Calendar
   */
  private async syncObsidianToGoogle(
    calendarId: string,
    records: DataRecord[]
  ): Promise<number> {
    let syncCount = 0;
    
    for (const record of records) {
      if (!shouldSyncToGoogle(record)) {
        continue;
      }
      
      try {
        const metadata = extractGoogleCalendarMetadata(record);
        
        if (metadata.eventId) {
          // Update existing event
          if (isRecordModified(record)) {
            const updatedEvent = mapRecordToGoogleEvent(record);
            await this.api.updateEvent(calendarId, metadata.eventId, updatedEvent);
            
            // Update the record with sync timestamp
            await this.updateRecordSyncMetadata(record, metadata.eventId, calendarId);
            syncCount++;
          }
        } else {
          // Create new event
          const newEvent = mapRecordToGoogleEvent(record);
          const createdEvent = await this.api.createEvent(calendarId, newEvent);
          
          // Update the record with Google event metadata
          await this.updateRecordSyncMetadata(record, createdEvent.id, calendarId);
          
          // Track the mapping
          this.eventMappings.set(
            record.id,
            createEventMapping(record.id, createdEvent.id, calendarId, 'obsidian-to-google')
          );
          
          syncCount++;
        }
      } catch (error) {
        console.error(`Error syncing record ${record.id} to Google:`, error);
        // Continue with other records
      }
    }
    
    return syncCount;
  }

  /**
   * Syncs Google Calendar events to Obsidian
   */
  private async syncGoogleToObsidian(
    calendarId: string,
    googleEvents: GoogleCalendarEvent[],
    existingRecords: DataRecord[]
  ): Promise<number> {
    let syncCount = 0;
    
    // Group Google events by base event ID (for recurring events)
    const eventsByBaseId = new Map<string, GoogleCalendarEvent>();
    googleEvents.forEach(event => {
      const baseId = event.recurringEventId || event.id;
      
      // For recurring events, keep the master event (the one with recurrence rules)
      if (!eventsByBaseId.has(baseId)) {
        eventsByBaseId.set(baseId, event);
      } else {
        const existing = eventsByBaseId.get(baseId)!;
        // Prefer the event with recurrence rules (master event)
        if (event.recurrence && !existing.recurrence) {
          eventsByBaseId.set(baseId, event);
        }
      }
    });
    
    // Create a map of existing records by Google event base ID
    const recordsByEventId = new Map<string, DataRecord>();
    existingRecords.forEach(record => {
      const eventId = record.values['google-event-id'] as string;
      if (eventId) {
        recordsByEventId.set(eventId, record);
      }
    });
    
    // Also create a map by note name to avoid duplicates
    const recordsByNoteName = new Map<string, DataRecord>();
    existingRecords.forEach(record => {
      recordsByNoteName.set(record.id, record);
    });
    
    for (const [baseEventId, googleEvent] of eventsByBaseId) {
      try {
        const existingRecord = recordsByEventId.get(baseEventId);
        
        if (existingRecord) {
          // Update existing note if Google event was modified more recently
          const lastSync = existingRecord.values['google-calendar-last-sync'] as string;
          const googleModified = dayjs(googleEvent.updated);
          const lastSyncTime = lastSync ? dayjs(lastSync) : dayjs(0);
          
          if (googleModified.isAfter(lastSyncTime)) {
            await this.updateNoteFromGoogleEvent(existingRecord, googleEvent, calendarId);
            syncCount++;
          }
        } else {
          // Check if we would create a duplicate file name
          const noteTitle = googleEvent.summary || 'Untitled Event';
          const sanitizedTitle = noteTitle.replace(/[\\/:*?"<>|]/g, '-');
          const eventDate = dayjs(googleEvent.start.dateTime || googleEvent.start.date).format('YYYY-MM-DD');
          const eventIdShort = googleEvent.id.substring(0, 8);
          const noteName = `${sanitizedTitle} - ${eventDate} - ${eventIdShort}.md`;
          
          if (!recordsByNoteName.has(noteName)) {
            // Create new note for Google event
            await this.createNoteFromGoogleEvent(googleEvent, calendarId);
            syncCount++;
          } else {
            console.log(`Skipping duplicate note creation for event ${googleEvent.id}: ${noteName}`);
          }
        }
      } catch (error) {
        console.error(`Error syncing Google event ${googleEvent.id} to Obsidian:`, error);
        // Continue with other events
      }
    }
    
    return syncCount;
  }

  /**
   * Creates a new Obsidian note from a Google Calendar event
   */
  private async createNoteFromGoogleEvent(
    googleEvent: GoogleCalendarEvent,
    calendarId: string
  ): Promise<void> {
    // Validate inputs
    if (!googleEvent?.id) {
      throw new GoogleCalendarError(
        GoogleCalendarErrorType.VALIDATION_ERROR,
        'Invalid Google Calendar event: missing ID'
      );
    }

    if (!calendarId?.trim()) {
      throw new GoogleCalendarError(
        GoogleCalendarErrorType.VALIDATION_ERROR,
        'Calendar ID is required for note creation'
      );
    }

    const frontmatter = mapGoogleEventToFrontmatter(googleEvent);
    frontmatter['google-calendar-id'] = calendarId;
    
    // Generate note title and path with proper sanitization
    const noteTitle = googleEvent.summary?.trim() || 'Untitled Event';
    const sanitizedTitle = noteTitle.replace(/[\\/:*?"<>|]/g, '-'); // Replace invalid file characters
    
    // Ensure title is not empty after sanitization
    const finalTitle = sanitizedTitle || 'Untitled Event';
    
    // For recurring events, don't include date in filename - use base event ID instead
    let noteName: string;
    if (googleEvent.recurrence && googleEvent.recurrence.length > 0) {
      // For recurring events: use title + base event ID (no date)
      const eventIdShort = (googleEvent.recurringEventId || googleEvent.id).substring(0, 8);
      noteName = `${finalTitle} - recurring-${eventIdShort}`;
    } else {
      // For non-recurring events: include date and event ID
      const eventDate = dayjs(googleEvent.start.dateTime || googleEvent.start.date).format('YYYY-MM-DD');
      const eventIdShort = googleEvent.id.substring(0, 8);
      noteName = `${finalTitle} - ${eventDate} - ${eventIdShort}`;
    }
    
    const record = {
      id: `${noteName}.md`,
      values: frontmatter,
    } as DataRecord;
    
    try {
      // Create the note using DataApi with the calendar event template
      const templatePath = 'Templates/Calendar/Event-Note.md';
      await this.dataApi.createNote(record, [], templatePath);
      
      // Track the mapping
      this.eventMappings.set(
        record.id,
        createEventMapping(record.id, googleEvent.id, calendarId, 'google-to-obsidian')
      );
    } catch (error) {
      throw new GoogleCalendarError(
        GoogleCalendarErrorType.UNKNOWN_ERROR,
        `Failed to create note for Google Calendar event: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Updates an existing Obsidian note from a Google Calendar event
   */
  private async updateNoteFromGoogleEvent(
    record: DataRecord,
    googleEvent: GoogleCalendarEvent,
    calendarId: string
  ): Promise<void> {
    const updatedFrontmatter = mapGoogleEventToFrontmatter(googleEvent);
    updatedFrontmatter['google-calendar-id'] = calendarId;
    
    // Merge with existing values to preserve other fields
    const updatedRecord = {
      ...record,
      values: {
        ...record.values,
        ...updatedFrontmatter,
      },
    };
    
    await this.dataApi.updateRecord([], updatedRecord);
  }

  /**
   * Updates a record's Google Calendar sync metadata
   */
  private async updateRecordSyncMetadata(
    record: DataRecord,
    eventId: string,
    calendarId: string
  ): Promise<void> {
    const updatedRecord = {
      ...record,
      values: {
        ...record.values,
        'google-event-id': eventId,
        'google-calendar-id': calendarId,
        'google-calendar-sync': true,
        'google-calendar-last-sync': dayjs().toISOString(),
      },
    };
    
    await this.dataApi.updateRecord([], updatedRecord);
  }

  /**
   * Deletes a Google Calendar event when corresponding note is deleted
   */
  async deleteGoogleEvent(record: DataRecord): Promise<void> {
    const metadata = extractGoogleCalendarMetadata(record);
    
    if (metadata.eventId && metadata.calendarId) {
      try {
        await this.api.deleteEvent(metadata.calendarId, metadata.eventId);
        this.eventMappings.delete(record.id);
      } catch (error) {
        console.error(`Error deleting Google event ${metadata.eventId}:`, error);
        throw error;
      }
    }
  }

  /**
   * Handles conflicts between Obsidian and Google Calendar events
   */
  async resolveConflict(
    conflict: SyncConflict,
    resolution: 'use-obsidian' | 'use-google'
  ): Promise<void> {
    // Implementation for conflict resolution
    // This would update either the note or the Google event based on the resolution
    // For now, this is a placeholder
    console.log(`Resolving conflict for ${conflict.noteId}: ${resolution}`);
  }

  /**
   * Sets up automatic sync at specified intervals
   */
  setupAutoSync(intervalMinutes: number = 15): void {
    if (this.config.autoSync) {
      setInterval(() => {
        if (!this.syncInProgress && this.config.calendarId) {
          // TODO: Get current data frame and perform sync
          // This would need to be integrated with the calendar view
        }
      }, intervalMinutes * 60 * 1000);
    }
  }
}
