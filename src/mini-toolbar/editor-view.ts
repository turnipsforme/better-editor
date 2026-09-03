import type { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { editorInfoField, type Editor } from "obsidian";

export interface EditorWithCodeMirror extends Editor {
  cm?: EditorView;
  cmEditor?: EditorView;
  cm6?: EditorView;
}

export const isCodeMirrorView = (value: unknown): value is EditorView =>
  value instanceof EditorView;

export const getCodeMirrorView = (state: EditorState): EditorView | null => {
  const editor = state.field(editorInfoField).editor as EditorWithCodeMirror | undefined;
  const view = editor?.cm ?? editor?.cmEditor ?? editor?.cm6;
  return isCodeMirrorView(view) ? view : null;
};
