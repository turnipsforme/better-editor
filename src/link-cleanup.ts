export type LinkedMentionAction = "plain-text" | "remove";

export interface PositionedLinkReference {
  original: string;
  displayText?: string;
  position: {
    start: { offset: number };
    end: { offset: number };
  };
}

export interface RewriteResult {
  text: string;
  count: number;
}

function unescapeDisplayText(text: string): string {
  return text.replace(/\\([\\|\[\]])/g, "$1");
}

function markdownLabel(original: string): string | null {
  const labelStart = original.startsWith("![") ? 2 : original.startsWith("[") ? 1 : -1;
  if (labelStart === -1) return null;

  let depth = 1;
  for (let index = labelStart; index < original.length; index++) {
    if (original[index] === "\\") {
      index++;
      continue;
    }
    if (original[index] === "[") depth++;
    if (original[index] !== "]") continue;
    depth--;
    if (depth === 0) return original.slice(labelStart, index);
  }
  return null;
}

function wikiAlias(original: string): string | null {
  const openingLength = original.startsWith("![[") ? 3 : original.startsWith("[[") ? 2 : 0;
  if (openingLength === 0 || !original.endsWith("]]")) return null;

  const inner = original.slice(openingLength, -2);
  for (let index = inner.length - 1; index >= 0; index--) {
    if (inner[index] !== "|" || inner[index - 1] === "\\") continue;
    return unescapeDisplayText(inner.slice(index + 1));
  }
  return null;
}

export function linkDisplayText(
  reference: PositionedLinkReference,
  fallbackText: string
): string {
  if (reference.displayText?.length) return reference.displayText;
  return wikiAlias(reference.original)
    ?? markdownLabel(reference.original)
    ?? fallbackText;
}

export function rewriteLinkedMentions(
  text: string,
  references: PositionedLinkReference[],
  action: LinkedMentionAction,
  fallbackText: string
): RewriteResult {
  const uniqueReferences = new Map<string, PositionedLinkReference>();
  for (const reference of references) {
    const key = `${reference.position.start.offset}:${reference.position.end.offset}`;
    uniqueReferences.set(key, reference);
  }

  const sorted = [...uniqueReferences.values()].sort(
    (left, right) => right.position.start.offset - left.position.start.offset
  );
  let rewritten = text;

  for (const reference of sorted) {
    const from = reference.position.start.offset;
    const to = reference.position.end.offset;
    if (from < 0 || to < from || to > text.length || text.slice(from, to) !== reference.original) {
      throw new Error("A linked note changed before its links could be updated.");
    }

    const replacement = action === "remove" ? "" : linkDisplayText(reference, fallbackText);
    rewritten = rewritten.slice(0, from) + replacement + rewritten.slice(to);
  }

  return { text: rewritten, count: sorted.length };
}
