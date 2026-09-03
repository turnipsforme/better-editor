import type { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { editorInfoField, type Editor } from "obsidian";

export interface EditorWithCodeMirror extends Editor {
  cm?: EditorView;
  cmEditor?: EditorView;
  cm6?: EditorView;
}

const isEditorWithCodeMirror = (value: unknown): value is EditorWithCodeMirror =>
  value !== null && typeof value === "object";

export const isCodeMirrorView = (value: unknown): value is EditorView =>
  value instanceof EditorView;

export const getCodeMirrorView = (state: EditorState): EditorView | null => {
  const editor = state.field(editorInfoField).editor;
  if (!isEditorWithCodeMirror(editor)) return null;
  const view = editor?.cm ?? editor?.cmEditor ?? editor?.cm6;
  return isCodeMirrorView(view) ? view : null;
};
