import moment from "moment";
import { App, Modal } from "obsidian";

import { nextUniqueFileName } from "src/lib/helpers";
import { interpolateTemplate } from "src/lib/templates/interpolate";

import CreateNote from "./components/CreateNote.svelte";
import type { ProjectDefinition } from "src/settings/settings";

export class CreateNoteModal extends Modal {
  component?: CreateNote;

  constructor(
    app: App,
    readonly project: ProjectDefinition,
    readonly onSave: (
      name: string,
      templatePath: string,
      project: ProjectDefinition
    ) => void
  ) {
    super(app);
  }

  getNewNotesFolder(project: ProjectDefinition) {
    if (project.newNotesFolder) {
      return project.newNotesFolder;
    }

    if (project.dataSource.kind === "folder") {
      return project.dataSource.config.path;
    }

    return "";
  }

  onOpen() {
    this.component = new CreateNote({
      target: this.contentEl,
      props: {
        name: this.project.defaultName
          ? interpolateTemplate(this.project.defaultName, {
              date: (format) => moment().format(format || "YYYY-MM-DD"),
              time: (format) => moment().format(format || "HH:mm"),
            })
          : nextUniqueFileName(
              this.getNewNotesFolder(this.project),
              "Untitled"
            ),
        project: this.project,
        onSave: (
          name: string,
          templatePath: string,
          project: ProjectDefinition
        ) => {
          this.onSave(name, templatePath, project);
          this.close();
        },
      },
    });
  }

  onClose() {
    if (this.component) {
      this.component.$destroy();
    }
  }
}
