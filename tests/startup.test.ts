import { beforeEach, describe, expect, it, vi } from "vitest";
import type { App, Command, PluginManifest } from "obsidian";

const toolbar = vi.hoisted(() => ({
  refresh: vi.fn(),
  scheduleJournalInjection: vi.fn(),
  processReadingView: vi.fn(),
  destroy: vi.fn(),
}));

vi.mock("obsidian", () => ({
  Plugin: class {
    constructor(public app: App) {}
    loadData = vi.fn(async () => null);
    saveData = vi.fn(async () => {});
    addCommand = vi.fn((command: Command) => command);
    removeCommand = vi.fn();
    addSettingTab = vi.fn();
    registerEditorExtension = vi.fn();
    registerMarkdownPostProcessor = vi.fn();
    registerEvent = vi.fn();
    onunload(): void {}
    unload(): void {
      this.onunload();
    }
  },
  PluginSettingTab: class {},
  Platform: { isDesktopApp: true },
  MarkdownView: class {},
  TFile: class {},
  Notice: class {},
  moment: vi.fn(),
  normalizePath: (path: string) => path,
  parseLinktext: vi.fn(),
}));

vi.mock("../src/mini-toolbar/feature", () => ({
  MiniToolbarFeature: class {
    editorExtensions = [];
    refresh = toolbar.refresh;
    scheduleJournalInjection = toolbar.scheduleJournalInjection;
    processReadingView = toolbar.processReadingView;
    destroy = toolbar.destroy;
  },
}));

import BetterEditorPlugin from "../src/main";

function createWorkspace(ready = false) {
  const styles = new Map<string, string>();
  const doc = {
    body: {
      classList: { toggle: vi.fn(), remove: vi.fn() },
      style: {
        setProperty: (key: string, value: string) => styles.set(key, value),
        removeProperty: (key: string) => styles.delete(key),
      },
    },
  } as unknown as Document;
  const callbacks: (() => void)[] = [];
  const events = new Map<string, (() => void)[]>();
  const workspace = {
    layoutReady: ready,
    rootSplit: ready ? { doc } : null,
    iterateRootLeaves: vi.fn(),
    on: vi.fn((name: string, callback: () => void) => {
      events.set(name, [...(events.get(name) ?? []), callback]);
      return { name, callback };
    }),
    onLayoutReady: (callback: () => void) => {
      if (workspace.layoutReady) callback();
      else callbacks.push(callback);
    },
  };
  const app = { workspace } as unknown as App;
  const plugin = new BetterEditorPlugin(app, {} as PluginManifest);

  return {
    plugin,
    workspace,
    styles,
    emit: (name: string) => events.get(name)?.forEach((callback) => callback()),
    finishLoading: () => {
      workspace.rootSplit = { doc };
      workspace.layoutReady = true;
      callbacks.splice(0).forEach((callback) => callback());
    },
  };
}

beforeEach(() => vi.clearAllMocks());

