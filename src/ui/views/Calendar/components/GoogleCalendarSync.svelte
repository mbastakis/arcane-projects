<script lang="ts">
  import { Button, Icon } from "obsidian-svelte";
  import { googleCalendarConfig, syncStatus } from "src/lib/stores/googleCalendar";
  import type { GoogleCalendarSyncManager } from "src/lib/googleCalendar/syncManager";
  import { onMount } from "svelte";

  export let syncManager: GoogleCalendarSyncManager | null = null;

  $: isSyncAvailable = syncManager?.isSyncAvailable() ?? false;
  $: isConfigured = $googleCalendarConfig.enabled && 
                    $googleCalendarConfig.clientId && 
                    $googleCalendarConfig.clientSecret && 
                    $googleCalendarConfig.calendarId;

  let syncInProgress = false;
  let lastSyncError: string | null = null;

  async function handleSync() {
    if (!syncManager || syncInProgress) return;
    
    syncInProgress = true;
    lastSyncError = null;
    
    try {
      await syncManager.performSync();
    } catch (error) {
      console.error('Sync failed:', error);
      lastSyncError = error instanceof Error ? error.message : 'Unknown sync error';
    } finally {
      syncInProgress = false;
    }
  }

  function formatLastSync(lastSync?: Date) {
    if (!lastSync) return 'Never';
    
    const now = new Date();
    const diffMs = now.getTime() - lastSync.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  }

  onMount(() => {
    // Update sync status periodically only when component is visible and sync is active
    const interval = setInterval(() => {
      if (syncManager && ($syncStatus.isActive || syncInProgress)) {
        const status = syncManager.getSyncStatus();
        syncStatus.set(status);
      }
    }, 2000); // Reduced frequency to 2 seconds when active

    return () => clearInterval(interval);
  });
</script>

<div class="google-calendar-sync">
  {#if !isConfigured}
    <div class="sync-status not-configured">
      <Icon name="cloud-off" />
      <span>Google Calendar not configured</span>
    </div>
  {:else if !isSyncAvailable}
    <div class="sync-status disabled">
      <Icon name="cloud-off" />
      <span>Google Calendar sync disabled</span>
    </div>
  {:else}
    <div class="sync-controls">
      <div class="sync-status">
        {#if $syncStatus.isActive || syncInProgress}
          <div class="sync-icon spinning">
            <Icon name="refresh-cw" />
          </div>
          <span>Syncing...</span>
        {:else}
          <Icon name="cloud" />
          <span>Last sync: {formatLastSync($syncStatus.lastSync)}</span>
        {/if}
      </div>
      
      <Button 
        variant="primary" 
        disabled={$syncStatus.isActive || syncInProgress}
        on:click={handleSync}
      >
        <Icon name="refresh-cw" />
        Sync
      </Button>
    </div>
    
    {#if $syncStatus.lastError || lastSyncError}
      <div class="sync-error">
        <Icon name="alert-triangle" />
        <span>{lastSyncError || $syncStatus.lastError}</span>
      </div>
    {/if}
    
    {#if $syncStatus.pendingChanges > 0}
      <div class="pending-changes">
        <Icon name="clock" />
        <span>{$syncStatus.pendingChanges} pending changes</span>
      </div>
    {/if}
  {/if}
</div>

<style>
  .google-calendar-sync {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 8px;
    border-radius: 4px;
    background: var(--background-secondary);
    border: 1px solid var(--background-modifier-border);
  }

  .sync-controls {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .sync-status {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.875rem;
    color: var(--text-muted);
  }

  .sync-status.not-configured,
  .sync-status.disabled {
    color: var(--text-muted);
  }

  .sync-error {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.875rem;
    color: var(--text-error);
    padding: 4px;
    background: var(--background-modifier-error);
    border-radius: 3px;
  }

  .pending-changes {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.875rem;
    color: var(--text-warning);
    padding: 4px;
    background: var(--background-modifier-warning);
    border-radius: 3px;
  }

  :global(.spinning) {
    animation: spin 1s linear infinite;
  }

  .sync-icon.spinning {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
</style>
