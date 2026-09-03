export interface MoveLinksResult {
  text: string;
  movedCount: number;
}

export interface OrganizeNoteResult {
  text: string;
  movedLinkCount: number;
  movedTaskCount: number;
  movedNoteCount: number;
  bulletAddedCount: number;
  removedEmptyLineCount: number;
}

export interface OrganizeNoteOptions {
  organizeWebsiteLinks?: boolean;
}

interface Span {
  start: number;
  end: number;
  text: string;
  bare: boolean;
}

type OrganizeSectionType = "notes" | "tasks";

interface OrganizeSection {
  type: OrganizeSectionType;
  start: number;
  end: number;
}

interface TaskBlock {
  lines: string[];
}

const linksHeader = /^-\s+(?:\[\[Links\]\]|\[Links\]\(<Links\.md>\))\s*$/;

/**
 * Edit these aliases to teach the organizer additional names for the two
 * built-in sections. Matching ignores capitalization, punctuation, accents,
 * and surrounding emoji.
 */
export const ORGANIZE_HEADING_ALIASES: Record<OrganizeSectionType, string[]> = {
  notes: ["notes", "note"],
  tasks: ["tasks", "task", "todo", "to do", "todos", "to dos", "checklist"]
};

const markdownHeading = /^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/;
const taskItem = /^([ \t]*)(?:(?:[-+*])|\d+[.)])\s+\[[ xX]\](?:\s+.*)?$/;
const listItem = /^([ \t]*)(?:(?:[-+*])|\d+[.)])\s+/;

function findWebsiteLinks(line: string): Span[] {
  const bareLink = line.match(/^(\s*(?:(?:[-+*]|\d+[.)])\s+)?)(https?:\/\/\S+)\s*$/i);
  if (bareLink) {
    const start = bareLink[1].length;
    return [{ start, end: start + bareLink[2].length, text: bareLink[2], bare: true }];
  }

  const links: Span[] = [];
  let inCode = false;
  let codeFenceLength = 0;

  for (let start = 0; start < line.length; start++) {
    if (line[start] === "`" && line[start - 1] !== "\\") {
      let runLength = 1;
      while (line[start + runLength] === "`") runLength++;
      if (!inCode || runLength === codeFenceLength) {
        inCode = !inCode;
        codeFenceLength = inCode ? runLength : 0;
      }
      start += runLength - 1;
      continue;
    }
    if (inCode) continue;
    if (line[start] !== "[" || (start > 0 && line[start - 1] === "!")) continue;

    let labelEnd = start + 1;
    while (labelEnd < line.length) {
      if (line[labelEnd] === "\\") labelEnd++;
      else if (line[labelEnd] === "]") break;
      labelEnd++;
    }
    if (labelEnd >= line.length || line[labelEnd + 1] !== "(") continue;

    let depth = 1;
    let end = labelEnd + 2;
    while (end < line.length && depth > 0) {
      if (line[end] === "\\") {
        end += 2;
        continue;
      }
      if (line[end] === "(") depth++;
      if (line[end] === ")") depth--;
      end++;
    }
    if (depth !== 0) continue;

    const destination = line.slice(labelEnd + 2, end - 1).trimStart();
    if (!/^(?:<)?https?:\/\//i.test(destination)) continue;

    links.push({ start, end, text: line.slice(start, end), bare: false });
    start = end - 1;
  }

  return links;
}

function sectionBounds(lines: string[]): { start: number; end: number } | null {
  const start = lines.findIndex((line) => linksHeader.test(line));
  if (start === -1) return null;

  let end = start + 1;
  while (end < lines.length && (lines[end].trim() === "" || /^\s+/.test(lines[end]))) end++;
  return { start, end };
}

