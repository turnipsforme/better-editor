import {
  App,
  Platform,
  Plugin,
  PluginSettingTab,
  type SettingDefinitionItem,
  type SettingGroupItem,
} from "obsidian";
import type { EmptyLineMode, OrganizeNoteOptions } from "./note-organizer";
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
  manualEmptyLines: EmptyLineMode;
  manualKeepTopHeadingGap: boolean;
  manualTasksAtTop: boolean;
  manualMoveLinks: boolean;
  manualMoveTasks: boolean;
  manualMoveNotes: boolean;
  manualAddBullets: boolean;
  automaticEmptyLines: EmptyLineMode;
  automaticKeepTopHeadingGap: boolean;
  automaticTasksAtTop: boolean;
  automaticMoveLinks: boolean;
  automaticMoveTasks: boolean;
  automaticMoveNotes: boolean;
  automaticAddBullets: boolean;
  organizeOnNoteOpen: boolean;
  organizeOnlyDailyNotes: boolean;
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
  manualEmptyLines: "remove",
  manualKeepTopHeadingGap: true,
  manualTasksAtTop: true,
  manualMoveLinks: true,
  manualMoveTasks: true,
  manualMoveNotes: true,
  manualAddBullets: true,
  automaticEmptyLines: "remove",
  automaticKeepTopHeadingGap: true,
  automaticTasksAtTop: true,
  automaticMoveLinks: true,
  automaticMoveTasks: true,
  automaticMoveNotes: true,
  automaticAddBullets: true,
  organizeOnNoteOpen: false,
  organizeOnlyDailyNotes: false,
  autoHideSingleTab: false,
  tabGradientHeight: 80,
  linkedMentionAction: "plain-text",
  miniToolbarCopyAction: DEFAULT_TOOLBAR_SETTINGS.copyButtonAction,
  miniToolbarStrikethroughAction:
    DEFAULT_TOOLBAR_SETTINGS.strikethroughButtonAction,
  miniToolbarUnderlineAction: DEFAULT_TOOLBAR_SETTINGS.underlineButtonAction,
  miniToolbarColors: {},
};

export function organizerOptions(settings: BetterEditorSettings, automatic: boolean, dailyNote = false): OrganizeNoteOptions {
  const prefix = automatic ? "automatic" : "manual";
  return {
    emptyLines: settings[`${prefix}EmptyLines`],
    keepTopHeadingGap: settings[`${prefix}KeepTopHeadingGap`],
    tasksAtTop: !dailyNote && settings[`${prefix}TasksAtTop`],
    organizeWebsiteLinks: settings.websiteLinkFilingEnabled && settings[`${prefix}MoveLinks`],
    moveTasks: settings[`${prefix}MoveTasks`],
    moveNotes: settings[`${prefix}MoveNotes`],
    addBullets: settings[`${prefix}AddBullets`],
  };
}

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
        name: "Note organizer",
        desc: "Enable the Organize current note command and optional automatic organization.",
        control: {
          type: "toggle",
          key: "noteOrganizerEnabled",
          defaultValue: true,
        },
      },
      {
        type: "group",
        heading: "Manual organization",
        items: this.organizerControls("manual"),
      },
      {
        type: "group",
        heading: "Automatic organization",
        items: [
          {
            name: "Organize notes when opened",
            desc: "Use the automatic options below whenever a Markdown note is opened.",
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
          ...this.organizerControls("automatic"),
        ],
      },
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
        name: "Tab bar controls",
        desc: desktop
          ? "Adds the Hide/show tab bar command and automatic single-tab hiding."
          : "This feature is available in the desktop app.",
        control: {
          type: "toggle",
          key: "tabBarControlsEnabled",
          defaultValue: true,
          disabled: !desktop,
        },
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
    ];
  }

  private organizerControls(prefix: "manual" | "automatic"): SettingGroupItem<ControlSettingKey>[] {
    const disabled = () => !this.plugin.settings.noteOrganizerEnabled
      || (prefix === "automatic" && !this.plugin.settings.organizeOnNoteOpen);
    return [
      {
        name: "Empty lines",
        desc: "Choose how blank lines are cleaned up outside protected Markdown blocks.",
        control: {
          type: "dropdown",
          key: `${prefix}EmptyLines`,
          options: { remove: "Remove all", collapse: "Collapse repeated blank lines", keep: "Keep all" },
          defaultValue: "remove",
          disabled,
        },
      },
      {
        name: "Keep blank line after top heading",
        desc: "Keep an existing blank line between the first heading and its content, even when removing empty lines.",
        control: { type: "toggle", key: `${prefix}KeepTopHeadingGap`, defaultValue: true, disabled },
      },
      {
        name: "Move website links to Links",
        desc: "File standalone website links under the Links list. Requires Website link filing below.",
        control: {
          type: "toggle", key: `${prefix}MoveLinks`, defaultValue: true,
          disabled: () => disabled() || !this.plugin.settings.websiteLinkFilingEnabled,
        },
      },
      {
        name: "Group tasks at top of non-daily notes",
        desc: "Gather top-level tasks and their children before the first heading, after any properties. On by default; takes priority over Move tasks to Tasks.",
        control: { type: "toggle", key: `${prefix}TasksAtTop`, defaultValue: true, disabled },
      },
      {
        name: "Move tasks to Tasks",
        desc: "Move top-level tasks and their children under the first Tasks or To-do heading, when present.",
        control: { type: "toggle", key: `${prefix}MoveTasks`, defaultValue: true, disabled },
      },
      {
        name: "Move free text to Notes",
        desc: "Move simple text lines and list items under the first Notes heading, when present.",
        control: { type: "toggle", key: `${prefix}MoveNotes`, defaultValue: true, disabled },
      },
      {
        name: "Add bullets to text",
        desc: "Add bullets to simple text lines, whether they move to Notes or stay in place.",
        control: { type: "toggle", key: `${prefix}AddBullets`, defaultValue: true, disabled },
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