describe("plugin startup", () => {
  it("registers commands and extensions before the workspace exists, then starts the UI when ready", async () => {
    const { plugin, workspace, styles, finishLoading, emit } = createWorkspace();

    await expect(plugin.onload()).resolves.toBeUndefined();
    expect(plugin.addCommand).toHaveBeenCalledTimes(5);
    expect(plugin.registerEditorExtension).toHaveBeenCalledTimes(2);
    for (const event of ["layout-change", "window-open", "window-close", "active-leaf-change"]) {
      expect(() => emit(event)).not.toThrow();
    }
    expect(workspace.iterateRootLeaves).not.toHaveBeenCalled();
    expect(toolbar.refresh).not.toHaveBeenCalled();
    expect(toolbar.scheduleJournalInjection).not.toHaveBeenCalled();

    finishLoading();

    expect(styles.get("--better-editor-tab-gradient-height")).toBe("80px");
    expect(toolbar.refresh).toHaveBeenCalledTimes(1);
    expect(plugin.addCommand).toHaveBeenCalledTimes(5);
    emit("layout-change");
    expect(toolbar.scheduleJournalInjection).toHaveBeenCalledTimes(1);
    plugin.unload();
    expect(styles.size).toBe(0);
  });

  it("applies settings changed during startup once the workspace is ready", async () => {
    const { plugin, styles, finishLoading } = createWorkspace();
    await plugin.onload();

    await plugin.updateSettings({ tabGradientHeight: 120 });
    expect(toolbar.refresh).not.toHaveBeenCalled();
    finishLoading();

    expect(styles.get("--better-editor-tab-gradient-height")).toBe("120px");
    expect(toolbar.refresh).toHaveBeenCalledTimes(1);
    plugin.unload();
  });

  it("starts immediately when enabled in an already open vault", async () => {
    const { plugin, styles } = createWorkspace(true);
    await plugin.onload();

    expect(styles.get("--better-editor-tab-gradient-height")).toBe("80px");
    expect(toolbar.refresh).toHaveBeenCalledTimes(1);
    await plugin.updateSettings({ tabBarControlsEnabled: false });
    expect(styles.size).toBe(0);
    expect(plugin.removeCommand).toHaveBeenCalledWith("toggle-tab-bar-visibility");
    plugin.unload();
  });

  it("does not start deferred features after the plugin is unloaded", async () => {
    const { plugin, workspace, styles, finishLoading } = createWorkspace();
    await plugin.onload();
    plugin.unload();
    const registeredEvents = workspace.on.mock.calls.length;

    finishLoading();

    expect(styles.size).toBe(0);
    expect(toolbar.refresh).not.toHaveBeenCalled();
    expect(workspace.on).toHaveBeenCalledTimes(registeredEvents);
    expect(toolbar.destroy).toHaveBeenCalledTimes(1);
  });

  it("can clean up when loading settings fails before feature construction", async () => {
    const { plugin } = createWorkspace();
    vi.mocked(plugin.loadData).mockRejectedValueOnce(new Error("Settings unavailable"));

    await expect(plugin.onload()).rejects.toThrow("Settings unavailable");
    expect(() => plugin.unload()).not.toThrow();
  });

  it("stops loading when disabled while settings are still being read", async () => {
    const { plugin, finishLoading } = createWorkspace();
    let finishReading!: (data: null) => void;
    vi.mocked(plugin.loadData).mockReturnValueOnce(new Promise((resolve) => {
      finishReading = resolve;
    }));
    const loading = plugin.onload();
    plugin.unload();

    finishReading(null);
    await loading;
    finishLoading();

    expect(plugin.addCommand).not.toHaveBeenCalled();
    expect(plugin.registerEditorExtension).not.toHaveBeenCalled();
    expect(toolbar.refresh).not.toHaveBeenCalled();
  });
});

import { MarkdownView, TFile, moment, type Editor } from "obsidian";
import { BetterEditorSettingTab, DEFAULT_SETTINGS, organizerOptions } from "../src/settings";

function textEditor(initial: string): Editor {
  let text = initial;
  return {
    getValue: () => text,
    getCursor: () => ({ line: 0, ch: 0 }),
    getLine: (line: number) => text.split("\n")[line],
    lineCount: () => text.split("\n").length,
    replaceRange: (updated: string) => { text = updated; },
    setCursor: vi.fn(),
  } as unknown as Editor;
}

