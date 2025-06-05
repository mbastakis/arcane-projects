export interface GoogleCalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  status?: string;
  created?: string;
  updated?: string;
  location?: string;
  htmlLink?: string;
  recurrence?: string[];
  recurringEventId?: string;
  originalStartTime?: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
}

export interface GoogleCalendarConfig {
  enabled: boolean;
  clientId: string;
  clientSecret: string;
  redirectUri?: string; // Optional: for web apps, defaults to localhost
  accessToken?: string;
  refreshToken?: string;
  calendarId?: string;
  lastSync?: string;
  syncInterval?: number; // minutes
  autoSync?: boolean;
}

export interface SyncStatus {
  isActive: boolean;
  lastSync?: Date | undefined;
  lastError?: string;
  pendingChanges: number;
}

export interface CalendarEventMapping {
  noteId: string;
  googleEventId: string;
  calendarId: string;
  lastSynced: Date;
  syncDirection: 'google-to-obsidian' | 'obsidian-to-google' | 'bidirectional';
}

export interface SyncConflict {
  noteId: string;
  googleEventId: string;
  conflictType: 'datetime' | 'title' | 'description' | 'deleted';
  obsidianValue: any;
  googleValue: any;
  timestamp: Date;
}

// Extended frontmatter fields for Google Calendar sync
export interface GoogleCalendarFrontmatter {
  'google-calendar-id'?: string;
  'google-event-id'?: string;
  'google-calendar-sync'?: boolean;
  'google-calendar-last-sync'?: string;
  'start-date'?: string;
  'end-date'?: string;
  'due-date'?: string;
  'start-time'?: string;  // HH:mm format for easier editing
  'end-time'?: string;    // HH:mm format for easier editing
  description?: string;
  location?: string;
  tags?: string[];
  // Recurrence information
  'google-recurrence'?: string[];
  'google-recurring-event-id'?: string;
  'google-is-recurring'?: boolean;
}

// Virtual event instance for calendar display
export interface VirtualEventInstance {
  id: string; // Unique instance ID (baseEventId + date)
  baseEventId: string; // Original google event ID
  record: any; // DataRecord
  instanceDate: string; // YYYY-MM-DD
  isVirtual: true;
}

// Error types for better error handling
export enum GoogleCalendarErrorType {
  AUTHENTICATION_FAILED = 'AUTHENTICATION_FAILED',
  AUTHORIZATION_REQUIRED = 'AUTHORIZATION_REQUIRED',
  TOKEN_REFRESH_FAILED = 'TOKEN_REFRESH_FAILED',
  API_QUOTA_EXCEEDED = 'API_QUOTA_EXCEEDED',
  NETWORK_ERROR = 'NETWORK_ERROR',
  INVALID_CONFIGURATION = 'INVALID_CONFIGURATION',
  SYNC_IN_PROGRESS = 'SYNC_IN_PROGRESS',
  CALENDAR_NOT_FOUND = 'CALENDAR_NOT_FOUND',
  EVENT_NOT_FOUND = 'EVENT_NOT_FOUND',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

export class GoogleCalendarError extends Error {
  constructor(
    public type: GoogleCalendarErrorType,
    message: string,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'GoogleCalendarError';
  }

  static fromError(error: unknown, type: GoogleCalendarErrorType = GoogleCalendarErrorType.UNKNOWN_ERROR): GoogleCalendarError {
    if (error instanceof GoogleCalendarError) {
      return error;
    }
    
    const message = error instanceof Error ? error.message : String(error);
    const originalError = error instanceof Error ? error : undefined;
    
    return new GoogleCalendarError(type, message, originalError);
  }
}

// Validation utilities
export function validateGoogleCalendarConfig(config: Partial<GoogleCalendarConfig>): string[] {
  const errors: string[] = [];
  
  if (!config.clientId?.trim()) {
    errors.push('Client ID is required');
  }
  
  if (!config.clientSecret?.trim()) {
    errors.push('Client Secret is required');
  }
  
  if (config.enabled && !config.calendarId?.trim()) {
    errors.push('Calendar ID is required when sync is enabled');
  }
  
  if (config.syncInterval && (config.syncInterval < 1 || config.syncInterval > 1440)) {
    errors.push('Sync interval must be between 1 and 1440 minutes');
  }
  
  return errors;
}

export function isValidDateString(dateStr: string): boolean {
  if (!dateStr) return false;
  const date = new Date(dateStr);
  return !isNaN(date.getTime());
}
