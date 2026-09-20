// @vitest-environment happy-dom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { EditorState } from "@codemirror/state";
import type { EditorView, ViewUpdate } from "@codemirror/view";
import type { App } from "obsidian";

const host = vi.hoisted(() => ({
  app: { workspace: { trigger: vi.fn() }, commands: { executeCommandById: vi.fn() } },
  position: vi.fn(),
}));
vi.mock("@floating-ui/dom", () => ({ computePosition: host.position, flip: vi.fn(), offset: vi.fn(), shift: vi.fn() }));
vi.mock("obsidian", async () => {
  const { StateField } = await import("@codemirror/state");
  return {
    editorInfoField: StateField.define({
      create: () => ({ app: host.app, editor: { offsetToPos: (offset: number) => ({ line: 0, ch: offset }) } }),
      update: (value: unknown) => value,
    }),
    App: class {}, BaseComponent: class {}, Component: class { unload() {} }, Notice: class {},
    ButtonComponent: class {
      buttonEl: HTMLButtonElement;
      constructor(container: HTMLElement) {
        this.buttonEl = container.ownerDocument.createElement("button");
        container.appendChild(this.buttonEl);
      }
      setIcon(icon: string) { this.buttonEl.dataset.icon = icon; return this; }
      setTooltip(title: string) { this.buttonEl.title = title; return this; }
      onClick(callback: (event: MouseEvent) => void) { this.buttonEl.addEventListener("click", callback); return this; }
    },
  };
});

import { editorInfoField } from "obsidian";
import { cursorTooltipField, refreshMiniToolbarEffect } from "../src/mini-toolbar/toolbar";
import { DEFAULT_TOOLBAR_SETTINGS, type FloatingToolbarSettings } from "../src/mini-toolbar/toolbar-settings";
import { getRectFromPosCoords, ViewPluginClass } from "../src/mini-toolbar/popper/view-plugin";

// Small compatibility shim for Obsidian's DOM helpers, on a real test DOM.
beforeAll(() => {
  Object.assign(HTMLElement.prototype, {
    createEl(this: HTMLElement, tag: string, options: { cls?: string; text?: string } = {}) {
      const element = this.ownerDocument.createElement(tag);
      if (options.cls) element.className = options.cls;
      if (options.text) element.textContent = options.text;
      this.appendChild(element);
      return element;
    },
    createDiv(this: HTMLElement, options: { cls?: string } = {}) { return this.createEl("div", options); },
    createSpan(this: HTMLElement, options: { cls?: string } = {}) { return this.createEl("span", options); },
    empty(this: HTMLElement) { this.replaceChildren(); },
    appendText(this: HTMLElement, text: string) { this.append(text); },
    setAttr(this: HTMLElement, name: string, value: string) { this.setAttribute(name, value); },
    setCssStyles(this: HTMLElement, styles: Partial<CSSStyleDeclaration>) { Object.assign(this.style, styles); },
    detach(this: HTMLElement) { this.remove(); },
  });
});
beforeEach(() => { host.position.mockReset().mockResolvedValue({ x: 10, y: 20 }); host.app.commands.executeCommandById.mockClear(); });
afterEach(() => document.body.replaceChildren());

function setup(selection = { anchor: 1, head: 4 }) {
  let settings: FloatingToolbarSettings = { ...DEFAULT_TOOLBAR_SETTINGS };
  const field = cursorTooltipField(host.app as unknown as App, () => settings);
  let state = EditorState.create({ doc: "abcdef", selection, extensions: [editorInfoField, field] });
  const dom = document.createElement("div");
  document.body.appendChild(dom);
  const view = {
    dom, scrollDOM: dom, contentDOM: dom, root: document, inView: true,
    get state() { return state; },
    requestMeasure: vi.fn(), focus: vi.fn(),
    coordsAtPos: (position: number) => ({ left: position * 10, right: position * 10, top: 20, bottom: 40 }),
  } as unknown as EditorView;
  const plugin = new ViewPluginClass(view);
  return {
    plugin, view,
    buttons: () => Array.from(dom.querySelectorAll("button")),
    refresh: (changes: Partial<FloatingToolbarSettings>) => {
      settings = { ...settings, ...changes };
      const transaction = state.update({ effects: refreshMiniToolbarEffect.of(undefined) });
      state = transaction.state;
      plugin.update({ state, transactions: [transaction], geometryChanged: false } as unknown as ViewUpdate);
    },
  };
}

