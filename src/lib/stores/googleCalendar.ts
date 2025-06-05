import { writable } from 'svelte/store';
import type { GoogleCalendarConfig, SyncStatus } from '../googleCalendar/types';

// Default configuration
const defaultConfig: GoogleCalendarConfig = {
  enabled: false,
  clientId: "",
  clientSecret: "",
  calendarId: "",
  syncInterval: 15, // 15 minutes
  autoSync: false,
};

// Configuration store
export const googleCalendarConfig = writable<GoogleCalendarConfig>(defaultConfig);

// Sync status store
export const syncStatus = writable<SyncStatus>({
  isActive: false,
  lastSync: undefined,
  pendingChanges: 0,
});

// Helper functions
export function updateConfig(updates: Partial<GoogleCalendarConfig>) {
  googleCalendarConfig.update(config => ({
    ...config,
    ...updates,
  }));
}

export function updateSyncStatus(updates: Partial<SyncStatus>) {
  syncStatus.update(status => ({
    ...status,
    ...updates,
  }));
}

export function isConfigured(): boolean {
  let configured = false;
  const unsubscribe = googleCalendarConfig.subscribe(config => {
    configured = !!(config.clientId && config.clientSecret && config.calendarId);
  });
  unsubscribe();
  return configured;
}
