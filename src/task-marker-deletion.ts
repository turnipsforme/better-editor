import { EditorSelection, Prec, Transaction, type Extension } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";

const TASK_MARKER = /^(?<bullet>\s*-\s\[(?<mark>[ xX])\]\s)/;

interface RemovalRange {
  from: number;
  to: number;
}

export function findTaskMarkerRemoval(
  lineText: string,
  lineStart: number,
  cursor: number,
  backward: boolean
): RemovalRange | null {
  const match = lineText.match(TASK_MARKER);
  if (!match || match.index !== 0) return null;

  const prefixEnd = lineStart + match[0].length;
  const requiredCursor = backward ? prefixEnd : prefixEnd - 1;
  if (cursor !== requiredCursor) return null;
  return { from: lineStart, to: prefixEnd };
}

function removeTaskMarker(view: EditorView, backward: boolean): boolean {
  if (view.state.facet(EditorView.editable) !== true) return false;

  const changes: RemovalRange[] = [];
  const ranges = [];
  for (const range of view.state.selection.ranges) {
    if (!range.empty) return false;

    const line = view.state.doc.lineAt(range.head);
    const removal = findTaskMarkerRemoval(line.text, line.from, range.head, backward);
    if (!removal) return false;

    changes.push(removal);
    ranges.push(EditorSelection.cursor(line.from));
  }

  if (changes.length === 0) return false;
  view.dispatch({
    changes,
    selection: EditorSelection.create(ranges).map(view.state.changes(changes)),
    userEvent: backward ? "delete.backward" : "delete.forward",
    annotations: Transaction.addToHistory.of(true),
    scrollIntoView: true
  });
  return true;
}

export function createTaskMarkerDeletionExtensions(isEnabled: () => boolean): Extension[] {
  const taskMarkerKeymap = Prec.high(keymap.of([
    {
      key: "Backspace",
      run: (view) => isEnabled() && removeTaskMarker(view, true)
    },
    {
      key: "Delete",
      run: (view) => isEnabled() && removeTaskMarker(view, false)
    }
  ]));

  return [taskMarkerKeymap];
}
