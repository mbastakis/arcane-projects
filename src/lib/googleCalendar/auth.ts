import { Notice, Modal, App } from 'obsidian';
import { GoogleCalendarAPI } from './api';
import type { GoogleCalendarConfig } from './types';

/**
 * Simple HTTP server to handle OAuth callback
 */
class LocalAuthServer {
  private server: any = null;
  private port = 8080;

  async start(): Promise<string> {
    return new Promise((resolve, reject) => {
      // For Electron/Node.js environment
      const http = require('http');
      const url = require('url');

      this.server = http.createServer((req: any, res: any) => {
        const parsedUrl = url.parse(req.url, true);
        
        if (parsedUrl.pathname === '/auth/callback') {
          const code = parsedUrl.query.code;
          const error = parsedUrl.query.error;

          if (error) {
            res.writeHead(400, { 'Content-Type': 'text/html' });
            res.end(`
              <html>
                <body>
                  <h1>Authentication Error</h1>
                  <p>Error: ${error}</p>
                  <p>You can close this window.</p>
                </body>
              </html>
            `);
            reject(new Error(error));
            return;
          }

          if (code) {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(`
              <html>
                <body>
                  <h1>Authentication Successful!</h1>
                  <p>You can close this window and return to Obsidian.</p>
                  <script>window.close();</script>
                </body>
              </html>
            `);
            resolve(code);
            return;
          }

          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end(`
            <html>
              <body>
                <h1>Authentication Error</h1>
                <p>No authorization code received.</p>
                <p>You can close this window.</p>
              </body>
            </html>
          `);
          reject(new Error('No authorization code received'));
        } else {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('Not Found');
        }
      });

      this.server.listen(this.port, 'localhost', () => {
        console.log(`Auth server listening on http://localhost:${this.port}`);
      });

      this.server.on('error', (err: any) => {
        if (err.code === 'EADDRINUSE') {
          // Try a different port
          this.port = 8081;
          this.server.listen(this.port, 'localhost');
        } else {
          reject(err);
        }
      });
    });
  }

  stop() {
    if (this.server) {
      this.server.close();
      this.server = null;
    }
  }

  getPort() {
    return this.port;
  }
}

interface AuthConfig {
  clientId: string;
  clientSecret: string;
  accessToken?: string | undefined;
  refreshToken?: string | undefined;
}

export class GoogleCalendarAuthModal extends Modal {
  private authUrl: string;
  private onSuccess: (tokens: { accessToken: string; refreshToken: string }) => void;
  private api: GoogleCalendarAPI;
  private authServer: LocalAuthServer;

  constructor(
    app: App,
    config: AuthConfig,
    onSuccess: (tokens: { accessToken: string; refreshToken: string }) => void
  ) {
    super(app);
    this.onSuccess = onSuccess;
    this.authServer = new LocalAuthServer();
    
    // Create a minimal config for the API, only setting values that are defined
    const apiConfig: GoogleCalendarConfig = {
      enabled: true,
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      redirectUri: `http://localhost:${this.authServer.getPort()}/auth/callback`,
      ...(config.accessToken && { accessToken: config.accessToken }),
      ...(config.refreshToken && { refreshToken: config.refreshToken }),
    };
    
    this.api = new GoogleCalendarAPI(apiConfig);
    this.authUrl = this.api.getAuthUrl();
  }

  async onOpen() {
    const { contentEl } = this;
    contentEl.empty();

    contentEl.createEl('h2', { text: 'Google Calendar Authentication' });
    
    contentEl.createEl('p', {
      text: 'To sync with Google Calendar, you need to authenticate with Google.'
    });

    const instructionsEl = contentEl.createDiv();
    instructionsEl.innerHTML = `
      <div style="background: var(--background-secondary); padding: 1em; border-radius: 4px; margin: 1em 0;">
        <h3>Setup Instructions:</h3>
        <ol>
          <li>Make sure you have created a <strong>Desktop application</strong> OAuth client in Google Cloud Console</li>
          <li>Add <strong>http://localhost:8080/auth/callback</strong> to your authorized redirect URIs</li>
          <li>Click the authentication button below</li>
          <li>Complete the authentication in your browser</li>
        </ol>
      </div>
    `;

    const buttonContainer = contentEl.createDiv();
    buttonContainer.style.display = 'flex';
    buttonContainer.style.gap = '0.5em';
    buttonContainer.style.justifyContent = 'center';
    buttonContainer.style.margin = '1em 0';

    const authButton = buttonContainer.createEl('button', { 
      text: 'Start Authentication',
      cls: 'mod-cta'
    });

    const cancelButton = buttonContainer.createEl('button', { text: 'Cancel' });

    authButton.onclick = async () => {
      try {
        authButton.disabled = true;
        authButton.textContent = 'Starting authentication...';

        // Start local server
        const codePromise = this.authServer.start();
        
        // Open browser
        window.open(this.authUrl, '_blank');
        
        authButton.textContent = 'Waiting for authentication...';
        
        // Wait for authorization code
        const code = await codePromise;
        
        authButton.textContent = 'Exchanging tokens...';
        
        // Exchange code for tokens
        const tokens = await this.api.getTokens(code);
        
        // Stop server
        this.authServer.stop();
        
        // Success
        new Notice('Google Calendar authentication successful!');
        this.onSuccess(tokens);
        this.close();
        
      } catch (error) {
        console.error('Authentication error:', error);
        this.authServer.stop();
        authButton.disabled = false;
        authButton.textContent = 'Start Authentication';
        
        new Notice(`Authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    };

    cancelButton.onclick = () => {
      this.authServer.stop();
      this.close();
    };
  }

  onClose() {
    this.authServer.stop();
    const { contentEl } = this;
    contentEl.empty();
  }
}

export class GoogleCalendarAuthHandler {
  constructor(private app: App) {}

  async authenticate(
    config: AuthConfig,
    onSuccess: (tokens: { accessToken: string; refreshToken: string }) => void
  ): Promise<void> {
    const modal = new GoogleCalendarAuthModal(this.app, config, onSuccess);
    modal.open();
  }

  async refreshToken(config: AuthConfig): Promise<string> {
    const apiConfig: GoogleCalendarConfig = {
      enabled: true,
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      ...(config.accessToken && { accessToken: config.accessToken }),
      ...(config.refreshToken && { refreshToken: config.refreshToken }),
    };
    
    const api = new GoogleCalendarAPI(apiConfig);
    try {
      return await api.refreshAccessToken();
    } catch (error) {
      console.error('Failed to refresh access token:', error);
      throw error;
    }
  }

  async loadCalendars(config: AuthConfig): Promise<Array<{ id: string; name: string; primary?: boolean }>> {
    const apiConfig: GoogleCalendarConfig = {
      enabled: true,
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      ...(config.accessToken && { accessToken: config.accessToken }),
      ...(config.refreshToken && { refreshToken: config.refreshToken }),
    };
    
    const api = new GoogleCalendarAPI(apiConfig);
    try {
      const calendars = await api.listCalendars();
      return calendars.map(cal => ({
        id: cal.id,
        name: cal.summary || cal.id,
        primary: cal.primary
      }));
    } catch (error) {
      console.error('Failed to load calendars:', error);
      throw error;
    }
  }
}
