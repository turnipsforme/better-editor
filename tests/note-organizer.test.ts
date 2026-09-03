import { describe, expect, it } from "vitest";
import { moveWebsiteLinks, organizeCurrentNote } from "../src/note-organizer";

describe("moveWebsiteLinks", () => {
  it("moves bare and bulleted HTTP links without empty bullets", () => {
    const input = "Start\n- [Secure](https://example.com)\n[Plain](http://example.org)";

    expect(moveWebsiteLinks(input)).toEqual({
      text: "Start\n\n- [[Links]]\n  - [Secure](https://example.com)\n  - [Plain](http://example.org)",
      movedCount: 2
    });
  });

  it("leaves links with surrounding text or other links untouched", () => {
    const input = [
      "Keep this [one](https://one.test/a_(b)) in a paragraph.",
      "- A bullet with [one](https://one.test) in text",
      "[One](https://one.test) [Two](http://two.test)",
      "- [Internal](Note)"
    ].join("\n");

    expect(moveWebsiteLinks(input)).toEqual({ text: input, movedCount: 0 });
  });

  it("appends to an existing Links section without a gap or duplicates", () => {
    const input = "[New](https://new.test)\n\n- [[Links]]\n  - [Old](https://old.test)\n";

    expect(moveWebsiteLinks(input).text).toBe(
      "\n- [[Links]]\n  - [Old](https://old.test)\n  - [New](https://new.test)\n"
    );
  });

  it("uses the existing Links section indentation when appending", () => {
    const input = "https://new.test\n\n- [[Links]]\n\t- https://old.test\n";

    expect(moveWebsiteLinks(input).text).toBe(
      "\n- [[Links]]\n\t- https://old.test\n\t- [](https://new.test)\n"
    );
  });

  it("recognizes a Markdown link to Links.md as the Links section", () => {
    const input = "[New](https://new.test)\n\n- [Links](<Links.md>)\n  - [Old](https://old.test)\n";

    expect(moveWebsiteLinks(input).text).toBe(
      "\n- [Links](<Links.md>)\n  - [Old](https://old.test)\n  - [New](https://new.test)\n"
    );
  });

  it("moves standalone bare URLs but leaves URLs in paragraphs untouched", () => {
    const input = [
      "https://plain.test/path?q=one",
      "- https://bulleted.test/path",
      "Keep https://paragraph.test here."
    ].join("\n");

    expect(moveWebsiteLinks(input)).toEqual({
      text: "Keep https://paragraph.test here.\n\n- [[Links]]\n  - [](https://plain.test/path?q=one)\n  - [](https://bulleted.test/path)",
      movedCount: 2
    });
  });

  it("keeps non-web links, images, code, and fenced examples untouched", () => {
    const input = [
      "[[Wiki]] [Relative](/page) ![Image](https://img.test/a.png)",
      "`[Inline](https://inline.test)`",
      "```md",
      "[Example](https://example.test)",
      "```"
    ].join("\n");

    expect(moveWebsiteLinks(input)).toEqual({ text: input, movedCount: 0 });
  });

  it("removes empty unordered and numbered source bullets", () => {
    const input = "*   [One](https://one.test)\n1. [Two](http://two.test)\n+ [Three](https://three.test)\n";

    expect(moveWebsiteLinks(input).text).toBe(
      "- [[Links]]\n  - [One](https://one.test)\n  - [Two](http://two.test)\n  - [Three](https://three.test)\n"
    );
  });

  it("does not move links from Markdown task items", () => {
    const input = [
      "- [ ] [Open](https://open.test)",
      "- [x] [Done](https://done.test)",
      "* [X] [Done too](https://done-too.test)"
    ].join("\n");

    expect(moveWebsiteLinks(input)).toEqual({ text: input, movedCount: 0 });
  });

  it("preserves CRLF and final newline style", () => {
    const input = "Text\r\n[Link](https://example.test)\r\n";

    expect(moveWebsiteLinks(input).text).toBe(
      "Text\r\n\r\n- [[Links]]\r\n  - [Link](https://example.test)\r\n"
    );
  });
});

describe("organizeCurrentNote", () => {
  it("leaves website links in place when link filing is disabled", () => {
    const input = "# Notes\nA note\n[Reference](https://example.com)\n";

    expect(organizeCurrentNote(input, { organizeWebsiteLinks: false })).toEqual({
      text: "# Notes\n- A note\n- [Reference](https://example.com)\n",
      movedLinkCount: 0,
      movedTaskCount: 0,
      movedNoteCount: 0,
      bulletAddedCount: 2,
      removedEmptyLineCount: 0
    });
  });

  it("organizes links, tasks, and notes under softly detected headings", () => {
    const input = [
      "# Daily",
      "",
      "A loose note",
      "### ⭐ Tasks:",
      "- [ ] Existing task",
      "## NOTES:",
      "Already filed",
      "- [ ] File this task",
      "[Reference](https://example.com)",
      "Another filed note",
      ""
    ].join("\n");

    expect(organizeCurrentNote(input)).toEqual({
      text: [
        "# Daily",
        "### ⭐ Tasks:",
        "- [ ] Existing task",
        "- [ ] File this task",
        "## NOTES:",
        "- Already filed",
        "- Another filed note",
        "- A loose note",
        "- [[Links]]",
        "  - [Reference](https://example.com)",
        ""
      ].join("\n"),
      movedLinkCount: 1,
      movedTaskCount: 1,
      movedNoteCount: 1,
      bulletAddedCount: 3,
      removedEmptyLineCount: 2
    });
  });

  it("detects To-do headings and appends task blocks without dropping their children", () => {
    const input = [
      "## To-do:",
      "- [ ] Existing",
      "# Inbox",
      "- [ ] Parent task",
      "  Supporting detail",
      "  - [ ] Child task",
      ""
    ].join("\n");

    expect(organizeCurrentNote(input).text).toBe([
      "## To-do:",
      "- [ ] Existing",
      "- [ ] Parent task",
      "  Supporting detail",
      "  - [ ] Child task",
      "# Inbox",
      ""
    ].join("\n"));
  });

  it("adds bullets in place when no Notes heading exists", () => {
    const input = "# Tasks\n- [ ] Existing\nA loose thought\n";

    expect(organizeCurrentNote(input)).toEqual({
      text: "# Tasks\n- [ ] Existing\n- A loose thought\n",
      movedLinkCount: 0,
      movedTaskCount: 0,
      movedNoteCount: 0,
      bulletAddedCount: 1,
      removedEmptyLineCount: 0
    });
  });

  it("leaves tasks in place when no Tasks heading is detected and preserves CRLF", () => {
    const input = "# Notes\r\n\r\nA note\r\n- [ ] Unfiled task\r\nhttps://example.com\r\n";

    expect(organizeCurrentNote(input).text).toBe(
      "# Notes\r\n- A note\r\n- [ ] Unfiled task\r\n- [[Links]]\r\n  - [](https://example.com)\r\n"
    );
  });

  it("does not alter fenced code, frontmatter, headings, or structured note blocks", () => {
    const input = [
      "---",
      "title: Example",
      "",
      "---",
      "# Notes",
      "",
      "```md",
      "",
      "plain example",
      "- [ ] example task",
      "```",
      "",
      "Parent note",
      "  Nested detail",
      "Regular note",
      ""
    ].join("\n");

    expect(organizeCurrentNote(input).text).toBe([
      "---",
      "title: Example",
      "",
      "---",
      "# Notes",
      "```md",
      "",
      "plain example",
      "- [ ] example task",
      "```",
      "Parent note",
      "  Nested detail",
      "- Regular note",
      ""
    ].join("\n"));
  });
});
