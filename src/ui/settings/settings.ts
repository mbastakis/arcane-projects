import { App, Platform, PluginSettingTab, Setting, Notice } from "obsidian";
import Projects from "src/ui/settings/Projects.svelte";
import Archives from "src/ui/settings/Archives.svelte";
import { settings } from "src/lib/stores/settings";
import { get } from "svelte/store";
import type ProjectsPlugin from "src/main";
import type {
  FirstDayOfWeek,
  LinkBehavior,
  ProjectId,
  ProjectsPluginPreferences,
} from "src/settings/settings";
import { GoogleCalendarAuthHandler } from "src/lib/googleCalendar/auth";

/**
 * ProjectsSettingTab builds the plugin settings tab.
 */
export class ProjectsSettingTab extends PluginSettingTab {
  constructor(app: App, readonly plugin: ProjectsPlugin) {
    super(app, plugin);
  }

  // display runs when the user opens the settings tab.
  display(): void {
    let { preferences } = get(settings);
    const authHandler = new GoogleCalendarAuthHandler(this.app);

    const save = (prefs: ProjectsPluginPreferences) => {
      preferences = prefs;
      settings.updatePreferences(prefs);
    };

    const { containerEl } = this;

    containerEl.empty();

    new Setting(containerEl)
      .setName("Project size limit")
      .setDesc("The maximum number of records to show in a project. Larger projects will be paginated.")
      .addText((text) =>
        text
          .setValue(preferences.projectSizeLimit.toString())
          .setPlaceholder("1000")
          .onChange((value) => {
            save({
              ...preferences,
              projectSizeLimit: parseInt(value) || 1000,
            });
          })
      );

    new Setting(containerEl)
      .setName("Link click behavior")
      .setDesc(
        `Hold ${Platform.isMacOS ? "Cmd" : "Ctrl"} while clicking to open in the opposite mode.`
      )
      .addDropdown((dropdown) => {
        dropdown
          .addOptions({
            "open-editor": "Open in editor",
            "open-note": "Open as note",
          })
          .setValue(preferences.linkBehavior)
          .onChange((value) => {
            save({
              ...preferences,
              linkBehavior: value as LinkBehavior,
            });
          });
      });

    new Setting(containerEl)
      .setName("Start of week")
      .addDropdown((dropdown) =>
        dropdown
          .addOption(
            "default",
            "System default"
          )
          .addOption(
            "sunday",
            "Sunday"
          )
          .addOption(
            "monday",
            "Monday"
          )
          .setValue(
            preferences.locale.firstDayOfWeek
              ? preferences.locale.firstDayOfWeek.toString()
              : "default"
          )
          .onChange((value) => {
            save({
              ...preferences,
              locale: {
                firstDayOfWeek: value as FirstDayOfWeek,
              },
            });
          })
      );

    new Setting(containerEl)
      .setName("Front matter")
      .setHeading();

    new Setting(containerEl)
      .setName("Quote strings")
      .addDropdown((dropdown) =>
        dropdown
          .addOption(
            "PLAIN",
            "Plain"
          )
          .addOption(
            "QUOTE_DOUBLE",
            "Quote double"
          )
          .setValue(preferences.frontmatter.quoteStrings)
          .onChange((value) => {
            if (value === "PLAIN" || value === "QUOTE_DOUBLE") {
              save({
                ...preferences,
                frontmatter: {
                  quoteStrings: value,
                },
              });
            }
          })
      );

    // Google Calendar Settings
    new Setting(containerEl)
      .setName("Google Calendar Integration")
      .setHeading();

    new Setting(containerEl)
      .setName("Enable Google Calendar Sync")
      .setDesc("Synchronize calendar events between Obsidian and Google Calendar")
      .addToggle((toggle) =>
        toggle
          .setValue(preferences.googleCalendar.enabled)
          .onChange((value) => {
            save({
              ...preferences,
              googleCalendar: {
                ...preferences.googleCalendar,
                enabled: value,
              },
            });
          })
      );

    if (preferences.googleCalendar.enabled) {
      new Setting(containerEl)
        .setName("Client ID")
        .setDesc("Google Calendar API Client ID from a Desktop/Native application credential (not Web application)")
        .addText((text) =>
          text
            .setValue(preferences.googleCalendar.clientId)
            .setPlaceholder("Enter your Google Calendar Client ID")
            .onChange((value) => {
              save({
                ...preferences,
                googleCalendar: {
                  ...preferences.googleCalendar,
                  clientId: value,
                },
              });
            })
        );

      new Setting(containerEl)
        .setName("Client Secret")
        .setDesc("Google Calendar API Client Secret from a Desktop/Native application credential")
        .addText((text) =>
          text
            .setValue(preferences.googleCalendar.clientSecret)
            .setPlaceholder("Enter your Google Calendar Client Secret")
            .onChange((value) => {
              save({
                ...preferences,
                googleCalendar: {
                  ...preferences.googleCalendar,
                  clientSecret: value,
                },
              });
            })
        );

      new Setting(containerEl)
        .setName("Redirect URI")
        .setDesc(
          "⚠️ IMPORTANT: For Desktop applications, you must add http://localhost:8080/auth/callback to your OAuth client's authorized redirect URIs in Google Cloud Console. This field can be left empty (will use default)."
        )
        .addText((text) =>
          text
            .setValue(preferences.googleCalendar.redirectUri || "")
            .setPlaceholder("http://localhost:8080/auth/callback")
            .onChange((value) => {
              save({
                ...preferences,
                googleCalendar: {
                  ...preferences.googleCalendar,
                  redirectUri: value || "",
                },
              });
            })
        );

      new Setting(containerEl)
        .setName("Auto Sync Interval")
        .setDesc("Automatically sync every X minutes (0 to disable)")
        .addText((text) =>
          text
            .setValue((preferences.googleCalendar.autoSyncInterval || 15).toString())
            .setPlaceholder("15")
            .onChange((value) => {
              save({
                ...preferences,
                googleCalendar: {
                  ...preferences.googleCalendar,
                  autoSyncInterval: parseInt(value) || 0,
                },
              });
            })
        );

      if (preferences.googleCalendar.clientId && preferences.googleCalendar.clientSecret) {
        new Setting(containerEl)
          .setName("Authentication")
          .setDesc(
            preferences.googleCalendar.accessToken
              ? "✅ Authenticated with Google Calendar"
              : "❌ Not authenticated. Click to authenticate."
          )
          .addButton((button) =>
            button
              .setButtonText(
                preferences.googleCalendar.accessToken ? "Re-authenticate" : "Authenticate"
              )
              .onClick(async () => {
                // Validate that we have the required credentials
                if (!preferences.googleCalendar.clientId || !preferences.googleCalendar.clientSecret) {
                  new Notice('Please enter both Client ID and Client Secret first');
                  return;
                }

                const config = {
                  clientId: preferences.googleCalendar.clientId,
                  clientSecret: preferences.googleCalendar.clientSecret,
                  accessToken: preferences.googleCalendar.accessToken,
                  refreshToken: preferences.googleCalendar.refreshToken,
                };

                try {
                  await authHandler.authenticate(config, (tokens) => {
                    save({
                      ...preferences,
                      googleCalendar: {
                        ...preferences.googleCalendar,
                        accessToken: tokens.accessToken,
                        refreshToken: tokens.refreshToken,
                      },
                    });
                    // Refresh the display to show new authentication status
                    this.display();
                  });
                } catch (error) {
                  console.error('Authentication error:', error);
                  new Notice('Authentication failed. Please check your credentials.');
                }
              })
          );

        if (preferences.googleCalendar.accessToken) {
          new Setting(containerEl)
            .setName("Calendar Selection")
            .setDesc("Select which Google Calendar to sync with")
            .addDropdown(async (dropdown) => {
              dropdown.addOption("", "Loading calendars...");
              
              try {
                const config = {
                  clientId: preferences.googleCalendar.clientId,
                  clientSecret: preferences.googleCalendar.clientSecret,
                  accessToken: preferences.googleCalendar.accessToken!,
                  refreshToken: preferences.googleCalendar.refreshToken,
                };
                
                const calendars = await authHandler.loadCalendars(config);
                
                // Clear loading option
                dropdown.selectEl.innerHTML = '';
                dropdown.addOption("", "Select a calendar...");
                
                calendars.forEach(cal => {
                  dropdown.addOption(cal.id, `${cal.name}${cal.primary ? ' (Primary)' : ''}`);
                });
                
                if (preferences.googleCalendar.calendarId) {
                  dropdown.setValue(preferences.googleCalendar.calendarId);
                }
                
                dropdown.onChange((value) => {
                  save({
                    ...preferences,
                    googleCalendar: {
                      ...preferences.googleCalendar,
                      calendarId: value,
                    },
                  });
                });
              } catch (error) {
                console.error('Failed to load calendars:', error);
                dropdown.selectEl.innerHTML = '';
                dropdown.addOption("", "Failed to load calendars");
                new Notice('Failed to load calendars. Please re-authenticate.');
              }
            });
        }
      }
    }

    new Setting(containerEl)
      .setName("Projects")
      .setDesc("Manage your projects")
      .setHeading();

    const projectsManager = new Projects({
      target: containerEl,
      props: {
        save,
        preferences,
        projects: get(settings).projects,
      },
    });

    new Setting(containerEl)
      .setName("Archive")
      .setDesc("Restore archived projects")
      .setHeading();

    const archivesManager = new Archives({
      target: containerEl,
      props: {
        archives: get(settings).archives,
        onRestore: (archiveId: ProjectId) => {
          settings.restoreArchive(archiveId);
          archivesManager.$set({ archives: get(settings).archives });
          projectsManager.$set({ projects: get(settings).projects });
        },
        onDelete: (archiveId: ProjectId) => {
          settings.deleteArchive(archiveId);
          archivesManager.$set({ archives: get(settings).archives });
        },
      },
    });
  }
}
