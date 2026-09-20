import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { App, Notice, editorInfoField } from "obsidian";

import { setUnderlineEffect } from "./colorRanges";
import { getCodeMirrorView } from "./editor-view";
import { toHeadingLine } from "./heading";

interface AppWithCommands extends App {
  commands: {
    executeCommandById(id: string, ...args: unknown[]): unknown;
  };
}

export const cutText = async (state: EditorState): Promise<void> => {
  const editor = getEditorFromState(state);
  if (!editor) return;
  const text = editor.getSelection();
  const original = editor.getValue();
  const from = editor.getCursor("from");
  const to = editor.getCursor("to");
  try {
    await window.navigator.clipboard.writeText(text);
    const currentFrom = editor.getCursor("from");
    const currentTo = editor.getCursor("to");
    if (editor.getValue() !== original || from.line !== currentFrom.line || from.ch !== currentFrom.ch
      || to.line !== currentTo.line || to.ch !== currentTo.ch) return;
    editor.replaceSelection("");
  } catch {
    new Notice("Could not copy to the clipboard. Your text has been kept.");
  }
};

export const copyText = async (state: EditorState): Promise<void> => {
  const editor = getEditorFromState(state);
  if (!editor) return;
  try {
    await window.navigator.clipboard.writeText(editor.getSelection());
  } catch {
    new Notice("Could not copy to the clipboard.");
  }
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