export function moveWebsiteLinks(text: string): MoveLinksResult {
  const eol = text.includes("\r\n") ? "\r\n" : "\n";
  const hadFinalEol = text.endsWith("\n");
  const lines = text.split(/\r?\n/);
  if (hadFinalEol) lines.pop();

  const originalSection = sectionBounds(lines);
  const moved: string[] = [];
  const remaining: string[] = [];
  let fencedCodeMarker: string | null = null;

  lines.forEach((line, lineIndex) => {
    const fence = line.match(/^\s*(`{3,}|~{3,})/);
    const isFenceLine = fence !== null;
    const inFencedCode = fencedCodeMarker !== null || isFenceLine;
    if (fence) {
      const marker = fence[1][0];
      if (fencedCodeMarker === marker) fencedCodeMarker = null;
      else if (fencedCodeMarker === null) fencedCodeMarker = marker;
    }
    const inLinksSection = originalSection !== null
      && lineIndex >= originalSection.start
      && lineIndex < originalSection.end;
    const foundSpans = inLinksSection || inFencedCode ? [] : findWebsiteLinks(line);
    const span = foundSpans.length === 1 ? foundSpans[0] : null;
    const prefix = span ? line.slice(0, span.start) : "";
    const suffix = span ? line.slice(span.end) : "";
    const spans = span
      && /^\s*(?:(?:[-+*]|\d+[.)])\s+)?$/.test(prefix)
      && /^\s*$/.test(suffix)
      ? [span]
      : [];

    if (spans.length === 0) {
      remaining.push(line);
      return;
    }

    moved.push(...spans.map((span) => span.bare ? `[](${span.text})` : span.text));
    let residue = line;
    for (let i = spans.length - 1; i >= 0; i--) {
      residue = residue.slice(0, spans[i].start) + residue.slice(spans[i].end);
    }

    if (residue.trim() !== "" && !/^\s*(?:[-+*]|\d+[.)])\s*$/.test(residue)) remaining.push(residue);
  });

  if (moved.length === 0) return { text, movedCount: 0 };

  const section = sectionBounds(remaining);
  if (section) {
    let insertAt = section.end;
    while (insertAt > section.start + 1 && remaining[insertAt - 1].trim() === "") insertAt--;
    let indent = "  ";
    for (let i = insertAt - 1; i > section.start; i--) {
      const item = remaining[i].match(/^(\s+)(?:[-+*]|\d+[.)])\s+/);
      if (item) {
        indent = item[1];
        break;
      }
    }
    const movedLines = moved.map((link) => `${indent}- ${link}`);
    remaining.splice(insertAt, 0, ...movedLines);
  } else {
    while (remaining.length > 0 && remaining[remaining.length - 1].trim() === "") remaining.pop();
    if (remaining.length > 0) remaining.push("");
    const movedLines = moved.map((link) => `  - ${link}`);
    remaining.push("- [[Links]]", ...movedLines);
  }

  return {
    text: remaining.join(eol) + (hadFinalEol ? eol : ""),
    movedCount: moved.length
  };
}

function normalizeHeading(text: string): string {
  return text
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function headingType(line: string): OrganizeSectionType | null {
  const match = line.match(markdownHeading);
  if (!match) return null;

  const normalized = normalizeHeading(match[2]);
  const matchedTypes = (Object.keys(ORGANIZE_HEADING_ALIASES) as OrganizeSectionType[])
    .filter((type) => ORGANIZE_HEADING_ALIASES[type].some((alias) => {
      const normalizedAlias = normalizeHeading(alias);
      return normalized === normalizedAlias
        || normalized.indexOf(`${normalizedAlias} `) === 0
        || normalized.indexOf(` ${normalizedAlias} `) !== -1
        || normalized.endsWith(` ${normalizedAlias}`);
    }));

  // A heading such as "Tasks and notes" is ambiguous, so leave it alone.
  return matchedTypes.length === 1 ? matchedTypes[0] : null;
}

function fencedCodeLines(lines: string[]): boolean[] {
  const inFencedCode: boolean[] = [];
  let marker: string | null = null;

  lines.forEach((line, index) => {
    const fence = line.match(/^\s*(`{3,}|~{3,})/);
    inFencedCode[index] = marker !== null || fence !== null;

    if (!fence) return;
    const fenceMarker = fence[1][0];
    if (marker === fenceMarker) marker = null;
    else if (marker === null) marker = fenceMarker;
  });

  return inFencedCode;
}

function frontmatterLines(lines: string[]): boolean[] {
  const protectedLines = lines.map(() => false);
  if (lines[0] !== "---") return protectedLines;

  for (let index = 0; index < lines.length; index++) {
    protectedLines[index] = true;
    if (index > 0 && (lines[index] === "---" || lines[index] === "...")) break;
  }
  return protectedLines;
}

function protectedLines(lines: string[]): boolean[] {
  const fenced = fencedCodeLines(lines);
  const frontmatter = frontmatterLines(lines);
  return lines.map((_, index) => fenced[index] || frontmatter[index]);
}

