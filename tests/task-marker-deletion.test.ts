import { describe, expect, it } from "vitest";
import { findTaskMarkerRemoval } from "../src/task-marker-deletion";

describe("findTaskMarkerRemoval", () => {
  it("removes the full task marker when Backspace reaches it", () => {
    expect(findTaskMarkerRemoval("- [ ] Write", 20, 26, true)).toEqual({ from: 20, to: 26 });
    expect(findTaskMarkerRemoval("  - [x] Done", 0, 8, true)).toEqual({ from: 0, to: 8 });
  });

  it("removes the full task marker when Delete reaches its last character", () => {
    expect(findTaskMarkerRemoval("- [X] Done", 0, 5, false)).toEqual({ from: 0, to: 6 });
  });

  it("does not claim normal text or a cursor elsewhere on the task", () => {
    expect(findTaskMarkerRemoval("Plain text", 0, 0, true)).toBeNull();
    expect(findTaskMarkerRemoval("- [ ] Task", 0, 2, true)).toBeNull();
  });
});

import { EditorSelection, EditorState, type TransactionSpec } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { createTaskMarkerDeletionExtensions } from "../src/task-marker-deletion";

describe("task marker transactions", () => {
  it("maps each cursor after removing several markers", () => {
    let state = EditorState.create({
      doc: "- [ ] One\n- [ ] Two",
      selection: EditorSelection.create([EditorSelection.cursor(6), EditorSelection.cursor(16)]),
      extensions: [EditorState.allowMultipleSelections.of(true), createTaskMarkerDeletionExtensions(() => true)],
    });
    const view = {
      get state() { return state; },
      dispatch: (spec: TransactionSpec) => { state = state.update(spec).state; },
    } as unknown as EditorView;
    const binding = state.facet(keymap).flat().find((binding) => binding.key === "Backspace")!;
    expect(binding.run!(view)).toBe(true);
    expect(state.doc.toString()).toBe("One\nTwo");
    expect(state.selection.ranges.map((range) => range.head)).toEqual([0, 4]);
  });

  it("leaves ordinary deletion transactions alone", () => {
    const state = EditorState.create({ doc: "- [ ]  Text", extensions: createTaskMarkerDeletionExtensions(() => true) });
    const transaction = state.update({ changes: { from: 5, to: 6 }, selection: { anchor: 5 }, userEvent: "delete.backward" });
    expect(transaction.newDoc.toString()).toBe("- [ ] Text");
    expect(transaction.newSelection.main.head).toBe(5);
  });
});
