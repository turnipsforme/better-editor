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