describe("mini toolbar interaction audit", () => {
  it("renders only six labelled formatting buttons, without any color menu", () => {
    const { buttons, plugin } = setup();
    expect(buttons().map((button) => button.getAttribute("aria-label"))).toEqual([
      "Cut", "Copy", "Bold", "Italic", "Strikethrough", "Underline",
    ]);
    expect(document.querySelector('[data-icon="palette"], [aria-haspopup], .better-editor-mini-toolbar-color-menu')).toBeNull();
    expect(plugin.toolbar!.dom.getAttribute("aria-label")).toBe("Text formatting");
    plugin.destroy();
    expect(document.querySelector("button")).toBeNull();
  });

  it("does not mount a toolbar for an empty selection", () => {
    const { plugin, buttons } = setup({ anchor: 2, head: 2 });
    expect(plugin.toolbar).toBeNull();
    expect(buttons()).toHaveLength(0);
  });

  it("refreshes heading choices on an already visible toolbar", () => {
    const { refresh, buttons } = setup();
    refresh({ copyButtonAction: "heading-3" });
    expect(buttons()).toHaveLength(6);
    expect(buttons()[1].getAttribute("aria-label")).toBe("Heading 3");
    expect(buttons()[1].textContent).toBe("H3");
    refresh({ enabled: false });
    expect(buttons()).toHaveLength(0);
    refresh({ enabled: true });
    expect(buttons()).toHaveLength(6);
  });

  it("retains editor focus on pointer press and still runs the action", () => {
    const { buttons } = setup();
    const button = buttons()[2];
    const press = new MouseEvent("mousedown", { button: 0, cancelable: true });
    button.dispatchEvent(press);
    expect(press.defaultPrevented).toBe(true);
    button.click();
    expect(host.app.commands.executeCommandById).toHaveBeenCalledWith("editor:toggle-bold", host.app);
  });

  it("uses consistent bounds for a right-to-left selection", () => {
    expect(getRectFromPosCoords({ left: 100, right: 100, top: 0, bottom: 20 }, { left: 20, right: 20, top: 0, bottom: 20 }))
      .toEqual({ left: 20, right: 100, top: 0, bottom: 20, width: 80, height: 20, x: 20, y: 0 });
  });

  it("ignores an older position result after a newer one completes", async () => {
    const { plugin } = setup();
    let finishOld!: (value: { x: number; y: number }) => void;
    host.position.mockImplementationOnce(() => new Promise((resolve) => { finishOld = resolve; }));
    const rect = getRectFromPosCoords({ left: 0, right: 0, top: 0, bottom: 20 })!;
    const old = plugin.computePosition(rect);
    await plugin.computePosition(rect);
    expect(plugin.toolbar!.dom.style.transform).toBe("translate(10px,20px)");
    expect(plugin.toolbar!.dom.style.visibility).toBe("visible");
    finishOld({ x: 999, y: 999 });
    await old;
    expect(plugin.toolbar!.dom.style.transform).toBe("translate(10px,20px)");
  });

  it("ignores pending positioning after the toolbar is removed", async () => {
    const { plugin } = setup();
    let finish!: (value: { x: number; y: number }) => void;
    host.position.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const pending = plugin.computePosition(getRectFromPosCoords({ left: 0, right: 0, top: 0, bottom: 20 })!);
    plugin.destroy();
    finish({ x: 1, y: 2 });
    await pending;
    expect(plugin.toolbar).toBeNull();
  });

  it("handles positioning failures without an unhandled rejection", async () => {
    const { plugin } = setup();
    host.position.mockRejectedValueOnce(new Error("detached"));
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    await plugin.computePosition(getRectFromPosCoords({ left: 0, right: 0, top: 0, bottom: 20 })!);
    expect(plugin.toolbar).toBeNull();
    expect(warning).toHaveBeenCalledOnce();
    warning.mockRestore();
  });
});
