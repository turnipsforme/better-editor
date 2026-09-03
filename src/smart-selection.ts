import { Notice, type Editor, type EditorPosition } from "obsidian";

const LIST_MARKER = /^(\s*)(?:(?:[-*+])|(?:\d+[.)]))\s+(?:\[[ xX]\]\s+)?/;
const HEADING = /^#{1,6}\s+\S/;

interface EditorRange {
  from: EditorPosition;
  to: EditorPosition;
}

function samePosition(left: EditorPosition, right: EditorPosition): boolean {
  return left.line === right.line && left.ch === right.ch;
}

export function getParagraphRange(editor: Editor): EditorRange | null {
  const totalLines = editor.lineCount();
  if (totalLines === 0) return null;

  const cursor = editor.getCursor();
  const line = Math.min(cursor.line, totalLines - 1);
  const currentLine = editor.getLine(line);
  if (currentLine.trim() === "") return null;

  let startLine = line;
  if (!LIST_MARKER.test(currentLine)) {
    while (startLine > 0) {
      const previousLine = editor.getLine(startLine - 1);
      if (previousLine.trim() === "") break;

      startLine--;
      if (LIST_MARKER.test(previousLine)) break;
    }
  }

  let endLine = line;
  while (endLine + 1 < totalLines) {
    const nextLine = editor.getLine(endLine + 1);
    if (nextLine.trim() === "" || LIST_MARKER.test(nextLine)) break;
    endLine++;
  }

  const startCh = (editor.getLine(startLine).match(LIST_MARKER) ?? [""])[0].length;
  const endCh = editor.getLine(endLine).length;
  if (startLine === endLine && startCh >= endCh) return null;

  return {
    from: { line: startLine, ch: startCh },
    to: { line: endLine, ch: endCh }
  };
}

export function getCurrentHeadingBodyRange(editor: Editor): EditorRange | null {
  const totalLines = editor.lineCount();
  if (totalLines === 0) return null;

  const cursor = editor.getCursor();
  const line = Math.min(cursor.line, totalLines - 1);
  let headingLine = line;
  while (headingLine >= 0 && !HEADING.test(editor.getLine(headingLine))) headingLine--;
  if (headingLine < 0) return null;

  let nextHeadingLine = headingLine + 1;
  while (nextHeadingLine < totalLines && !HEADING.test(editor.getLine(nextHeadingLine))) {
    nextHeadingLine++;
  }

  let startLine = headingLine + 1;
  let endLine = nextHeadingLine - 1;
  while (startLine <= endLine && editor.getLine(startLine).trim() === "") startLine++;
  while (endLine >= startLine && editor.getLine(endLine).trim() === "") endLine--;
  if (startLine > endLine) return null;

  return {
    from: { line: startLine, ch: 0 },
    to: { line: endLine, ch: editor.getLine(endLine).length }
  };
}

function selectionMatchesRange(editor: Editor, range: EditorRange): boolean {
  return samePosition(editor.getCursor("from"), range.from)
    && samePosition(editor.getCursor("to"), range.to);
}

export function selectAllExceptTopHeading(editor: Editor): void {
  const totalLines = editor.lineCount();
  if (totalLines === 0) return;

  let startLine = 0;
  while (startLine < totalLines && editor.getLine(startLine).trim() === "") startLine++;
  if (startLine < totalLines && /^#\s+/.test(editor.getLine(startLine))) startLine++;

  if (startLine >= totalLines) {
    new Notice("Nothing to select.");
    return;
  }

  const lastLine = totalLines - 1;
  editor.setSelection(
    { line: startLine, ch: 0 },
    { line: lastLine, ch: editor.getLine(lastLine).length }
  );
}

export function expandSmartSelection(editor: Editor): void {
  const headingBodyRange = getCurrentHeadingBodyRange(editor);
  if (headingBodyRange && selectionMatchesRange(editor, headingBodyRange)) {
    selectAllExceptTopHeading(editor);
    return;
  }

  const paragraphRange = getParagraphRange(editor);
  if (paragraphRange && !selectionMatchesRange(editor, paragraphRange)) {
    editor.setSelection(paragraphRange.from, paragraphRange.to);
    return;
  }

  if (headingBodyRange && !selectionMatchesRange(editor, headingBodyRange)) {
    editor.setSelection(headingBodyRange.from, headingBodyRange.to);
    return;
  }

  selectAllExceptTopHeading(editor);
}
