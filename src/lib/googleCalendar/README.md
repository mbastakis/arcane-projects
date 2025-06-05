# Google Calendar Integration

This module provides bidirectional synchronization between Obsidian Projects calendar view and Google Calendar.

## Features

- **Bidirectional Sync**: Automatically sync events between Obsidian notes and Google Calendar
- **OAuth2 Authentication**: Secure authentication using Google's OAuth2 flow
- **Automatic Sync**: Configurable periodic sync intervals
- **Manual Sync**: Command and UI controls for manual synchronization
- **Event Mapping**: Intelligent mapping between note frontmatter and calendar events
- **Conflict Resolution**: Handle conflicts when events are modified in both places

## Architecture

### Core Components

1. **GoogleCalendarAPI** (`api.ts`)
   - OAuth2 authentication and token management
   - Google Calendar API wrapper for CRUD operations
   - Error handling and retry logic

2. **Event Mapping** (`mapping.ts`)
   - Convert between Google Calendar events and Obsidian frontmatter
   - Handle date/time formats and metadata
   - Detect calendar events based on frontmatter fields

3. **Sync Engine** (`syncEngine.ts`)
   - Core bidirectional synchronization logic
   - Handle event creation, updates, and deletions
   - Conflict resolution and merge strategies

4. **Sync Manager** (`syncManager.ts`)
   - Manage sync lifecycle and configuration
   - Handle automatic sync intervals
   - Provide user feedback and error handling

5. **UI Components**
   - Settings modal for configuration
   - Sync status and controls in calendar view
   - Authentication flow integration

## Configuration

The integration is configured through the plugin settings:

```typescript
interface GoogleCalendarSettings {
  enabled: boolean;
  clientId: string;
  clientSecret: string;
  accessToken?: string;
  refreshToken?: string;
  calendarId?: string;
  lastSync?: string;
  autoSyncInterval?: number; // minutes
}
```

## Event Detection

Notes are considered calendar events if they contain any of these frontmatter fields:

- `due` - Main date field for the event
- `start-date` - Start date/time for multi-day or timed events
- `end-date` - End date/time for multi-day or timed events
- `due-date` - Alternative date field for all-day events

## Sync Behavior

### From Obsidian to Google Calendar
- Create Google Calendar event when a note with calendar frontmatter is created
- Update Google Calendar event when note frontmatter changes
- Delete Google Calendar event when note is deleted or frontmatter is removed

### From Google Calendar to Obsidian
- Create note when Google Calendar event is created
- Update note frontmatter when Google Calendar event changes
- Handle event deletion (configurable behavior)

## Authentication Setup

### Google Cloud Console Setup

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google Calendar API:
   - Go to "APIs & Services" > "Library"
   - Search for "Google Calendar API"
   - Click on it and press "Enable"
4. Create OAuth 2.0 credentials:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth client ID"
   - **IMPORTANT**: Select "Desktop application" as the application type
   - Give it a name (e.g., "Obsidian Projects")
   - Click "Create"
5. Edit the OAuth client and add authorized redirect URI:
   - Click on the OAuth client you just created
   - In "Authorized redirect URIs", add: `http://localhost:8080/auth/callback`
   - Click "Save"
6. Copy the Client ID and Client Secret

**⚠️ Important Notes:**
- Google has deprecated the OOB (Out-of-Band) flow for security reasons
- Even Desktop applications now require a localhost redirect URI
- Make sure to add `http://localhost:8080/auth/callback` to your authorized redirect URIs

### Plugin Configuration

1. Open Obsidian Settings
2. Go to "Community plugins" > "Projects" > "Settings"
3. Scroll down to "Google Calendar Integration"
4. Enable Google Calendar sync
5. Enter your Client ID and Client Secret from the Google Cloud Console
6. The Redirect URI should be set to `http://localhost:8080/auth/callback` (default)
7. Click "Authenticate with Google Calendar"
8. A browser window will open for authentication
9. After successful authentication, the browser will redirect to localhost and close automatically
10. Select which Google Calendar to sync with

## Usage

### Manual Sync
- Use the "Sync Google Calendar" command
- Click the sync button in the calendar view
- Manual sync through plugin settings

### Automatic Sync
- Enable auto-sync in settings
- Configure sync interval (minimum 5 minutes)
- Sync runs in the background at specified intervals

## Error Handling

The integration includes comprehensive error handling:

- Authentication errors (expired tokens, invalid credentials)
- Network errors (connectivity issues, API limits)
- Data conflicts (simultaneous modifications)
- Validation errors (invalid date formats, missing required fields)

Errors are displayed to users through:
- Obsidian notices for immediate feedback
- Sync status indicators in the UI
- Detailed error logging for debugging

## Development

### Adding New Event Types
1. Extend the `GoogleCalendarEvent` type in `types.ts`
2. Update mapping functions in `mapping.ts`
3. Add handling in sync engine as needed

### Customizing Sync Behavior
- Modify `syncEngine.ts` for different merge strategies
- Update `mapping.ts` for custom field mappings
- Extend error handling in `syncManager.ts`

### Testing
- Use the integration in a test vault
- Monitor console logs for detailed sync information
- Test with different event types and edge cases

## Security Considerations

- OAuth2 tokens are stored in Obsidian's settings
- Tokens are encrypted by Obsidian's storage system
- Use secure client credentials from Google Cloud Console
- Regular token refresh maintains security

## Limitations

- Requires internet connection for sync operations
- Subject to Google Calendar API rate limits
- OAuth2 flow requires external browser
- Limited to one calendar per configuration