function removeEmptyLines(lines: string[]): { lines: string[]; removedCount: number } {
  const protectedLine = protectedLines(lines);
  const compacted: string[] = [];
  let removedCount = 0;

  lines.forEach((line, index) => {
    if (!protectedLine[index] && line.trim() === "") {
      removedCount++;
      return;
    }
    compacted.push(line);
  });

  return { lines: compacted, removedCount };
}

function findOrganizeSections(lines: string[], protectedLine: boolean[]): OrganizeSection[] {
  const headings: Array<{ index: number; level: number; type: OrganizeSectionType | null }> = [];

  lines.forEach((line, index) => {
    if (protectedLine[index]) return;
    const match = line.match(markdownHeading);
    if (!match) return;
    headings.push({ index, level: match[1].length, type: headingType(line) });
  });

  return headings
    .filter((heading): heading is { index: number; level: number; type: OrganizeSectionType } => heading.type !== null)
    .map((heading) => {
      const nextBoundary = headings.find((other) => other.index > heading.index && other.level <= heading.level);
      return {
        type: heading.type,
        start: heading.index,
        end: nextBoundary ? nextBoundary.index : lines.length
      };
    });
}

function findLinksSections(lines: string[], protectedLine: boolean[]): Array<{ start: number; end: number }> {
  const sections: Array<{ start: number; end: number }> = [];

  for (let start = 0; start < lines.length; start++) {
    if (protectedLine[start] || !linksHeader.test(lines[start])) continue;

    let end = start + 1;
    while (end < lines.length && (lines[end].trim() === "" || /^\s+/.test(lines[end]))) end++;
    sections.push({ start, end });
    start = end - 1;
  }

  return sections;
}

function isInSection(index: number, sections: Array<{ start: number; end: number }>): boolean {
  return sections.some((section) => index >= section.start && index < section.end);
}

function taskBlockEnd(lines: string[], start: number): number {
  const match = lines[start].match(taskItem);
  if (!match) return start + 1;

  const baseIndentLength = match[1].length;
  let end = start + 1;
  while (end < lines.length) {
    const line = lines[end];
    if (line.trim() === "") {
      end++;
      continue;
    }

    const indent = line.match(/^[ \t]*/)?.[0].length ?? 0;
    if (indent <= baseIndentLength) break;
    end++;
  }
  return end;
}

