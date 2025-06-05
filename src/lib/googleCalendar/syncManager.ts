import { get } from 'svelte/store';
import { Notice } from 'obsidian';
import { dataFrame } from '../stores/dataframe';
import { googleCalendarConfig, updateSyncStatus } from '../stores/googleCalendar';
import { settings } from '../stores/settings';
import { GoogleCalendarAPI } from '../googleCalendar/api';
import { GoogleCalendarSyncEngine } from '../googleCalendar/syncEngine';
import { DataApi } from '../dataApi';
import type { DataRecord } from '../dataframe/dataframe';
import { isCalendarEvent } from '../googleCalendar/mapping';
import { GoogleCalendarError, GoogleCalendarErrorType } from '../googleCalendar/types';

export class GoogleCalendarSyncManager {
  private syncEngine: GoogleCalendarSyncEngine | null = null;
  private syncInterval: NodeJS.Timeout | null = null;
  
  constructor(private dataApi: DataApi) {
    // Subscribe to config changes
    googleCalendarConfig.subscribe(config => {
      this.handleConfigChange(config);
    });
  }

  private async handleConfigChange(config: any) {
    // Stop any existing sync
    this.stopAutoSync();

    // Validate config before proceeding
    if (!config) {
      console.warn('Google Calendar config is null or undefined');
      this.syncEngine = null;
      return;
    }

    // Create new sync engine if enabled and configured
    if (config.enabled && config.clientId && config.clientSecret) {
      try {
        // Create API with token refresh callback
        const api = new GoogleCalendarAPI(config, (newAccessToken: string) => {
          // Update the stored access token when it's refreshed
          const currentConfig = get(googleCalendarConfig);
          if (currentConfig) {
            googleCalendarConfig.set({
              ...currentConfig,
              accessToken: newAccessToken
            });
            
            // Also update the plugin settings to persist the new token
            const currentSettings = get(settings);
            if (currentSettings?.preferences?.googleCalendar) {
              settings.set({
                ...currentSettings,
                preferences: {
                  ...currentSettings.preferences,
                  googleCalendar: {
                    ...currentSettings.preferences.googleCalendar,
                    accessToken: newAccessToken
                  }
                }
              });
            }
          }
        });
        
        this.syncEngine = new GoogleCalendarSyncEngine(api, this.dataApi, config);
        
        // Start auto sync if enabled
        if (config.autoSync && config.syncInterval) {
          this.startAutoSync(config.syncInterval);
        }
      } catch (error) {
        console.error('Failed to initialize Google Calendar sync engine:', error);
        this.syncEngine = null;
      }
    } else {
      this.syncEngine = null;
    }
  }

  /**
   * Performs a manual sync of all calendar events
   */
  async performSync(): Promise<void> {
    if (!this.syncEngine) {
      throw new GoogleCalendarError(
        GoogleCalendarErrorType.INVALID_CONFIGURATION,
        'Google Calendar sync not configured'
      );
    }

    if (this.syncEngine.getSyncStatus().isActive) {
      throw new GoogleCalendarError(
        GoogleCalendarErrorType.SYNC_IN_PROGRESS,
        'Sync already in progress'
      );
    }

    updateSyncStatus({ isActive: true });

    try {
      const currentDataFrame = get(dataFrame);
      const config = get(googleCalendarConfig);
      
      if (!config.calendarId) {
        throw new GoogleCalendarError(
          GoogleCalendarErrorType.INVALID_CONFIGURATION,
          'Calendar ID not configured'
        );
      }
      
      await this.syncEngine.performSync(config.calendarId, currentDataFrame);
      
      const status = this.syncEngine.getSyncStatus();
      updateSyncStatus(status);
    } catch (error) {
      const calendarError = GoogleCalendarError.fromError(error);
      updateSyncStatus({ 
        isActive: false, 
        lastError: calendarError.message
      });
      throw calendarError;
    }
  }

  /**
   * Syncs a specific record if it's a calendar event
   */
  async syncRecord(record: DataRecord): Promise<void> {
    if (!this.syncEngine || !isCalendarEvent(record)) {
      return;
    }

    try {
      const currentDataFrame = get(dataFrame);
      const config = get(googleCalendarConfig);
      
      if (!config.calendarId) {
        throw new GoogleCalendarError(
          GoogleCalendarErrorType.INVALID_CONFIGURATION,
          'Calendar ID not configured'
        );
      }
      
      // Create a minimal dataframe with just this record
      const singleRecordFrame = {
        records: [record],
        fields: currentDataFrame.fields,
      };
      
      await this.syncEngine.performSync(config.calendarId, singleRecordFrame);
    } catch (error) {
      console.error('Failed to sync record:', error);
      throw GoogleCalendarError.fromError(error);
    }
  }

