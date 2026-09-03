import {
  App,
  MarkdownView,
  Notice,
  Platform,
  Plugin,
  TFile,
  moment,
  normalizePath,
  type Editor
} from "obsidian";
import { CurrentFileDeletion } from "./delete-current-file";
import { moveWebsiteLinks, organizeCurrentNote } from "./note-organizer";
import {
  BetterEditorSettingTab,
  DEFAULT_SETTINGS,
  type BetterEditorSettings,
  type SettingsHost
} from "./settings";
import { expandSmartSelection } from "./smart-selection";
import { TabBarController } from "./tab-bar";
import { createTaskMarkerDeletionExtensions } from "./task-marker-deletion";

interface DailyNotesOptions {
  folder?: string;
  format?: string;
}

interface DailyNotesPlugin {
  enabled?: boolean;
  instance?: {
    options?: DailyNotesOptions;
  };
}

interface AppWithInternalPlugins extends App {
  internalPlugins?: {
    getPluginById(id: string): DailyNotesPlugin | undefined;
  };
}

export default class BetterEditorPlugin extends Plugin implements SettingsHost {
  settings: BetterEditorSettings = { ...DEFAULT_SETTINGS };

  private readonly registeredCommandIds = new Set<string>();
  private tabBar!: TabBarController;
  private fileDeletion!: CurrentFileDeletion;

  async onload(): Promise<void> {
    await this.loadSettings();

    this.tabBar = new TabBarController(this.app, () => ({
      enabled: this.settings.tabBarControlsEnabled,
      hidden: this.settings.hideTabBar,
      autoHideSingleTab: this.settings.autoHideSingleTab,
      gradientHeight: this.settings.tabGradientHeight
    }));
    this.fileDeletion = new CurrentFileDeletion(
      this.app,
      () => this.settings.linkedMentionAction
    );

    this.registerEditorExtension(
      createTaskMarkerDeletionExtensions(() => this.settings.taskMarkerDeletionEnabled)
    );
    this.addSettingTab(new BetterEditorSettingTab(this.app, this));

    this.registerEvent(this.app.workspace.on("layout-change", () => this.tabBar.refresh()));
    this.registerEvent(this.app.workspace.on("file-open", (file) => {
      if (!file) return;
      void this.organizeNoteOnOpen(file).catch((error: unknown) => {
        console.error("Better Editor could not organize the opened note.", error);
      });
    }));

    this.syncFeatureState();
  }

  onunload(): void {
    this.tabBar.destroy();
  }

  async updateSettings(changes: Partial<BetterEditorSettings>): Promise<void> {
    this.settings = { ...this.settings, ...changes };
    await this.saveData(this.settings);
    this.syncFeatureState();
  }

  private async loadSettings(): Promise<void> {
    this.settings = { ...DEFAULT_SETTINGS, ...(await this.loadData() as Partial<BetterEditorSettings> | null) };
  }

  private syncFeatureState(): void {
    this.syncCommand("move-website-links", this.settings.websiteLinkFilingEnabled, () => {
      this.addCommand({
        id: "move-website-links",
        name: "Move standalone website links to Links list",
        editorCallback: (editor) => this.moveLinks(editor)
      });
    });

    this.syncCommand("organize-current-note", this.settings.noteOrganizerEnabled, () => {
      this.addCommand({
        id: "organize-current-note",
        name: "Organize current note",
        editorCallback: (editor) => this.organizeEditor(editor, true)
      });
    });

    this.syncCommand("expand-selection", this.settings.smartSelectionEnabled, () => {
      this.addCommand({
        id: "expand-selection",
        name: "Expand selection by paragraph, section, then note",
        editorCallback: (editor) => expandSmartSelection(editor)
      });
    });

    this.syncCommand(
      "toggle-tab-bar-visibility",
      this.settings.tabBarControlsEnabled && Platform.isDesktopApp,
      () => {
        this.addCommand({
          id: "toggle-tab-bar-visibility",
          name: "Toggle tab bar visibility",
          callback: () => {
            void this.updateSettings({ hideTabBar: !this.settings.hideTabBar });
          }
        });
      }
    );

    this.syncCommand("delete-current-file", this.settings.linkedFileDeletionEnabled, () => {
      this.addCommand({
        id: "delete-current-file",
        name: "Delete current file and clean linked mentions",
        checkCallback: (checking) => {
          const file = this.app.workspace.getActiveFile();
          if (!(file instanceof TFile)) return false;
          if (!checking) void this.fileDeletion.run(file);
          return true;
        }
      });
    });

    this.tabBar.refresh();
  }

