var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => BetterEditorPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian5 = require("obsidian");

// src/delete-current-file.ts
var import_obsidian = require("obsidian");

// src/link-cleanup.ts
function unescapeDisplayText(text) {
  return text.replace(/\\([\\|\[\]])/g, "$1");
}
function markdownLabel(original) {
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
function wikiAlias(original) {
  const openingLength = original.startsWith("![[") ? 3 : original.startsWith("[[") ? 2 : 0;
  if (openingLength === 0 || !original.endsWith("]]")) return null;
  const inner = original.slice(openingLength, -2);
  for (let index = inner.length - 1; index >= 0; index--) {
    if (inner[index] !== "|" || inner[index - 1] === "\\") continue;
    return unescapeDisplayText(inner.slice(index + 1));
  }
  return null;
}
function linkDisplayText(reference, fallbackText) {
  var _a, _b, _c;
  if ((_a = reference.displayText) == null ? void 0 : _a.length) return reference.displayText;
  return (_c = (_b = wikiAlias(reference.original)) != null ? _b : markdownLabel(reference.original)) != null ? _c : fallbackText;
}
function rewriteLinkedMentions(text, references, action, fallbackText) {
  const uniqueReferences = /* @__PURE__ */ new Map();
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

// src/delete-current-file.ts
function resolvesToTarget(app, reference, source, target) {
  var _a;
  const linkPath = (0, import_obsidian.parseLinktext)(reference.link).path;
  return ((_a = app.metadataCache.getFirstLinkpathDest(linkPath, source.path)) == null ? void 0 : _a.path) === target.path;
}
function frontmatterReferences(text, cache, links) {
  const bounds = cache.frontmatterPosition;
  if (!bounds || links.length === 0) return [];
  const start = bounds.start.offset;
  const end = bounds.end.offset;
  const references = [];
  const uniqueLinks = /* @__PURE__ */ new Map();
  for (const link of links) {
    if (link.original.length > 0) uniqueLinks.set(link.original, link);
  }
  for (const link of uniqueLinks.values()) {
    let from = start;
    while (from < end) {
      const found = text.indexOf(link.original, from);
      if (found === -1 || found >= end) break;
      references.push({
        original: link.original,
        displayText: link.displayText,
        position: {
          start: { offset: found },
          end: { offset: found + link.original.length }
        }
      });
      from = found + link.original.length;
    }
  }
  return references;
}
function uniqueReferenceCount(references) {
  return new Set(references.map((reference) => `${reference.position.start.offset}:${reference.position.end.offset}`)).size;
}
var CurrentFileDeletion = class {
  constructor(app, getAction) {
    this.app = app;
    this.getAction = getAction;
  }
  async run(target) {
    const confirmed = await this.app.fileManager.promptForDeletion(target);
    if (!confirmed) return;
    let staged = [];
    try {
      staged = await this.stageLinkedMentionChanges(target);
      await this.applyChanges(staged);
      try {
        await this.app.fileManager.trashFile(target);
      } catch (error) {
        await this.rollbackChanges(staged);
        throw error;
      }
      const mentionCount = staged.reduce((total, item) => total + item.mentionCount, 0);
      if (mentionCount > 0) {
        const action = this.getAction() === "remove" ? "removed" : "changed to plain text";
        new import_obsidian.Notice(
          `Deleted ${target.name}; ${mentionCount} linked mention${mentionCount === 1 ? " was" : "s were"} ${action}.`
        );
      }
    } catch (error) {
      console.error("Better Editor could not safely delete the current file.", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      new import_obsidian.Notice(`Could not delete ${target.name}: ${message}`);
    }
  }
  async stageLinkedMentionChanges(target) {
    var _a, _b, _c, _d, _e;
    const action = this.getAction();
    const staged = [];
    for (const source of this.app.vault.getMarkdownFiles()) {
      if (source.path === target.path) continue;
      const expectedCount = (_b = (_a = this.app.metadataCache.resolvedLinks[source.path]) == null ? void 0 : _a[target.path]) != null ? _b : 0;
      if (expectedCount === 0) continue;
      const cache = this.app.metadataCache.getFileCache(source);
      if (!cache) throw new Error(`Obsidian has not finished indexing ${source.path}.`);
      const bodyReferences = [...(_c = cache.links) != null ? _c : [], ...(_d = cache.embeds) != null ? _d : []].filter((reference) => resolvesToTarget(this.app, reference, source, target));
      const matchingFrontmatterLinks = ((_e = cache.frontmatterLinks) != null ? _e : []).filter((reference) => resolvesToTarget(this.app, reference, source, target));
      const originalText = await this.app.vault.read(source);
      const references = [
        ...bodyReferences,
        ...frontmatterReferences(originalText, cache, matchingFrontmatterLinks)
      ];
      if (uniqueReferenceCount(references) !== expectedCount) {
        throw new Error(`Could not safely locate every linked mention in ${source.path}.`);
      }
      const result = rewriteLinkedMentions(originalText, references, action, target.basename);
      if (result.count === 0) continue;
      staged.push({
        file: source,
        originalText,
        updatedText: result.text,
        mentionCount: result.count
      });
    }
    return staged;
  }
  async applyChanges(staged) {
    const applied = [];
    try {
      for (const item of staged) {
        await this.app.vault.process(item.file, (currentText) => {
          if (currentText !== item.originalText) {
            throw new Error(`${item.file.path} changed while the file was being deleted.`);
          }
          return item.updatedText;
        });
        applied.push(item);
      }
    } catch (error) {
      await this.rollbackChanges(applied);
      throw error;
    }
  }
  async rollbackChanges(staged) {
    let incompleteRollback = false;
    for (const item of [...staged].reverse()) {
      try {
        await this.app.vault.process(item.file, (currentText) => {
          if (currentText !== item.updatedText) {
            incompleteRollback = true;
            return currentText;
          }
          return item.originalText;
        });
      } catch (error) {
        incompleteRollback = true;
        console.error(`Better Editor could not restore ${item.file.path}.`, error);
      }
    }
    if (incompleteRollback) {
      throw new Error("The deletion was stopped, but at least one linked note could not be restored automatically.");
    }
  }
};

// src/note-organizer.ts
var linksHeader = /^-\s+(?:\[\[Links\]\]|\[Links\]\(<Links\.md>\))\s*$/;
var ORGANIZE_HEADING_ALIASES = {
  notes: ["notes", "note"],
  tasks: ["tasks", "task", "todo", "to do", "todos", "to dos", "checklist"]
};
var markdownHeading = /^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/;
var taskItem = /^([ \t]*)(?:(?:[-+*])|\d+[.)])\s+\[[ xX]\](?:\s+.*)?$/;
var listItem = /^([ \t]*)(?:(?:[-+*])|\d+[.)])\s+/;
function findWebsiteLinks(line) {
  const bareLink = line.match(/^(\s*(?:(?:[-+*]|\d+[.)])\s+)?)(https?:\/\/\S+)\s*$/i);
  if (bareLink) {
    const start = bareLink[1].length;
    return [{ start, end: start + bareLink[2].length, text: bareLink[2], bare: true }];
  }
  const links = [];
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
    if (line[start] !== "[" || start > 0 && line[start - 1] === "!") continue;
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
function sectionBounds(lines) {
  const start = lines.findIndex((line) => linksHeader.test(line));
  if (start === -1) return null;
  let end = start + 1;
  while (end < lines.length && (lines[end].trim() === "" || /^\s+/.test(lines[end]))) end++;
  return { start, end };
}
function moveWebsiteLinks(text) {
  const eol = text.includes("\r\n") ? "\r\n" : "\n";
  const hadFinalEol = text.endsWith("\n");
  const lines = text.split(/\r?\n/);
  if (hadFinalEol) lines.pop();
  const originalSection = sectionBounds(lines);
  const moved = [];
  const remaining = [];
  let fencedCodeMarker = null;
  lines.forEach((line, lineIndex) => {
    const fence = line.match(/^\s*(`{3,}|~{3,})/);
    const isFenceLine = fence !== null;
    const inFencedCode = fencedCodeMarker !== null || isFenceLine;
    if (fence) {
      const marker = fence[1][0];
      if (fencedCodeMarker === marker) fencedCodeMarker = null;
      else if (fencedCodeMarker === null) fencedCodeMarker = marker;
    }
    const inLinksSection = originalSection !== null && lineIndex >= originalSection.start && lineIndex < originalSection.end;
    const foundSpans = inLinksSection || inFencedCode ? [] : findWebsiteLinks(line);
    const span = foundSpans.length === 1 ? foundSpans[0] : null;
    const prefix = span ? line.slice(0, span.start) : "";
    const suffix = span ? line.slice(span.end) : "";
    const spans = span && /^\s*(?:(?:[-+*]|\d+[.)])\s+)?$/.test(prefix) && /^\s*$/.test(suffix) ? [span] : [];
    if (spans.length === 0) {
      remaining.push(line);
      return;
    }
    moved.push(...spans.map((span2) => span2.bare ? `[](${span2.text})` : span2.text));
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
function normalizeHeading(text) {
  return text.normalize("NFKD").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}
function headingType(line) {
  const match = line.match(markdownHeading);
  if (!match) return null;
  const normalized = normalizeHeading(match[2]);
  const matchedTypes = Object.keys(ORGANIZE_HEADING_ALIASES).filter((type) => ORGANIZE_HEADING_ALIASES[type].some((alias) => {
    const normalizedAlias = normalizeHeading(alias);
    return normalized === normalizedAlias || normalized.indexOf(`${normalizedAlias} `) === 0 || normalized.indexOf(` ${normalizedAlias} `) !== -1 || normalized.endsWith(` ${normalizedAlias}`);
  }));
  return matchedTypes.length === 1 ? matchedTypes[0] : null;
}
function fencedCodeLines(lines) {
  const inFencedCode = [];
  let marker = null;
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
function frontmatterLines(lines) {
  const protectedLines2 = lines.map(() => false);
  if (lines[0] !== "---") return protectedLines2;
  for (let index = 0; index < lines.length; index++) {
    protectedLines2[index] = true;
    if (index > 0 && (lines[index] === "---" || lines[index] === "...")) break;
  }
  return protectedLines2;
}
function protectedLines(lines) {
  const fenced = fencedCodeLines(lines);
  const frontmatter = frontmatterLines(lines);
  return lines.map((_, index) => fenced[index] || frontmatter[index]);
}
function removeEmptyLines(lines) {
  const protectedLine = protectedLines(lines);
  const compacted = [];
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
function findOrganizeSections(lines, protectedLine) {
  const headings = [];
  lines.forEach((line, index) => {
    if (protectedLine[index]) return;
    const match = line.match(markdownHeading);
    if (!match) return;
    headings.push({ index, level: match[1].length, type: headingType(line) });
  });
  return headings.filter((heading) => heading.type !== null).map((heading) => {
    const nextBoundary = headings.find((other) => other.index > heading.index && other.level <= heading.level);
    return {
      type: heading.type,
      start: heading.index,
      end: nextBoundary ? nextBoundary.index : lines.length
    };
  });
}
function findLinksSections(lines, protectedLine) {
  const sections = [];
  for (let start = 0; start < lines.length; start++) {
    if (protectedLine[start] || !linksHeader.test(lines[start])) continue;
    let end = start + 1;
    while (end < lines.length && (lines[end].trim() === "" || /^\s+/.test(lines[end]))) end++;
    sections.push({ start, end });
    start = end - 1;
  }
  return sections;
}
function isInSection(index, sections) {
  return sections.some((section) => index >= section.start && index < section.end);
}
function taskBlockEnd(lines, start) {
  var _a, _b;
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
    const indent = (_b = (_a = line.match(/^[ \t]*/)) == null ? void 0 : _a[0].length) != null ? _b : 0;
    if (indent <= baseIndentLength) break;
    end++;
  }
  return end;
}
function isStructuralMarkdown(line) {
  return /^\s*(?:#{1,6}\s|>|\||<!--|<\/?[A-Za-z][^>]*>|\[\^[^\]]+\]:|\$\$|(?:-{3,}|\*{3,}|_{3,})\s*$)/.test(line);
}
function isMovableNoteLine(lines, index) {
  const line = lines[index];
  if (line.trim() === "" || isStructuralMarkdown(line) || taskItem.test(line)) return false;
  if (/^[ \t]+/.test(line)) return false;
  const listMatch = line.match(listItem);
  const end = taskBlockEndForList(lines, index, listMatch ? listMatch[1].length : 0);
  return end === index + 1;
}
function taskBlockEndForList(lines, start, baseIndentLength) {
  var _a, _b;
  let end = start + 1;
  while (end < lines.length) {
    const line = lines[end];
    if (line.trim() === "") {
      end++;
      continue;
    }
    const indent = (_b = (_a = line.match(/^[ \t]*/)) == null ? void 0 : _a[0].length) != null ? _b : 0;
    if (indent <= baseIndentLength) break;
    end++;
  }
  return end;
}
function addBullet(line) {
  var _a, _b;
  if (listItem.test(line)) return line;
  const indentation = (_b = (_a = line.match(/^[ \t]*/)) == null ? void 0 : _a[0]) != null ? _b : "";
  return `${indentation}- ${line.slice(indentation.length)}`;
}
function insertBeforeLinks(section, linksSections) {
  const firstLinkSection = linksSections.find((links) => links.start > section.start && links.start < section.end);
  return firstLinkSection ? firstLinkSection.start : section.end;
}
function joinLines(lines, eol, hadFinalEol) {
  if (lines.length === 0) return "";
  return lines.join(eol) + (hadFinalEol ? eol : "");
}
function organizeCurrentNote(text, options = {}) {
  const linkResult = options.organizeWebsiteLinks === false ? { text, movedCount: 0 } : moveWebsiteLinks(text);
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
  const taskIndexes = /* @__PURE__ */ new Set();
  const taskBlocks = [];
  if (taskTarget) {
    for (let index = 0; index < lines.length; index++) {
      const match = !protectedLine[index] ? lines[index].match(taskItem) : null;
      if (!match || match[1] !== "" || isInSection(index, taskSections) || isInSection(index, linksSections)) continue;
      const end = taskBlockEnd(lines, index);
      const blockLines = lines.slice(index, end);
      if (blockLines.some((_, blockIndex) => protectedLine[index + blockIndex])) continue;
      taskBlocks.push({ lines: blockLines });
      for (let taskIndex = index; taskIndex < end; taskIndex++) taskIndexes.add(taskIndex);
      index = end - 1;
    }
  }
  const noteIndexes = /* @__PURE__ */ new Set();
  const movedNotes = [];
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
    const remainingTaskTarget = findOrganizeSections(remaining, remainingProtected).find((section) => section.type === "tasks");
    if (remainingTaskTarget) {
      let insertAt = remainingTaskTarget.start + 1;
      for (let index = remainingTaskTarget.end - 1; index > remainingTaskTarget.start; index--) {
        const taskMatch = remaining[index].match(taskItem);
        if (taskMatch && taskMatch[1] === "") {
          insertAt = taskBlockEnd(remaining, index);
          break;
        }
      }
      const flattenedTasks = taskBlocks.reduce((all, block) => all.concat(block.lines), []);
      remaining.splice(insertAt, 0, ...flattenedTasks);
    }
  }
  if (movedNotes.length > 0) {
    const remainingProtected = protectedLines(remaining);
    const remainingNotesTarget = findOrganizeSections(remaining, remainingProtected).find((section) => section.type === "notes");
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

// src/settings.ts
var import_obsidian2 = require("obsidian");
var DEFAULT_SETTINGS = {
  websiteLinkFilingEnabled: true,
  noteOrganizerEnabled: true,
  smartSelectionEnabled: true,
  taskMarkerDeletionEnabled: true,
  tabBarControlsEnabled: true,
  linkedFileDeletionEnabled: true,
  organizeOnNoteOpen: false,
  organizeOnlyDailyNotes: false,
  hideTabBar: false,
  autoHideSingleTab: false,
  tabGradientHeight: 80,
  linkedMentionAction: "plain-text"
};
var BetterEditorSettingTab = class extends import_obsidian2.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Features" });
    this.addFeatureToggle(
      "Website link filing",
      "Adds the command that moves standalone website links into the note's Links list.",
      "websiteLinkFilingEnabled"
    );
    this.addFeatureToggle(
      "Note organizer",
      "Adds manual and automatic note organization for notes, tasks, blank lines, and enabled website link filing.",
      "noteOrganizerEnabled"
    );
    this.addFeatureToggle(
      "Smart selection",
      "Adds the expanding selection command for a paragraph, heading body, and note without its title.",
      "smartSelectionEnabled"
    );
    this.addFeatureToggle(
      "Task marker deletion",
      "Makes a Markdown task marker erase as one unit when Backspace or Delete reaches it.",
      "taskMarkerDeletionEnabled"
    );
    this.addFeatureToggle(
      "Tab bar controls",
      import_obsidian2.Platform.isDesktopApp ? "Adds the tab bar visibility command and automatic single-tab hiding." : "This feature is available in the desktop app.",
      "tabBarControlsEnabled",
      !import_obsidian2.Platform.isDesktopApp
    );
    this.addFeatureToggle(
      "Linked file deletion",
      "Adds a delete-current-file command that cleans links to the file before moving it to your configured trash.",
      "linkedFileDeletionEnabled"
    );
    containerEl.createEl("h2", { text: "Note organization" });
    new import_obsidian2.Setting(containerEl).setName("Organize notes when opened").setDesc("Automatically run Organize current note whenever a Markdown note is opened.").addToggle((toggle) => toggle.setValue(this.plugin.settings.organizeOnNoteOpen).setDisabled(!this.plugin.settings.noteOrganizerEnabled).onChange(async (value) => {
      await this.plugin.updateSettings({ organizeOnNoteOpen: value });
      this.display();
    }));
    new import_obsidian2.Setting(containerEl).setName("Only daily notes").setDesc("Limit automatic organization to notes matching the Daily notes folder and date format.").addToggle((toggle) => toggle.setValue(this.plugin.settings.organizeOnlyDailyNotes).setDisabled(
      !this.plugin.settings.noteOrganizerEnabled || !this.plugin.settings.organizeOnNoteOpen
    ).onChange(async (value) => {
      await this.plugin.updateSettings({ organizeOnlyDailyNotes: value });
    }));
    containerEl.createEl("h2", { text: "Linked file deletion" });
    new import_obsidian2.Setting(containerEl).setName("Linked mentions").setDesc("Choose what replaces links to the file when Delete current file is used.").addDropdown((dropdown) => dropdown.addOption("plain-text", "Keep their display text").addOption("remove", "Remove them completely").setValue(this.plugin.settings.linkedMentionAction).setDisabled(!this.plugin.settings.linkedFileDeletionEnabled).onChange(async (value) => {
      await this.plugin.updateSettings({ linkedMentionAction: value });
    }));
    containerEl.createEl("h2", { text: "Tab bar" });
    new import_obsidian2.Setting(containerEl).setName("Auto-hide with one tab").setDesc("Hide the tab bar when this window has only one main tab open.").addToggle((toggle) => toggle.setValue(this.plugin.settings.autoHideSingleTab).setDisabled(!this.plugin.settings.tabBarControlsEnabled || !import_obsidian2.Platform.isDesktopApp).onChange(async (value) => {
      await this.plugin.updateSettings({ autoHideSingleTab: value });
    }));
    new import_obsidian2.Setting(containerEl).setName("Top gradient").setDesc("Fade the theme background behind window controls. Set to 0 to disable the fade.").addSlider((slider) => slider.setLimits(0, 200, 5).setValue(this.plugin.settings.tabGradientHeight).setDynamicTooltip().setDisabled(!this.plugin.settings.tabBarControlsEnabled || !import_obsidian2.Platform.isDesktopApp).onChange(async (value) => {
      await this.plugin.updateSettings({ tabGradientHeight: value });
    }));
  }
  addFeatureToggle(name, description, key, disabled = false) {
    new import_obsidian2.Setting(this.containerEl).setName(name).setDesc(description).addToggle((toggle) => toggle.setValue(this.plugin.settings[key]).setDisabled(disabled).onChange(async (value) => {
      await this.plugin.updateSettings({ [key]: value });
      this.display();
    }));
  }
};

// src/smart-selection.ts
var import_obsidian3 = require("obsidian");
var LIST_MARKER = /^(\s*)(?:(?:[-*+])|(?:\d+[.)]))\s+(?:\[[ xX]\]\s+)?/;
var HEADING = /^#{1,6}\s+\S/;
function samePosition(left, right) {
  return left.line === right.line && left.ch === right.ch;
}
function getParagraphRange(editor) {
  var _a;
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
  const startCh = ((_a = editor.getLine(startLine).match(LIST_MARKER)) != null ? _a : [""])[0].length;
  const endCh = editor.getLine(endLine).length;
  if (startLine === endLine && startCh >= endCh) return null;
  return {
    from: { line: startLine, ch: startCh },
    to: { line: endLine, ch: endCh }
  };
}
function getCurrentHeadingBodyRange(editor) {
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
function selectionMatchesRange(editor, range) {
  return samePosition(editor.getCursor("from"), range.from) && samePosition(editor.getCursor("to"), range.to);
}
function selectAllExceptTopHeading(editor) {
  const totalLines = editor.lineCount();
  if (totalLines === 0) return;
  let startLine = 0;
  while (startLine < totalLines && editor.getLine(startLine).trim() === "") startLine++;
  if (startLine < totalLines && /^#\s+/.test(editor.getLine(startLine))) startLine++;
  if (startLine >= totalLines) {
    new import_obsidian3.Notice("Nothing to select.");
    return;
  }
  const lastLine = totalLines - 1;
  editor.setSelection(
    { line: startLine, ch: 0 },
    { line: lastLine, ch: editor.getLine(lastLine).length }
  );
}
function expandSmartSelection(editor) {
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

// src/tab-bar.ts
var import_obsidian4 = require("obsidian");
var TabBarController = class {
  constructor(app, getOptions) {
    this.app = app;
    this.getOptions = getOptions;
  }
  refresh() {
    const options = this.getOptions();
    if (!import_obsidian4.Platform.isDesktopApp || !options.enabled) {
      this.clearStyles();
      return;
    }
    let tabCount = 0;
    this.app.workspace.iterateRootLeaves(() => {
      tabCount++;
    });
    const autoHide = options.autoHideSingleTab && tabCount === 1;
    document.body.classList.toggle("better-editor-hide-tabs", options.hidden || autoHide);
    document.body.style.setProperty(
      "--better-editor-tab-gradient-height",
      `${options.gradientHeight}px`
    );
  }
  destroy() {
    this.clearStyles();
  }
  clearStyles() {
    document.body.classList.remove("better-editor-hide-tabs");
    document.body.style.removeProperty("--better-editor-tab-gradient-height");
  }
};

// src/task-marker-deletion.ts
var import_state = require("@codemirror/state");
var import_view = require("@codemirror/view");
var TASK_MARKER = /^(?<bullet>\s*-\s\[(?<mark>[ xX])\]\s)/;
function findTaskMarkerRemoval(lineText, lineStart, cursor, backward) {
  const match = lineText.match(TASK_MARKER);
  if (!match || match.index !== 0) return null;
  const prefixEnd = lineStart + match[0].length;
  const requiredCursor = backward ? prefixEnd : prefixEnd - 1;
  if (cursor !== requiredCursor) return null;
  return { from: lineStart, to: prefixEnd };
}
function removeTaskMarker(view, backward) {
  if (view.state.facet(import_view.EditorView.editable) !== true) return false;
  const changes = [];
  const ranges = [];
  for (const range of view.state.selection.ranges) {
    if (!range.empty) return false;
    const line = view.state.doc.lineAt(range.head);
    const removal = findTaskMarkerRemoval(line.text, line.from, range.head, backward);
    if (!removal) return false;
    changes.push(removal);
    ranges.push(import_state.EditorSelection.cursor(line.from));
  }
  if (changes.length === 0) return false;
  view.dispatch({
    changes,
    selection: import_state.EditorSelection.create(ranges),
    userEvent: backward ? "delete.backward" : "delete.forward",
    annotations: import_state.Transaction.addToHistory.of(true),
    scrollIntoView: true
  });
  return true;
}
function finishTaskMarkerDeletion(view, changes) {
  if (view.state.facet(import_view.EditorView.editable) !== true || view.composing) return false;
  const removals = [];
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
    ranges.push(import_state.EditorSelection.cursor(line.from));
  }
  if (removals.length === 0) return false;
  view.dispatch({
    changes: removals,
    selection: import_state.EditorSelection.create(ranges),
    userEvent: "delete.backward",
    annotations: import_state.Transaction.addToHistory.of(true),
    scrollIntoView: true
  });
  return true;
}
function createTaskMarkerDeletionExtensions(isEnabled) {
  const taskMarkerKeymap = import_state.Prec.high(import_view.keymap.of([
    {
      key: "Backspace",
      run: (view) => isEnabled() && removeTaskMarker(view, true)
    },
    {
      key: "Delete",
      run: (view) => isEnabled() && removeTaskMarker(view, false)
    }
  ]));
  const deletionObserver = import_view.EditorView.updateListener.of((update) => {
    if (!isEnabled() || !update.docChanged || !update.transactions.some((transaction) => transaction.isUserEvent("delete"))) return;
    for (const transaction of update.transactions) {
      if (!transaction.docChanged || transaction.annotation(import_state.Transaction.addToHistory) === false) continue;
      if (finishTaskMarkerDeletion(update.view, transaction.changes)) break;
    }
  });
  return [taskMarkerKeymap, deletionObserver];
}

// src/main.ts
var BetterEditorPlugin = class extends import_obsidian5.Plugin {
  constructor() {
    super(...arguments);
    this.settings = { ...DEFAULT_SETTINGS };
    this.registeredCommandIds = /* @__PURE__ */ new Set();
  }
  async onload() {
    await this.loadSettings();
    this.tabBar = new TabBarController(this.app, () => ({
      enabled: this.settings.tabBarControlsEnabled,
      hidden: this.settings.hideTabBar,
      autoHideSingleTab: this.settings.autoHideSingleTab,
      gradientHeight: this.settings.tabGradientHeight
    }));
    this.fileDeletion = new CurrentFileDeletion(
      this.app,
      () => this.settings.linkedMentionAction
    );
    this.registerEditorExtension(
      createTaskMarkerDeletionExtensions(() => this.settings.taskMarkerDeletionEnabled)
    );
    this.addSettingTab(new BetterEditorSettingTab(this.app, this));
    this.registerEvent(this.app.workspace.on("layout-change", () => this.tabBar.refresh()));
    this.registerEvent(this.app.workspace.on("file-open", (file) => {
      if (!file) return;
      void this.organizeNoteOnOpen(file).catch((error) => {
        console.error("Better Editor could not organize the opened note.", error);
      });
    }));
    this.syncFeatureState();
  }
  onunload() {
    this.tabBar.destroy();
  }
  async updateSettings(changes) {
    this.settings = { ...this.settings, ...changes };
    await this.saveData(this.settings);
    this.syncFeatureState();
  }
  async loadSettings() {
    this.settings = { ...DEFAULT_SETTINGS, ...await this.loadData() };
  }
  syncFeatureState() {
    this.syncCommand("move-website-links", this.settings.websiteLinkFilingEnabled, () => {
      this.addCommand({
        id: "move-website-links",
        name: "Move standalone website links to Links list",
        editorCallback: (editor) => this.moveLinks(editor)
      });
    });
    this.syncCommand("organize-current-note", this.settings.noteOrganizerEnabled, () => {
      this.addCommand({
        id: "organize-current-note",
        name: "Organize current note",
        editorCallback: (editor) => this.organizeEditor(editor, true)
      });
    });
    this.syncCommand("expand-selection", this.settings.smartSelectionEnabled, () => {
      this.addCommand({
        id: "expand-selection",
        name: "Expand selection by paragraph, section, then note",
        editorCallback: (editor) => expandSmartSelection(editor)
      });
    });
    this.syncCommand(
      "toggle-tab-bar-visibility",
      this.settings.tabBarControlsEnabled && import_obsidian5.Platform.isDesktopApp,
      () => {
        this.addCommand({
          id: "toggle-tab-bar-visibility",
          name: "Toggle tab bar visibility",
          callback: () => {
            void this.updateSettings({ hideTabBar: !this.settings.hideTabBar });
          }
        });
      }
    );
    this.syncCommand("delete-current-file", this.settings.linkedFileDeletionEnabled, () => {
      this.addCommand({
        id: "delete-current-file",
        name: "Delete current file and clean linked mentions",
        checkCallback: (checking) => {
          const file = this.app.workspace.getActiveFile();
          if (!(file instanceof import_obsidian5.TFile)) return false;
          if (!checking) void this.fileDeletion.run(file);
          return true;
        }
      });
    });
    this.tabBar.refresh();
  }
  syncCommand(id, enabled, register) {
    const isRegistered = this.registeredCommandIds.has(id);
    if (enabled && !isRegistered) {
      register();
      this.registeredCommandIds.add(id);
    } else if (!enabled && isRegistered) {
      this.removeCommand(id);
      this.registeredCommandIds.delete(id);
    }
  }
  moveLinks(editor) {
    const originalText = editor.getValue();
    const result = moveWebsiteLinks(originalText);
    if (result.movedCount === 0) {
      new import_obsidian5.Notice("No standalone website links were found outside the Links list.");
      return;
    }
    this.replaceEditorText(editor, result.text);
    new import_obsidian5.Notice(`Moved ${result.movedCount} website link${result.movedCount === 1 ? "" : "s"}.`);
  }
  organizeEditor(editor, showNotice) {
    const originalText = editor.getValue();
    const result = organizeCurrentNote(originalText, {
      organizeWebsiteLinks: this.settings.websiteLinkFilingEnabled
    });
    if (result.text === originalText) {
      if (showNotice) new import_obsidian5.Notice("Current note is already organized.");
      return;
    }
    this.replaceEditorText(editor, result.text);
    if (!showNotice) return;
    const changes = [];
    if (result.movedLinkCount > 0) {
      changes.push(`${result.movedLinkCount} link${result.movedLinkCount === 1 ? "" : "s"}`);
    }
    if (result.movedTaskCount > 0) {
      changes.push(`${result.movedTaskCount} task${result.movedTaskCount === 1 ? "" : "s"}`);
    }
    if (result.movedNoteCount > 0) {
      changes.push(`${result.movedNoteCount} note${result.movedNoteCount === 1 ? "" : "s"}`);
    }
    if (result.bulletAddedCount > 0) {
      changes.push(`${result.bulletAddedCount} bullet${result.bulletAddedCount === 1 ? "" : "s"} added`);
    }
    if (result.removedEmptyLineCount > 0) {
      changes.push(
        `${result.removedEmptyLineCount} empty line${result.removedEmptyLineCount === 1 ? "" : "s"} removed`
      );
    }
    new import_obsidian5.Notice(`Organized current note: ${changes.join(", ")}.`);
  }
  replaceEditorText(editor, text) {
    const cursor = editor.getCursor();
    editor.setValue(text);
    editor.setCursor({
      line: Math.min(cursor.line, editor.lineCount() - 1),
      ch: cursor.ch
    });
  }
  async organizeNoteOnOpen(file) {
    var _a;
    if (!this.settings.noteOrganizerEnabled || !this.settings.organizeOnNoteOpen || file.extension !== "md") return;
    if (this.settings.organizeOnlyDailyNotes && !this.isDailyNote(file)) return;
    const view = this.app.workspace.getActiveViewOfType(import_obsidian5.MarkdownView);
    if (((_a = view == null ? void 0 : view.file) == null ? void 0 : _a.path) === file.path) {
      this.organizeEditor(view.editor, false);
      return;
    }
    await this.app.vault.process(file, (text) => organizeCurrentNote(text, {
      organizeWebsiteLinks: this.settings.websiteLinkFilingEnabled
    }).text);
  }
  isDailyNote(file) {
    var _a, _b, _c, _d, _e, _f, _g;
    const app = this.app;
    const dailyNotesPlugin = (_a = app.internalPlugins) == null ? void 0 : _a.getPluginById("daily-notes");
    if (!(dailyNotesPlugin == null ? void 0 : dailyNotesPlugin.enabled)) return false;
    const folder = (0, import_obsidian5.normalizePath)(((_d = (_c = (_b = dailyNotesPlugin.instance) == null ? void 0 : _b.options) == null ? void 0 : _c.folder) == null ? void 0 : _d.trim()) || "");
    const format = ((_g = (_f = (_e = dailyNotesPlugin.instance) == null ? void 0 : _e.options) == null ? void 0 : _f.format) == null ? void 0 : _g.trim()) || "YYYY-MM-DD";
    const pathWithoutExtension = file.path.slice(0, -3);
    const relativePath = folder ? pathWithoutExtension.startsWith(`${folder}/`) ? pathWithoutExtension.slice(folder.length + 1) : "" : pathWithoutExtension;
    return relativePath.length > 0 && (0, import_obsidian5.moment)(relativePath, format, true).isValid();
  }
};
