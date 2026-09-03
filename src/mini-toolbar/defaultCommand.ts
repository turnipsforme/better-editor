import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { App, editorInfoField } from "obsidian";

import { setBgColorEffect, setTextColorEffect, setUnderlineEffect } from "./colorRanges";
import { getCodeMirrorView } from "./editor-view";
import { toHeadingLine } from "./heading";

interface AppWithCommands extends App {
  commands: {
    executeCommandById(id: string, ...args: unknown[]): unknown;
  };
}

export const cutText = (state: EditorState) => {
  const editor = getEditorFromState(state);
  if (!editor) return;
  const originText = editor.getSelection();
  void window.navigator.clipboard.writeText(editor.getSelection());
  editor.replaceSelection("", originText);
};

export const copyText = (state: EditorState) => {
  const editor = getEditorFromState(state);
  if (!editor) return;
  void window.navigator.clipboard.writeText(editor.getSelection());
};

// Apply a markdown heading to the full line containing the selection. Any
// existing ATX heading marker is replaced instead of being added to the text.
export const applyHeading = (state: EditorState, level: number) => {
  const view = getViewFromState(state);
  if (!view) return;

  const currentState = view.state;
  const line = currentState.doc.lineAt(currentState.selection.main.from);
  const updatedLine = toHeadingLine(line.text, level);

  view.dispatch({
    changes: { from: line.from, to: line.to, insert: updatedLine },
  });
};

export const boldText = (app: App) => {
  (app as AppWithCommands).commands.executeCommandById("editor:toggle-bold", app);
};

export const strikethroughText = (app: App) => {
  (app as AppWithCommands).commands.executeCommandById("editor:toggle-strikethrough", app);
};

export const italicText = (app: App) => {
  (app as AppWithCommands).commands.executeCommandById("editor:toggle-italics", app);
};

export const getEditorFromState = (state: EditorState) => {
  const { editor } = state.field(editorInfoField);
  return editor;
};

const getViewFromState = (state: EditorState): EditorView | null => {
  try {
    return getCodeMirrorView(state);
  } catch {
    return null;
  }
};

// === Text color helpers ===
// Notion-like text color palette (approximate hex values)
export const NOTION_TEXT_COLOR_MAP: Record<string, string> = {
  Gray: "#9B9A97",
  Brown: "#64473A",
  Orange: "#D9730D",
  Yellow: "#DFAB01",
  Green: "#0F7B6C",
  Blue: "#0B6E99",
  Purple: "#6940A5",
  Pink: "#AD1A72",
  Red: "#E03E3E",
};
export const NOTION_TEXT_COLOR_NAMES: string[] = [
  "Default",
  ...Object.keys(NOTION_TEXT_COLOR_MAP),
];

// Notion-like highlight background palette (approximate)
export const NOTION_BG_COLOR_NAMES: string[] = [
  "Default",
  "Gray",
  "Brown",
  "Orange",
  "Yellow",
  "Green",
  "Blue",
  "Purple",
  "Pink",
  "Red",
];

// Apply or remove text color via CM6 decorations and colorRanges state.
// This no longer mutates the underlying markdown with HTML; it only updates
// persistent ranges stored in data.json.
export const setTextColor = (state: EditorState, colorCss: string | null) => {
  const view = getViewFromState(state);
  if (!view) return;

  // Always read the *current* selection from the live EditorView to avoid
  // mismatches with the captured CM6 state used to create the toolbar.
  const sel = view.state.selection.main;
  if (sel.empty) return;

  const from = sel.from;
  const to = sel.to;

  view.dispatch({
    effects: setTextColorEffect.of({ from, to, color: colorCss }),
  });
};

export const setTextColorByName = (state: EditorState, name: string) => {
  if (name === "Default") return setTextColor(state, null);
  const hex = NOTION_TEXT_COLOR_MAP[name];
  if (hex) setTextColor(state, hex);
};

// Apply or remove background highlight via CM6 decorations and colorRanges.
export const setBgColor = (state: EditorState, colorCss: string | null) => {
  const view = getViewFromState(state);
  if (!view) return;

  const sel = view.state.selection.main;
  if (sel.empty) return;

  const from = sel.from;
  const to = sel.to;

  view.dispatch({
    effects: setBgColorEffect.of({ from, to, color: colorCss }),
  });
};

export const setBgColorByName = (state: EditorState, name: string) => {
  if (name === "Default") return setBgColor(state, null);
  const varName = `var(--better-editor-toolbar-bg-${name.toLowerCase()})`;
  setBgColor(state, varName);
};

// Toggle underline decoration over the current selection.
export const toggleUnderline = (state: EditorState, enable?: boolean) => {
  const view = getViewFromState(state);
  if (!view) return;

  const sel = view.state.selection.main;
  if (sel.empty) return;

  const from = sel.from;
  const to = sel.to;

  view.dispatch({
    effects: setUnderlineEffect.of({ from, to, enable }),
  });
};