  /**
   * Handles record updates from the calendar view
   */
  async onRecordUpdate(record: DataRecord): Promise<void> {
    try {
      await this.syncRecord(record);
    } catch (error) {
      console.error('Failed to sync record update:', error);
      const calendarError = GoogleCalendarError.fromError(error);
      new Notice(`Failed to sync calendar event: ${calendarError.message}`);
    }
  }

  /**
   * Handles record deletion from the calendar view
   */
  async onRecordDelete(record: DataRecord): Promise<void> {
    if (!this.syncEngine || !isCalendarEvent(record)) {
      return;
    }

    try {
      await this.syncEngine.deleteGoogleEvent(record);
      new Notice('Calendar event deleted successfully');
    } catch (error) {
      console.error('Failed to delete Google Calendar event:', error);
      const calendarError = GoogleCalendarError.fromError(error);
      new Notice(`Failed to delete calendar event: ${calendarError.message}`);
      throw calendarError;
    }
  }

  /**
   * Starts automatic synchronization
   */
  private startAutoSync(intervalMinutes: number): void {
    // Validate interval
    if (!intervalMinutes || intervalMinutes < 1 || intervalMinutes > 1440) {
      console.warn(`Invalid sync interval: ${intervalMinutes}. Using default 15 minutes.`);
      intervalMinutes = 15;
    }

    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    this.syncInterval = setInterval(async () => {
      try {
        // Only perform auto sync if sync engine is available and no manual sync is in progress
        if (this.syncEngine && !this.syncEngine.getSyncStatus().isActive) {
          await this.performSync();
        }
      } catch (error) {
        console.error('Auto sync failed:', error);
        // Don't show user notifications for auto sync failures to avoid spam
      }
    }, intervalMinutes * 60 * 1000); // Convert minutes to milliseconds
  }

  /**
   * Stops automatic synchronization
   */
  private stopAutoSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  /**
   * Performs a manual sync
   */
  async performManualSync(): Promise<void> {
    const config = get(googleCalendarConfig);
    const df = get(dataFrame);
    
    if (!this.syncEngine || !config.calendarId || !df) {
      const errorMsg = 'Sync not configured properly';
      updateSyncStatus({ lastError: errorMsg });
      new Notice('Google Calendar sync is not configured. Please check your settings.');
      return;
    }

    try {
      updateSyncStatus({ isActive: true });
      new Notice('Starting Google Calendar sync...');
      
      await this.syncEngine.performSync(config.calendarId, df);
      
      updateSyncStatus({ isActive: false, lastSync: new Date() });
      new Notice('Google Calendar sync completed successfully!');
    } catch (error) {
      const calendarError = GoogleCalendarError.fromError(error);
      console.error('Manual sync failed:', error);
      
      updateSyncStatus({ 
        isActive: false, 
        lastError: calendarError.message
      });
      
      // Provide more specific error messages
      let userMessage = 'Google Calendar sync failed';
      if (calendarError.type === GoogleCalendarErrorType.AUTHENTICATION_FAILED ||
          calendarError.type === GoogleCalendarErrorType.TOKEN_REFRESH_FAILED) {
        userMessage += ': Please re-authenticate with Google Calendar';
      } else if (calendarError.type === GoogleCalendarErrorType.API_QUOTA_EXCEEDED) {
        userMessage += ': API quota exceeded, please try again later';
      } else if (calendarError.type === GoogleCalendarErrorType.NETWORK_ERROR) {
        userMessage += ': Network error, please check your internet connection';
      } else {
        userMessage += `: ${calendarError.message}`;
      }
      
      new Notice(userMessage);
    }
  }

  /**
   * Gets the current sync status
   */
  getSyncStatus() {
    return this.syncEngine?.getSyncStatus() || {
      isActive: false,
      lastSync: undefined,
      pendingChanges: 0,
    };
  }

  /**
   * Checks if sync is available (configured and enabled)
   */
  isSyncAvailable(): boolean {
    return !!this.syncEngine;
  }

  /**
   * Cleans up resources
   */
  destroy(): void {
    this.stopAutoSync();
    this.syncEngine = null;
  }
}
