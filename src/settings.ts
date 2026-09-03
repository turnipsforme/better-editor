import { App, Platform, Plugin, PluginSettingTab, Setting } from "obsidian";
import type { LinkedMentionAction } from "./link-cleanup";
import type { FileColorData } from "./mini-toolbar/colorRanges";
import {
  DEFAULT_TOOLBAR_SETTINGS,
  type ToolbarButtonAction,
} from "./mini-toolbar/toolbar-settings";

export interface BetterEditorSettings {
  websiteLinkFilingEnabled: boolean;
  noteOrganizerEnabled: boolean;
  smartSelectionEnabled: boolean;
  taskMarkerDeletionEnabled: boolean;
  miniToolbarEnabled: boolean;
  tabBarControlsEnabled: boolean;
  linkedFileDeletionEnabled: boolean;
  organizeOnNoteOpen: boolean;
  organizeOnlyDailyNotes: boolean;
  hideTabBar: boolean;
  autoHideSingleTab: boolean;
  tabGradientHeight: number;
  linkedMentionAction: LinkedMentionAction;
  miniToolbarCopyAction: ToolbarButtonAction;
  miniToolbarStrikethroughAction: ToolbarButtonAction;
  miniToolbarUnderlineAction: ToolbarButtonAction;
  miniToolbarColors: Record<string, FileColorData>;
}

export const DEFAULT_SETTINGS: BetterEditorSettings = {
  websiteLinkFilingEnabled: true,
  noteOrganizerEnabled: true,
  smartSelectionEnabled: true,
  taskMarkerDeletionEnabled: true,
  miniToolbarEnabled: true,
  tabBarControlsEnabled: true,
  linkedFileDeletionEnabled: true,
  organizeOnNoteOpen: false,
  organizeOnlyDailyNotes: false,
  hideTabBar: false,
  autoHideSingleTab: false,
  tabGradientHeight: 80,
  linkedMentionAction: "plain-text",
  miniToolbarCopyAction: DEFAULT_TOOLBAR_SETTINGS.copyButtonAction,
  miniToolbarStrikethroughAction: DEFAULT_TOOLBAR_SETTINGS.strikethroughButtonAction,
  miniToolbarUnderlineAction: DEFAULT_TOOLBAR_SETTINGS.underlineButtonAction,
  miniToolbarColors: {},
};

export interface SettingsHost {
  settings: BetterEditorSettings;
  updateSettings(changes: Partial<BetterEditorSettings>): Promise<void>;
}

type SettingsPlugin = Plugin & SettingsHost;

export class BetterEditorSettingTab extends PluginSettingTab {
  constructor(app: App, private readonly plugin: SettingsPlugin) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    this.addFeatureToggle(
      "Website link filing",
      "Adds the command that moves standalone website links into the note's Links list.",
      "websiteLinkFilingEnabled"
    );
    this.addFeatureToggle(
      "Note organizer",
      "Adds manual and automatic note organization for notes, tasks, blank lines, and enabled website link filing.",
      "noteOrganizerEnabled"
    );
    this.addFeatureToggle(
      "Smart selection",
      "Adds the expanding selection command for a paragraph, heading body, and note without its title.",
      "smartSelectionEnabled"
    );
    this.addFeatureToggle(
      "Task marker deletion",
      "Makes a Markdown task marker erase as one unit when Backspace or Delete reaches it.",
      "taskMarkerDeletionEnabled"
    );
    this.addFeatureToggle(
      "Mini toolbar",
      Platform.isDesktopApp
        ? "Shows a floating formatting toolbar when text is selected."
        : "This feature is available in the desktop app.",
      "miniToolbarEnabled",
      !Platform.isDesktopApp
    );
    this.addFeatureToggle(
      "Tab bar controls",
      Platform.isDesktopApp
        ? "Adds the tab bar visibility command and automatic single-tab hiding."
        : "This feature is available in the desktop app.",
      "tabBarControlsEnabled",
      !Platform.isDesktopApp
    );
    this.addFeatureToggle(
      "Linked file deletion",
      "Adds a delete-current-file command that cleans links to the file before moving it to your configured trash.",
      "linkedFileDeletionEnabled"
    );

    new Setting(containerEl).setName("Note organization").setHeading();
    new Setting(containerEl)
      .setName("Organize notes when opened")
      .setDesc("Automatically run Organize current note whenever a Markdown note is opened.")
      .addToggle((toggle) => toggle
        .setValue(this.plugin.settings.organizeOnNoteOpen)
        .setDisabled(!this.plugin.settings.noteOrganizerEnabled)
        .onChange(async (value) => {
          await this.plugin.updateSettings({ organizeOnNoteOpen: value });
          this.display();
        }));

