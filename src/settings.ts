import {
  App,
  Platform,
  Plugin,
  PluginSettingTab,
  type SettingDefinitionItem,
} from "obsidian";
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
  miniToolbarStrikethroughAction:
    DEFAULT_TOOLBAR_SETTINGS.strikethroughButtonAction,
  miniToolbarUnderlineAction: DEFAULT_TOOLBAR_SETTINGS.underlineButtonAction,
  miniToolbarColors: {},
};

export interface SettingsHost {
  settings: BetterEditorSettings;
  updateSettings(changes: Partial<BetterEditorSettings>): Promise<void>;
}

type SettingsPlugin = Plugin & SettingsHost;
type ControlSettingKey = Exclude<keyof BetterEditorSettings, "miniToolbarColors">;

const toolbarActionOptions = (
  defaultAction: ToolbarButtonAction,
  defaultLabel: string,
): Record<string, string> => ({
  [defaultAction]: defaultLabel,
  "heading-2": "Heading 2",
  "heading-3": "Heading 3",
  "heading-4": "Heading 4",
});

export class BetterEditorSettingTab extends PluginSettingTab {
  constructor(app: App, private readonly plugin: SettingsPlugin) {
    super(app, plugin);
  }

  getSettingDefinitions(): SettingDefinitionItem<ControlSettingKey>[] {
    const desktop = Platform.isDesktopApp;

    return [
      {
        name: "Website link filing",
        desc: "Adds the command that moves standalone website links into the note's Links list.",
        control: {
          type: "toggle",
          key: "websiteLinkFilingEnabled",
          defaultValue: true,
        },
      },
      {
        name: "Note organizer",
        desc: "Adds manual and automatic note organization for notes, tasks, blank lines, and enabled website link filing.",
        control: {
          type: "toggle",
          key: "noteOrganizerEnabled",
          defaultValue: true,
        },
      },
      {
        name: "Smart selection",
        desc: "Adds the expanding selection command for a paragraph, heading body, and note without its title.",
        control: {
          type: "toggle",
          key: "smartSelectionEnabled",
          defaultValue: true,
        },
      },
      {
        name: "Task marker deletion",
        desc: "Makes a Markdown task marker erase as one unit when Backspace or Delete reaches it.",
        control: {
          type: "toggle",
          key: "taskMarkerDeletionEnabled",
          defaultValue: true,
        },
      },
      {
        name: "Mini toolbar",
        desc: desktop
          ? "Shows a floating formatting toolbar when text is selected."
          : "This feature is available in the desktop app.",
        control: {
          type: "toggle",
          key: "miniToolbarEnabled",
          defaultValue: true,
          disabled: !desktop,
        },
      },
      {
        name: "Tab bar controls",
        desc: desktop
          ? "Adds the tab bar visibility command and automatic single-tab hiding."
          : "This feature is available in the desktop app.",
        control: {
          type: "toggle",
          key: "tabBarControlsEnabled",
          defaultValue: true,
          disabled: !desktop,
        },
      },
      {
        name: "Linked file deletion",
        desc: "Adds a delete-current-file command that cleans links to the file before moving it to your configured trash.",
        control: {
          type: "toggle",
          key: "linkedFileDeletionEnabled",
          defaultValue: true,
        },
      },
      {
        type: "group",
        heading: "Note organization",
        items: [
          {
            name: "Organize notes when opened",
            desc: "Automatically run Organize current note whenever a Markdown note is opened.",
            control: {
              type: "toggle",
              key: "organizeOnNoteOpen",
              defaultValue: false,
              disabled: () => !this.plugin.settings.noteOrganizerEnabled,
            },
          },
          {
            name: "Only daily notes",
            desc: "Limit automatic organization to notes matching the Daily notes folder and date format.",
            control: {
              type: "toggle",
              key: "organizeOnlyDailyNotes",
              defaultValue: false,
              disabled: () =>
                !this.plugin.settings.noteOrganizerEnabled ||
                !this.plugin.settings.organizeOnNoteOpen,
            },
          },
        ],
      },
      {
        type: "group",
        heading: "Linked file deletion",
        items: [
          {
            name: "Linked mentions",
            desc: "Choose what replaces links to the file when Delete current file is used.",
            control: {
              type: "dropdown",
              key: "linkedMentionAction",
              options: {
                "plain-text": "Keep their display text",
                remove: "Remove them completely",
              },
              defaultValue: "plain-text",
              disabled: () => !this.plugin.settings.linkedFileDeletionEnabled,
            },
          },
        ],
      },
      {
        type: "group",
        heading: "Mini toolbar",
        items: [
          {
            name: "Copy button",
            desc: "Choose what the copy button does in the mini toolbar.",
            control: {
              type: "dropdown",
              key: "miniToolbarCopyAction",
              options: toolbarActionOptions(
                DEFAULT_TOOLBAR_SETTINGS.copyButtonAction,
                "Copy",
              ),
              defaultValue: DEFAULT_TOOLBAR_SETTINGS.copyButtonAction,
              disabled: () =>
                !this.plugin.settings.miniToolbarEnabled || !desktop,
            },
          },
          {
            name: "Strikethrough button",
            desc: "Choose what the strikethrough button does in the mini toolbar.",
            control: {
              type: "dropdown",
              key: "miniToolbarStrikethroughAction",
              options: toolbarActionOptions(
                DEFAULT_TOOLBAR_SETTINGS.strikethroughButtonAction,
                "Strikethrough",
              ),
              defaultValue:
                DEFAULT_TOOLBAR_SETTINGS.strikethroughButtonAction,
              disabled: () =>
                !this.plugin.settings.miniToolbarEnabled || !desktop,
            },
          },
          {
            name: "Underline button",
            desc: "Choose what the underline button does in the mini toolbar.",
            control: {
              type: "dropdown",
              key: "miniToolbarUnderlineAction",
              options: toolbarActionOptions(
                DEFAULT_TOOLBAR_SETTINGS.underlineButtonAction,
                "Underline",
              ),
              defaultValue: DEFAULT_TOOLBAR_SETTINGS.underlineButtonAction,
              disabled: () =>
                !this.plugin.settings.miniToolbarEnabled || !desktop,
            },
          },
        ],
      },
      {
        type: "group",
        heading: "Tab bar",
        items: [
          {
            name: "Auto-hide with one tab",
            desc: "Hide the tab bar when this window has only one main tab open.",
            control: {
              type: "toggle",
              key: "autoHideSingleTab",
              defaultValue: false,
              disabled: () =>
                !this.plugin.settings.tabBarControlsEnabled || !desktop,
            },
          },
          {
            name: "Top gradient",
            desc: "Fade the theme background behind window controls. Set to 0 to disable the fade.",
            control: {
              type: "slider",
              key: "tabGradientHeight",
              min: 0,
              max: 200,
              step: 5,
              defaultValue: 80,
              disabled: () =>
                !this.plugin.settings.tabBarControlsEnabled || !desktop,
            },
          },
        ],
      },
    ];
  }

  getControlValue(key: string): unknown {
    return this.plugin.settings[key as keyof BetterEditorSettings];
  }

  async setControlValue(key: string, value: unknown): Promise<void> {
    await this.plugin.updateSettings({ [key]: value });
    this.update();
  }
}