function isStructuralMarkdown(line: string): boolean {
  return /^\s*(?:#{1,6}\s|>|\||<!--|<\/?[A-Za-z][^>]*>|\[\^[^\]]+\]:|\$\$|(?:-{3,}|\*{3,}|_{3,})\s*$)/.test(line);
}

function isMovableNoteLine(lines: string[], index: number): boolean {
  const line = lines[index];
  if (line.trim() === "" || isStructuralMarkdown(line) || taskItem.test(line)) return false;
  if (/^[ \t]+/.test(line)) return false;

  const listMatch = line.match(listItem);
  // Moving or converting a parent line without its indented children can
  // detach data (including indented code), so leave those blocks untouched.
  const end = taskBlockEndForList(lines, index, listMatch ? listMatch[1].length : 0);
  return end === index + 1;
}

function taskBlockEndForList(lines: string[], start: number, baseIndentLength: number): number {
  let end = start + 1;
  while (end < lines.length) {
    const line = lines[end];
    if (line.trim() === "") {
      end++;
      continue;
    }
    const indent = line.match(/^[ \t]*/)?.[0].length ?? 0;
    if (indent <= baseIndentLength) break;
    end++;
  }
  return end;
}

function addBullet(line: string): string {
  if (listItem.test(line)) return line;
  const indentation = line.match(/^[ \t]*/)?.[0] ?? "";
  return `${indentation}- ${line.slice(indentation.length)}`;
}

function insertBeforeLinks(section: OrganizeSection, linksSections: Array<{ start: number; end: number }>): number {
  const firstLinkSection = linksSections.find((links) => links.start > section.start && links.start < section.end);
  return firstLinkSection ? firstLinkSection.start : section.end;
}

function joinLines(lines: string[], eol: string, hadFinalEol: boolean): string {
  if (lines.length === 0) return "";
  return lines.join(eol) + (hadFinalEol ? eol : "");
}

/**
 * Safely organize a note without reinterpreting structured Markdown. Website
 * links are delegated to moveWebsiteLinks so they retain its exact guardrails.
 */
export function organizeCurrentNote(
  text: string,
  options: OrganizeNoteOptions = {}
): OrganizeNoteResult {
  const linkResult = options.organizeWebsiteLinks === false
    ? { text, movedCount: 0 }
    : moveWebsiteLinks(text);
  const eol = linkResult.text.includes("\r\n") ? "\r\n" : "\n";
  const hadFinalEol = linkResult.text.endsWith("\n");
  const initialLines = linkResult.text.split(/\r?\n/);
  if (hadFinalEol) initialLines.pop();

  const compacted = removeEmptyLines(initialLines);
  const lines = compacted.lines;
  const protectedLine = protectedLines(lines);
  const organizeSections = findOrganizeSections(lines, protectedLine);
  const taskSections = organizeSections.filter((section) => section.type === "tasks");
  const notesSections = organizeSections.filter((section) => section.type === "notes");
  const linksSections = findLinksSections(lines, protectedLine);
  const taskTarget = taskSections[0];
  const notesTarget = notesSections[0];

  const taskIndexes = new Set<number>();
  const taskBlocks: TaskBlock[] = [];
  if (taskTarget) {
    for (let index = 0; index < lines.length; index++) {
      const match = !protectedLine[index] ? lines[index].match(taskItem) : null;
      // A top-level task can be moved with all of its indented Markdown
      // children. Indented tasks may belong to a parent elsewhere, so retain
      // them in place rather than risking an orphaned subtree.
      if (!match || match[1] !== "" || isInSection(index, taskSections) || isInSection(index, linksSections)) continue;

      const end = taskBlockEnd(lines, index);
      const blockLines = lines.slice(index, end);
      if (blockLines.some((_, blockIndex) => protectedLine[index + blockIndex])) continue;

      taskBlocks.push({ lines: blockLines });
      for (let taskIndex = index; taskIndex < end; taskIndex++) taskIndexes.add(taskIndex);
      index = end - 1;
    }
  }

  const noteIndexes = new Set<number>();
  const movedNotes: string[] = [];
  let bulletAddedCount = 0;

  for (let index = 0; index < lines.length; index++) {
    if (taskIndexes.has(index) || protectedLine[index] || isInSection(index, linksSections)) continue;
    if (headingType(lines[index]) !== null || markdownHeading.test(lines[index])) continue;
    if (!isMovableNoteLine(lines, index)) continue;

    const bulleted = addBullet(lines[index]);
    if (bulleted !== lines[index]) bulletAddedCount++;

    if (isInSection(index, notesSections) || !notesTarget) {
      lines[index] = bulleted;
    } else {
      movedNotes.push(bulleted);
      noteIndexes.add(index);
    }
  }

  const remaining = lines.filter((_, index) => !taskIndexes.has(index) && !noteIndexes.has(index));

  if (taskBlocks.length > 0) {
    const remainingProtected = protectedLines(remaining);
    const remainingTaskTarget = findOrganizeSections(remaining, remainingProtected)
      .find((section) => section.type === "tasks");
    if (remainingTaskTarget) {
      let insertAt = remainingTaskTarget.start + 1;
      for (let index = remainingTaskTarget.end - 1; index > remainingTaskTarget.start; index--) {
        const taskMatch = remaining[index].match(taskItem);
        if (taskMatch && taskMatch[1] === "") {
          insertAt = taskBlockEnd(remaining, index);
          break;
        }
      }
      const flattenedTasks = taskBlocks.reduce<string[]>((all, block) => all.concat(block.lines), []);
      remaining.splice(insertAt, 0, ...flattenedTasks);
    }
  }

  if (movedNotes.length > 0) {
    const remainingProtected = protectedLines(remaining);
    const remainingNotesTarget = findOrganizeSections(remaining, remainingProtected)
      .find((section) => section.type === "notes");
    if (remainingNotesTarget) {
      const remainingLinksSections = findLinksSections(remaining, remainingProtected);
      remaining.splice(insertBeforeLinks(remainingNotesTarget, remainingLinksSections), 0, ...movedNotes);
    }
  }

  return {
    text: joinLines(remaining, eol, hadFinalEol),
    movedLinkCount: linkResult.movedCount,
    movedTaskCount: taskBlocks.length,
    movedNoteCount: movedNotes.length,
    bulletAddedCount,
    removedEmptyLineCount: compacted.removedCount
  };
}