    new Setting(containerEl)
      .setName("Only daily notes")
      .setDesc("Limit automatic organization to notes matching the Daily notes folder and date format.")
      .addToggle((toggle) => toggle
        .setValue(this.plugin.settings.organizeOnlyDailyNotes)
        .setDisabled(
          !this.plugin.settings.noteOrganizerEnabled
          || !this.plugin.settings.organizeOnNoteOpen
        )
        .onChange(async (value) => {
          await this.plugin.updateSettings({ organizeOnlyDailyNotes: value });
        }));

    new Setting(containerEl).setName("Linked file deletion").setHeading();
    new Setting(containerEl)
      .setName("Linked mentions")
      .setDesc("Choose what replaces links to the file when Delete current file is used.")
      .addDropdown((dropdown) => dropdown
        .addOption("plain-text", "Keep their display text")
        .addOption("remove", "Remove them completely")
        .setValue(this.plugin.settings.linkedMentionAction)
        .setDisabled(!this.plugin.settings.linkedFileDeletionEnabled)
        .onChange(async (value) => {
          await this.plugin.updateSettings({ linkedMentionAction: value as LinkedMentionAction });
        }));

    new Setting(containerEl).setName("Mini toolbar").setHeading();
    this.addToolbarActionSetting(
      "miniToolbarCopyAction",
      "Copy button",
      "Choose what the copy button does in the mini toolbar.",
      DEFAULT_TOOLBAR_SETTINGS.copyButtonAction,
      "Copy"
    );
    this.addToolbarActionSetting(
      "miniToolbarStrikethroughAction",
      "Strikethrough button",
      "Choose what the strikethrough button does in the mini toolbar.",
      DEFAULT_TOOLBAR_SETTINGS.strikethroughButtonAction,
      "Strikethrough"
    );
    this.addToolbarActionSetting(
      "miniToolbarUnderlineAction",
      "Underline button",
      "Choose what the underline button does in the mini toolbar.",
      DEFAULT_TOOLBAR_SETTINGS.underlineButtonAction,
      "Underline"
    );

    new Setting(containerEl).setName("Tab bar").setHeading();
    new Setting(containerEl)
      .setName("Auto-hide with one tab")
      .setDesc("Hide the tab bar when this window has only one main tab open.")
      .addToggle((toggle) => toggle
        .setValue(this.plugin.settings.autoHideSingleTab)
        .setDisabled(!this.plugin.settings.tabBarControlsEnabled || !Platform.isDesktopApp)
        .onChange(async (value) => {
          await this.plugin.updateSettings({ autoHideSingleTab: value });
        }));

    new Setting(containerEl)
      .setName("Top gradient")
      .setDesc("Fade the theme background behind window controls. Set to 0 to disable the fade.")
      .addSlider((slider) => slider
        .setLimits(0, 200, 5)
        .setValue(this.plugin.settings.tabGradientHeight)
        .setDynamicTooltip()
        .setDisabled(!this.plugin.settings.tabBarControlsEnabled || !Platform.isDesktopApp)
        .onChange(async (value) => {
          await this.plugin.updateSettings({ tabGradientHeight: value });
        }));
  }

  private addFeatureToggle(
    name: string,
    description: string,
    key: keyof Pick<BetterEditorSettings,
      | "websiteLinkFilingEnabled"
      | "noteOrganizerEnabled"
      | "smartSelectionEnabled"
      | "taskMarkerDeletionEnabled"
      | "miniToolbarEnabled"
      | "tabBarControlsEnabled"
      | "linkedFileDeletionEnabled">,
    disabled = false
  ): void {
    new Setting(this.containerEl)
      .setName(name)
      .setDesc(description)
      .addToggle((toggle) => toggle
        .setValue(this.plugin.settings[key])
        .setDisabled(disabled)
        .onChange(async (value) => {
          await this.plugin.updateSettings({ [key]: value });
          this.display();
        }));
  }

  private addToolbarActionSetting(
    key:
      | "miniToolbarCopyAction"
      | "miniToolbarStrikethroughAction"
      | "miniToolbarUnderlineAction",
    name: string,
    description: string,
    defaultAction: ToolbarButtonAction,
    defaultLabel: string
  ): void {
    new Setting(this.containerEl)
      .setName(name)
      .setDesc(description)
      .addDropdown((dropdown) => dropdown
        .addOption(defaultAction, defaultLabel)
        .addOption("heading-2", "Heading 2")
        .addOption("heading-3", "Heading 3")
        .addOption("heading-4", "Heading 4")
        .setValue(this.plugin.settings[key])
        .setDisabled(!this.plugin.settings.miniToolbarEnabled || !Platform.isDesktopApp)
        .onChange(async (value) => {
          await this.plugin.updateSettings({ [key]: value as ToolbarButtonAction });
        }));
  }
}