  private syncCommand(id: string, enabled: boolean, register: () => void): void {
    const isRegistered = this.registeredCommandIds.has(id);
    if (enabled && !isRegistered) {
      register();
      this.registeredCommandIds.add(id);
    } else if (!enabled && isRegistered) {
      this.removeCommand(id);
      this.registeredCommandIds.delete(id);
    }
  }

  private moveLinks(editor: Editor): void {
    const originalText = editor.getValue();
    const result = moveWebsiteLinks(originalText);
    if (result.movedCount === 0) {
      new Notice("No standalone website links were found outside the Links list.");
      return;
    }

    this.replaceEditorText(editor, result.text);
    new Notice(`Moved ${result.movedCount} website link${result.movedCount === 1 ? "" : "s"}.`);
  }

  private organizeEditor(editor: Editor, showNotice: boolean): void {
    const originalText = editor.getValue();
    const result = organizeCurrentNote(originalText, {
      organizeWebsiteLinks: this.settings.websiteLinkFilingEnabled
    });
    if (result.text === originalText) {
      if (showNotice) new Notice("Current note is already organized.");
      return;
    }

    this.replaceEditorText(editor, result.text);
    if (!showNotice) return;

    const changes: string[] = [];
    if (result.movedLinkCount > 0) {
      changes.push(`${result.movedLinkCount} link${result.movedLinkCount === 1 ? "" : "s"}`);
    }
    if (result.movedTaskCount > 0) {
      changes.push(`${result.movedTaskCount} task${result.movedTaskCount === 1 ? "" : "s"}`);
    }
    if (result.movedNoteCount > 0) {
      changes.push(`${result.movedNoteCount} note${result.movedNoteCount === 1 ? "" : "s"}`);
    }
    if (result.bulletAddedCount > 0) {
      changes.push(`${result.bulletAddedCount} bullet${result.bulletAddedCount === 1 ? "" : "s"} added`);
    }
    if (result.removedEmptyLineCount > 0) {
      changes.push(
        `${result.removedEmptyLineCount} empty line${result.removedEmptyLineCount === 1 ? "" : "s"} removed`
      );
    }
    new Notice(`Organized current note: ${changes.join(", ")}.`);
  }

  private replaceEditorText(editor: Editor, text: string): void {
    const cursor = editor.getCursor();
    editor.setValue(text);
    editor.setCursor({
      line: Math.min(cursor.line, editor.lineCount() - 1),
      ch: cursor.ch
    });
  }

  private async organizeNoteOnOpen(file: TFile): Promise<void> {
    if (!this.settings.noteOrganizerEnabled
      || !this.settings.organizeOnNoteOpen
      || file.extension !== "md") return;
    if (this.settings.organizeOnlyDailyNotes && !this.isDailyNote(file)) return;

    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (view?.file?.path === file.path) {
      this.organizeEditor(view.editor, false);
      return;
    }

    await this.app.vault.process(file, (text) => organizeCurrentNote(text, {
      organizeWebsiteLinks: this.settings.websiteLinkFilingEnabled
    }).text);
  }

  private isDailyNote(file: TFile): boolean {
    const app = this.app as AppWithInternalPlugins;
    const dailyNotesPlugin = app.internalPlugins?.getPluginById("daily-notes");
    if (!dailyNotesPlugin?.enabled) return false;

    const folder = normalizePath(dailyNotesPlugin.instance?.options?.folder?.trim() || "");
    const format = dailyNotesPlugin.instance?.options?.format?.trim() || "YYYY-MM-DD";
    const pathWithoutExtension = file.path.slice(0, -3);
    const relativePath = folder
      ? pathWithoutExtension.startsWith(`${folder}/`)
        ? pathWithoutExtension.slice(folder.length + 1)
        : ""
      : pathWithoutExtension;

    return relativePath.length > 0 && moment(relativePath, format, true).isValid();
  }
}
