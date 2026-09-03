import { EditorSelection, Prec, Transaction, type Extension } from "@codemirror/state";
import { EditorView, keymap, type ViewUpdate } from "@codemirror/view";

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
    selection: EditorSelection.create(ranges),
    userEvent: backward ? "delete.backward" : "delete.forward",
    annotations: Transaction.addToHistory.of(true),
    scrollIntoView: true
  });
  return true;
}

function finishTaskMarkerDeletion(view: EditorView, changes: ViewUpdate["changes"]): boolean {
  if (view.state.facet(EditorView.editable) !== true || view.composing) return false;

  const removals: RemovalRange[] = [];
  const ranges = [];
  for (const selectionRange of view.state.selection.ranges) {
    if (!selectionRange.empty) return false;

    const line = view.state.doc.lineAt(selectionRange.head);
    const match = line.text.match(TASK_MARKER);
    if (!match || match.index !== 0) return false;

    const prefixEnd = line.from + match[0].length;
    const trailingSpaceFrom = prefixEnd - 1;
    if (changes.touchesRange(trailingSpaceFrom, prefixEnd) !== "cover") return false;

    removals.push({ from: line.from, to: trailingSpaceFrom });
    ranges.push(EditorSelection.cursor(line.from));
  }

  if (removals.length === 0) return false;
  view.dispatch({
    changes: removals,
    selection: EditorSelection.create(ranges),
    userEvent: "delete.backward",
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

  const deletionObserver = EditorView.updateListener.of((update) => {
    if (!isEnabled() || !update.docChanged
      || !update.transactions.some((transaction) => transaction.isUserEvent("delete"))) return;

    for (const transaction of update.transactions) {
      if (!transaction.docChanged || transaction.annotation(Transaction.addToHistory) === false) continue;
      if (finishTaskMarkerDeletion(update.view, transaction.changes)) break;
    }
  });

  return [taskMarkerKeymap, deletionObserver];
}