describe("organizer integration", () => {
  it.each([false, true])("uses the note's daily status in every organizer path: %s", async (daily) => {
    const { plugin, workspace } = createWorkspace();
    Object.assign(plugin.app, { internalPlugins: { getPluginById: () => ({ enabled: true, instance: { options: { folder: "Journal", format: "YYYY-MM-DD" } } }) } });
    vi.mocked(moment).mockReturnValue({ isValid: () => true } as ReturnType<typeof moment>);
    await plugin.onload();
    await plugin.updateSettings({ organizeOnNoteOpen: true });
    const file = Object.assign(new TFile(), { path: daily ? "Journal/2026-09-25.md" : "Project.md", extension: "md" });
    const input = "# Title\n\nSummary\n- [ ] Task\n## Tasks\n";
    const expected = daily ? "# Title\n\n- Summary\n## Tasks\n- [ ] Task\n" : "- [ ] Task\n# Title\n\n- Summary\n## Tasks\n";
    const editor = textEditor(input);
    const view = Object.assign(Object.create(MarkdownView.prototype), { file, editor });
    const command = vi.mocked(plugin.addCommand).mock.calls.map(([command]) => command).find((command) => command.id === "organize-current-note")!;
    command.editorCallback!(editor, view);
    expect(editor.getValue()).toBe(expected);

    view.editor = textEditor(input);
    const getActiveViewOfType = vi.fn(() => view as MarkdownView | null);
    Object.assign(workspace, { getActiveViewOfType });
    const fileOpen = workspace.on.mock.calls.find(([name]) => name === "file-open")![1] as unknown as (file: TFile) => void;
    fileOpen(file);
    expect(view.editor.getValue()).toBe(expected);

    const process = vi.fn(async (_file: TFile, update: (text: string) => string) => update(input));
    Object.assign(plugin.app, { vault: { process } });
    getActiveViewOfType.mockReturnValue(null);
    fileOpen(file);
    expect(await process.mock.results[0].value).toBe(expected);
    if (daily) expect(moment).toHaveBeenCalledWith("2026-09-25", "YYYY-MM-DD", true);
    plugin.unload();
  });

  it("saves the new switches independently for manual and automatic use", async () => {
    const { plugin } = createWorkspace();
    await plugin.onload();
    await plugin.updateSettings({ manualKeepTopHeadingGap: false, manualTasksAtTop: false });
    expect(organizerOptions(plugin.settings, false)).toMatchObject({ keepTopHeadingGap: false, tasksAtTop: false });
    expect(organizerOptions(plugin.settings, true)).toMatchObject({ keepTopHeadingGap: true, tasksAtTop: true });
    expect(organizerOptions(plugin.settings, true, true)).toMatchObject({ tasksAtTop: false });
    expect(plugin.saveData).toHaveBeenLastCalledWith(expect.objectContaining({ manualKeepTopHeadingGap: false, manualTasksAtTop: false }));
    plugin.unload();
  });

  it("adds defaults to old saved settings without changing existing choices", async () => {
    const { plugin } = createWorkspace();
    vi.mocked(plugin.loadData).mockResolvedValueOnce({ websiteLinkFilingEnabled: false, organizeOnNoteOpen: true });
    await plugin.onload();
    expect(plugin.settings.manualEmptyLines).toBe("remove");
    expect(plugin.settings.automaticEmptyLines).toBe("remove");
    expect(organizerOptions(plugin.settings, false)).toEqual({
      emptyLines: "remove", keepTopHeadingGap: true, tasksAtTop: true, organizeWebsiteLinks: false, moveTasks: true, moveNotes: true, addBullets: true,
    });
    plugin.unload();
  });

  it("uses different profiles for the manual command, open editor, and background file", async () => {
    const { plugin, workspace } = createWorkspace();
    await plugin.onload();
    await plugin.updateSettings({
      organizeOnNoteOpen: true,
      manualEmptyLines: "keep", manualMoveLinks: false, manualMoveTasks: false, manualMoveNotes: false, manualAddBullets: false,
      automaticEmptyLines: "collapse", automaticMoveLinks: false, automaticMoveTasks: false, automaticMoveNotes: false, automaticAddBullets: true,
    });
    const input = "# Inbox\nText\n\n\n# Notes\n";
    const editor = textEditor(input);
    const command = vi.mocked(plugin.addCommand).mock.calls.map(([command]) => command).find((command) => command.id === "organize-current-note")!;
    command.editorCallback!(editor, {} as MarkdownView);
    expect(editor.getValue()).toBe(input);

    const file = Object.assign(new TFile(), { path: "Note.md", extension: "md" });
    const view = Object.assign(Object.create(MarkdownView.prototype), { file, editor });
    const getActiveViewOfType = vi.fn(() => view as MarkdownView | null);
    Object.assign(workspace, { getActiveViewOfType });
    const fileOpen = workspace.on.mock.calls.find(([name]) => name === "file-open")![1] as unknown as (file: TFile) => void;
    fileOpen(file);
    expect(editor.getValue()).toBe("# Inbox\n- Text\n\n# Notes\n");

    const process = vi.fn(async (_file: TFile, update: (text: string) => string) => update(input));
    Object.assign(plugin.app, { vault: { process } });
    getActiveViewOfType.mockReturnValue(null);
    fileOpen(file);
    expect(process).toHaveBeenCalledTimes(1);
    expect(await process.mock.results[0].value).toBe(editor.getValue());
    plugin.unload();
    fileOpen(file);
    expect(process).toHaveBeenCalledTimes(1);
  });

  it("rechecks feature switches when a background edit finally runs", async () => {
    const { plugin, workspace } = createWorkspace();
    await plugin.onload();
    await plugin.updateSettings({ organizeOnNoteOpen: true });
    let update!: (text: string) => string;
    Object.assign(workspace, { getActiveViewOfType: () => null });
    Object.assign(plugin.app, { vault: { process: vi.fn(async (_file: TFile, callback: typeof update) => { update = callback; }) } });
    const fileOpen = workspace.on.mock.calls.find(([name]) => name === "file-open")![1] as unknown as (file: TFile) => void;
    fileOpen(Object.assign(new TFile(), { path: "Note.md", extension: "md" }));
    await plugin.updateSettings({ organizeOnNoteOpen: false });
    expect(update("Text\n\n")).toBe("Text\n\n");
    plugin.unload();
  });

  it("does not refresh unrelated UI for an organizer setting", async () => {
    const { plugin, workspace } = createWorkspace(true);
    await plugin.onload();
    toolbar.refresh.mockClear();
    workspace.iterateRootLeaves.mockClear();
    await plugin.updateSettings({ manualEmptyLines: "keep" });
    expect(toolbar.refresh).not.toHaveBeenCalled();
    expect(workspace.iterateRootLeaves).not.toHaveBeenCalled();
    plugin.unload();
  });

  it("groups options after their feature switches and disables dependent controls", () => {
    const { plugin } = createWorkspace();
    plugin.settings = { ...DEFAULT_SETTINGS };
    const definitions = new BetterEditorSettingTab(plugin.app, plugin).getSettingDefinitions();
    expect(definitions.map((item) => "heading" in item ? item.heading : "name" in item ? item.name : "")).toEqual([
      "Note organizer", "Manual organization", "Automatic organization", "Website link filing", "Smart selection",
      "Task marker deletion", "Mini toolbar", "Mini toolbar", "Tab bar controls", "Tab bar", "Linked file deletion", "Linked file deletion",
    ]);
    const controls = definitions.flatMap((item) => "items" in item ? item.items : [item])
      .flatMap((item) => item && "control" in item && item.control ? [item.control] : []);
    const isDisabled = (key: string) => {
      const disabled = controls.find((control) => control.key === key)!.disabled;
      return typeof disabled === "function" ? disabled() : disabled;
    };
    expect(isDisabled("manualMoveNotes")).toBe(false);
    expect(isDisabled("manualKeepTopHeadingGap")).toBe(false);
    expect(isDisabled("manualTasksAtTop")).toBe(false);
    expect(isDisabled("automaticTasksAtTop")).toBe(true);
    expect(isDisabled("automaticMoveNotes")).toBe(true);
    plugin.settings.organizeOnNoteOpen = true;
    expect(isDisabled("automaticMoveNotes")).toBe(false);
    plugin.settings.websiteLinkFilingEnabled = false;
    expect(isDisabled("manualMoveLinks")).toBe(true);
    plugin.settings.noteOrganizerEnabled = false;
    expect(isDisabled("manualAddBullets")).toBe(true);
    expect(isDisabled("automaticEmptyLines")).toBe(true);
    expect(isDisabled("manualKeepTopHeadingGap")).toBe(true);
    expect(isDisabled("automaticTasksAtTop")).toBe(true);
  });
});
