import { describe, expect, it, vi } from "vitest";
import type { App, WorkspaceLeaf } from "obsidian";
import { TabBarController, type TabBarOptions } from "../src/tab-bar";

interface FakeDocument {
  doc: Document;
  classes: Set<string>;
  styles: Map<string, string>;
}

const createDocument = (): FakeDocument => {
  const classes = new Set<string>();
  const styles = new Map<string, string>();
  const doc = {
    body: {
      classList: {
        contains: (name: string) => classes.has(name),
        remove: (...names: string[]) => names.forEach((name) => classes.delete(name)),
        toggle: (name: string, force: boolean) => {
          if (force) classes.add(name);
          else classes.delete(name);
          return force;
        },
      },
      style: {
        removeProperty: (name: string) => styles.delete(name),
        setProperty: (name: string, value: string) => styles.set(name, value),
      },
    },
  } as unknown as Document;

  return { doc, classes, styles };
};

const createApp = (rootDocument: Document, documents: Document[]): App => ({
  workspace: {
    layoutReady: true,
    rootSplit: { doc: rootDocument },
    iterateRootLeaves: (callback: (leaf: WorkspaceLeaf) => unknown) => {
      for (const doc of documents) {
        callback({ getContainer: () => ({ doc }) } as WorkspaceLeaf);
      }
    },
  },
} as unknown as App);

describe("TabBarController", () => {
  it("ignores refresh and toggle before the workspace is ready", () => {
    const { doc, classes, styles } = createDocument();
    const app = createApp(doc, [doc]);
    app.workspace.layoutReady = false;
    const iterateLeaves = vi.spyOn(app.workspace, "iterateRootLeaves");
    const controller = new TabBarController(app, () => ({
      enabled: true,
      autoHideSingleTab: true,
      gradientHeight: 80,
    }));

    controller.refresh();
    controller.toggle(doc);
    expect(iterateLeaves).not.toHaveBeenCalled();
    expect(styles.size).toBe(0);

    app.workspace.layoutReady = true;
    controller.refresh();
    expect(classes.has("better-editor-hide-tabs")).toBe(true);
    expect(styles.get("--better-editor-tab-gradient-height")).toBe("80px");
  });

  it("handles a missing workspace root and can still remove its styles", () => {
    const { doc, styles } = createDocument();
    const app = createApp(doc, [doc]);
    const options = { enabled: true, autoHideSingleTab: true, gradientHeight: 80 };
    const controller = new TabBarController(app, () => options);
    controller.refresh();
    // The runtime can clear the root while replacing the workspace layout.
    Object.assign(app.workspace, { rootSplit: null });

    expect(() => controller.refresh()).not.toThrow();
    expect(() => controller.toggle(doc)).not.toThrow();
    options.enabled = false;
    controller.refresh();
    expect(styles.size).toBe(0);
  });

  it("auto-hides only the window with one tab", () => {
    const first = createDocument();
    const second = createDocument();
    const app = createApp(first.doc, [first.doc, second.doc, second.doc]);
    const options: TabBarOptions = {
      enabled: true,
      autoHideSingleTab: true,
      gradientHeight: 80,
    };

    new TabBarController(app, () => options).refresh();

    expect(first.classes.has("better-editor-hide-tabs")).toBe(true);
    expect(second.classes.has("better-editor-hide-tabs")).toBe(false);
    expect(first.styles.get("--better-editor-tab-gradient-height")).toBe("80px");
    expect(second.styles.get("--better-editor-tab-gradient-height")).toBe("80px");
  });

  it("toggles only the chosen window", () => {
    const first = createDocument();
    const second = createDocument();
    const app = createApp(first.doc, [first.doc, second.doc]);
    const options: TabBarOptions = {
      enabled: true,
      autoHideSingleTab: false,
      gradientHeight: 60,
    };
    const controller = new TabBarController(app, () => options);
    controller.refresh();

    controller.toggle(second.doc);

    expect(first.classes.has("better-editor-hide-tabs")).toBe(false);
    expect(second.classes.has("better-editor-hide-tabs")).toBe(true);

    controller.toggle(second.doc);

    expect(first.classes.has("better-editor-hide-tabs")).toBe(false);
    expect(second.classes.has("better-editor-hide-tabs")).toBe(false);
  });

  it("can show an automatically hidden tab bar in one window", () => {
    const first = createDocument();
    const second = createDocument();
    const app = createApp(first.doc, [first.doc, second.doc, second.doc]);
    const options: TabBarOptions = {
      enabled: true,
      autoHideSingleTab: true,
      gradientHeight: 80,
    };
    const controller = new TabBarController(app, () => options);
    controller.refresh();

    controller.toggle(first.doc);

    expect(first.classes.has("better-editor-hide-tabs")).toBe(false);
    expect(second.classes.has("better-editor-hide-tabs")).toBe(false);
  });
});
