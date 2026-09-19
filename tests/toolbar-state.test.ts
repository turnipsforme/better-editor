import { describe, expect, it, vi } from "vitest";
import { EditorState, StateField } from "@codemirror/state";
import type { App } from "obsidian";

vi.mock("obsidian", async () => {
  const { StateField } = await import("@codemirror/state");
  return {
    editorInfoField: StateField.define({ create: () => ({ file: { path: "Test.md" }, editor: {} }), update: (value: unknown) => value }),
    Notice: class {}, App: class {}, BaseComponent: class {}, ButtonComponent: class {}, Component: class {}, Menu: class {}, setIcon: vi.fn(),
  };
});

import { editorInfoField } from "obsidian";
import { createColorExtension, setTextColorEffect } from "../src/mini-toolbar/colorRanges";
import { cutText } from "../src/mini-toolbar/defaultCommand";
import { cursorTooltipField } from "../src/mini-toolbar/toolbar";
import { DEFAULT_TOOLBAR_SETTINGS } from "../src/mini-toolbar/toolbar-settings";

describe("toolbar state", () => {
  it("orders selection offsets numerically", () => {
    const field = cursorTooltipField({} as App, () => DEFAULT_TOOLBAR_SETTINGS);
    const state = EditorState.create({ doc: "0123456789abcdef", selection: { anchor: 12, head: 8 }, extensions: [field] });
    expect(state.field(field)).toMatchObject({ start: 8, end: 12 });
  });

  it("reuses decorations for cursor moves and avoids saving unformatted edits", () => {
    const save = vi.fn();
    const field = createColorExtension({ load: () => null, save }) as StateField<unknown>;
    let state = EditorState.create({ doc: "hello", extensions: [editorInfoField, field] });
    const initial = state.field(field);
    state = state.update({ selection: { anchor: 2 } }).state;
    expect(state.field(field)).toBe(initial);
    state = state.update({ changes: { from: 5, insert: "!" } }).state;
    expect(save).not.toHaveBeenCalled();
    state = state.update({ effects: setTextColorEffect.of({ from: 0, to: 5, color: "red" }) }).state;
    expect(save).toHaveBeenCalledTimes(1);
    const colored = state.field(field);
    state = state.update({ selection: { anchor: 3 } }).state;
    expect(state.field(field)).toBe(colored);
    state = state.update({ changes: { from: 0, to: 5, insert: "" } }).state;
    expect(save).toHaveBeenCalledTimes(2);
    expect(save.mock.lastCall?.[1].text).toEqual([]);
  });

  it("hides and restores saved styles when the feature is toggled", () => {
    let enabled = true;
    const field = createColorExtension({ load: () => ({ text: [{ from: 0, to: 5, color: "red" }], bg: [] }), save: vi.fn() }, () => enabled) as StateField<{ decorations: { size: number } }>;
    let state = EditorState.create({ doc: "hello", extensions: [editorInfoField, field] });
    expect(state.field(field).decorations.size).toBe(1);
    enabled = false;
    state = state.update({}).state;
    expect(state.field(field).decorations.size).toBe(0);
    enabled = true;
    state = state.update({}).state;
    expect(state.field(field).decorations.size).toBe(1);
  });
});


describe("clipboard safety", () => {
  it("keeps the selection if the clipboard rejects a cut", async () => {
    const replaceSelection = vi.fn();
    const editor = { getValue: () => "hello", getSelection: () => "hello", getCursor: () => ({ line: 0, ch: 0 }), replaceSelection };
    vi.stubGlobal("window", { navigator: { clipboard: { writeText: vi.fn().mockRejectedValue(new Error("denied")) } } });
    const state = { field: () => ({ editor }) } as unknown as EditorState;
    await cutText(state);
    expect(replaceSelection).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("waits for the clipboard and does not delete text edited while waiting", async () => {
    let complete!: () => void;
    let text = "hello";
    const replaceSelection = vi.fn();
    const editor = { getValue: () => text, getSelection: () => "hello", getCursor: () => ({ line: 0, ch: 0 }), replaceSelection };
    vi.stubGlobal("window", { navigator: { clipboard: { writeText: () => new Promise<void>((resolve) => { complete = resolve; }) } } });
    const cutting = cutText({ field: () => ({ editor }) } as unknown as EditorState);
    expect(replaceSelection).not.toHaveBeenCalled();
    text = "hello world";
    complete();
    await cutting;
    expect(replaceSelection).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
