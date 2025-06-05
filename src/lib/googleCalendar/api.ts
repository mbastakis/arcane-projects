import { google } from 'googleapis';
import type { OAuth2Client } from 'google-auth-library';
import type { GoogleCalendarConfig, GoogleCalendarEvent } from './types';
import { GoogleCalendarError, GoogleCalendarErrorType } from './types';

export class GoogleCalendarAPI {
  private oauth2Client: OAuth2Client;
  private calendar: any;
  private onTokenRefresh?: (accessToken: string) => void;

  constructor(private config: GoogleCalendarConfig, onTokenRefresh?: (accessToken: string) => void) {
    // Validate configuration
    this.validateConfig(config);
    
    // Determine redirect URI based on client type and configuration
    const redirectUri = this.getRedirectUri();
    
    this.oauth2Client = new google.auth.OAuth2(
      this.config.clientId,
      this.config.clientSecret,
      redirectUri
    );

    this.calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });
    
    if (onTokenRefresh) {
      this.onTokenRefresh = onTokenRefresh;
    }

    if (this.config.accessToken && this.config.refreshToken) {
      this.oauth2Client.setCredentials({
        access_token: this.config.accessToken,
        refresh_token: this.config.refreshToken,
      });
    }
  }

  /**
   * Executes an API call with automatic token refresh on 401 errors
   */
  private async executeWithRetry<T>(apiCall: () => Promise<T>): Promise<T> {
    try {
      return await apiCall();
    } catch (error: any) {
      // Check if it's a 401 Unauthorized error
      if (this.isAuthenticationError(error)) {
        console.log('Received 401 error, attempting to refresh token...');
        
        // Try to refresh the token
        try {
          const newAccessToken = await this.refreshAccessToken();
          console.log('Token refreshed successfully');
          
          // Notify the callback about the new token
          if (this.onTokenRefresh) {
            this.onTokenRefresh(newAccessToken);
          }
          
          // Retry the original API call
          return await apiCall();
        } catch (refreshError) {
          console.error('Failed to refresh token:', refreshError);
          throw new GoogleCalendarError(
            GoogleCalendarErrorType.TOKEN_REFRESH_FAILED,
            'Authentication failed. Please re-authenticate with Google Calendar.',
            error
          );
        }
      }
      
      // Handle other specific error types
      if (this.isQuotaExceededError(error)) {
        throw new GoogleCalendarError(
          GoogleCalendarErrorType.API_QUOTA_EXCEEDED,
          'Google Calendar API quota exceeded. Please try again later.',
          error
        );
      }
      
      if (this.isNetworkError(error)) {
        throw new GoogleCalendarError(
          GoogleCalendarErrorType.NETWORK_ERROR,
          'Network error occurred. Please check your internet connection.',
          error
        );
      }
      
      // Re-throw as generic Google Calendar error
      throw GoogleCalendarError.fromError(error);
    }
  }

  /**
   * Checks if an error is an authentication error
   */
  private isAuthenticationError(error: any): boolean {
    return error?.code === 401 || 
           error?.status === 401 || 
           error?.response?.status === 401 ||
           (error?.message && error.message.includes('401'));
  }

  /**
   * Checks if an error is a quota exceeded error
   */
  private isQuotaExceededError(error: any): boolean {
    return error?.code === 403 || 
           error?.status === 403 ||
           (error?.message && error.message.toLowerCase().includes('quota'));
  }

  /**
   * Checks if an error is a network error
   */
  private isNetworkError(error: any): boolean {
    return error?.code === 'ENOTFOUND' ||
           error?.code === 'ECONNREFUSED' ||
           error?.code === 'ETIMEDOUT' ||
           (error?.message && error.message.toLowerCase().includes('network'));
  }

  /**
   * Validates the Google Calendar configuration
   */
  private validateConfig(config: GoogleCalendarConfig): void {
    if (!config.clientId?.trim()) {
      throw new GoogleCalendarError(
        GoogleCalendarErrorType.INVALID_CONFIGURATION,
        'Google Calendar Client ID is required'
      );
    }
    
    if (!config.clientSecret?.trim()) {
      throw new GoogleCalendarError(
        GoogleCalendarErrorType.INVALID_CONFIGURATION,
        'Google Calendar Client Secret is required'
      );
    }
  }

  /**
   * Get the appropriate redirect URI based on configuration
   */
  private getRedirectUri(): string {
    // If explicitly configured, use that
    if (this.config.redirectUri && this.config.redirectUri.trim()) {
      return this.config.redirectUri.trim();
    }
    
    // Google has deprecated the OOB flow, so we need to use localhost redirect
    // Even for Desktop applications, we now need to use localhost
    return 'http://localhost:8080/auth/callback';
  }

  /**
   * Gets the OAuth2 authorization URL for user authentication
   */
  getAuthUrl(): string {
    const scopes = ['https://www.googleapis.com/auth/calendar'];
    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent',
    });
  }

  /**
   * Exchanges authorization code for access and refresh tokens
   */
  async getTokens(code: string): Promise<{ accessToken: string; refreshToken: string }> {
    const { tokens } = await this.oauth2Client.getToken(code);
    this.oauth2Client.setCredentials(tokens);
    
    return {
      accessToken: tokens.access_token!,
      refreshToken: tokens.refresh_token!,
    };
  }

  /**
   * Refreshes the access token using the refresh token
   */
  async refreshAccessToken(): Promise<string> {
    const { credentials } = await this.oauth2Client.refreshAccessToken();
    this.oauth2Client.setCredentials(credentials);
    return credentials.access_token!;
  }

  /**
   * Lists all calendars for the authenticated user
   */
  async listCalendars(): Promise<any[]> {
    return this.executeWithRetry(async () => {
      const response = await this.calendar.calendarList.list();
      return response.data.items || [];
    });
  }

  /**
   * Gets events from the specified calendar within a date range
   */
  async getEvents(
    calendarId: string,
    timeMin?: string,
    timeMax?: string,
    maxResults: number = 100
  ): Promise<GoogleCalendarEvent[]> {
    return this.executeWithRetry(async () => {
      const response = await this.calendar.events.list({
        calendarId,
        timeMin,
        timeMax,
        maxResults,
        singleEvents: false, // Get master recurring events with RRULE data
        orderBy: 'updated',  // Changed from 'startTime' since we can't use that with singleEvents: false
      });
      return response.data.items || [];
    });
  }

  /**
   * Gets a specific event by ID
   */
  async getEvent(calendarId: string, eventId: string): Promise<GoogleCalendarEvent> {
    return this.executeWithRetry(async () => {
      const response = await this.calendar.events.get({
        calendarId,
        eventId,
      });
      return response.data;
    });
  }

  /**
   * Creates a new event in the specified calendar
   */
  async createEvent(calendarId: string, event: Partial<GoogleCalendarEvent>): Promise<GoogleCalendarEvent> {
    return this.executeWithRetry(async () => {
      const response = await this.calendar.events.insert({
        calendarId,
        requestBody: event,
      });
      return response.data;
    });
  }

  /**
   * Updates an existing event
   */
  async updateEvent(
    calendarId: string,
    eventId: string,
    event: Partial<GoogleCalendarEvent>
  ): Promise<GoogleCalendarEvent> {
    return this.executeWithRetry(async () => {
      const response = await this.calendar.events.update({
        calendarId,
        eventId,
        requestBody: event,
      });
      return response.data;
    });
  }

  /**
   * Deletes an event from the calendar
   */
  async deleteEvent(calendarId: string, eventId: string): Promise<void> {
    return this.executeWithRetry(async () => {
      await this.calendar.events.delete({
        calendarId,
        eventId,
      });
    });
  }

  /**
   * Watches for changes to a calendar (for real-time sync)
   */
  async watchEvents(calendarId: string, webhookUrl: string, channelId: string): Promise<any> {
    return this.executeWithRetry(async () => {
      const response = await this.calendar.events.watch({
        calendarId,
        requestBody: {
          id: channelId,
          type: 'web_hook',
          address: webhookUrl,
        },
      });
      return response.data;
    });
  }

  /**
   * Stops watching for changes to a calendar
   */
  async stopWatching(channelId: string, resourceId: string): Promise<void> {
    return this.executeWithRetry(async () => {
      await this.calendar.channels.stop({
        requestBody: {
          id: channelId,
          resourceId,
        },
      });
    });
  }
}
