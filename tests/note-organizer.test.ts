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

const nothingEnabled = {
  emptyLines: "keep" as const,
  organizeWebsiteLinks: false,
  moveTasks: false,
  moveNotes: false,
  addBullets: false,
};

describe("organizer options", () => {
  const input = "# Inbox\nLoose note\n\n\n- [ ] Task\nhttps://example.test\n# Tasks\n# Notes\n";

  it("makes no changes when every behavior is off", () => {
    expect(organizeCurrentNote(input, nothingEnabled).text).toBe(input);
  });

  it.each(["keep", "collapse", "remove"] as const)("supports %s empty lines without other edits", (emptyLines) => {
    const input = "One\r\n\r\n  \r\nTwo\r\n\r\nThree\r\n";
    const result = organizeCurrentNote(input, { ...nothingEnabled, emptyLines });
    const expected = emptyLines === "keep" ? input : emptyLines === "collapse"
      ? "One\r\n\r\nTwo\r\n\r\nThree\r\n" : "One\r\nTwo\r\nThree\r\n";
    expect(result.text).toBe(expected);
    expect(result.removedEmptyLineCount).toBe(emptyLines === "keep" ? 0 : emptyLines === "collapse" ? 1 : 3);
  });

  it("moves free text without adding bullets", () => {
    const result = organizeCurrentNote("# Inbox\nText\n# Notes\n", { ...nothingEnabled, moveNotes: true });
    expect(result.text).toBe("# Inbox\n# Notes\nText\n");
    expect(result.movedNoteCount).toBe(1);
    expect(result.bulletAddedCount).toBe(0);
  });

  it("adds bullets without moving text", () => {
    expect(organizeCurrentNote("# Inbox\nText\n\n# Notes\n", { ...nothingEnabled, addBullets: true }).text)
      .toBe("# Inbox\n- Text\n\n# Notes\n");
  });

  it("moves only tasks, including their children but not trailing blank lines", () => {
    const input = "# Inbox\nText\n- [ ] Parent\n\n  - [ ] Child\n\n# Tasks\n# Notes\n";
    const result = organizeCurrentNote(input, { ...nothingEnabled, moveTasks: true });
    expect(result.text).toBe("# Inbox\nText\n\n# Tasks\n- [ ] Parent\n\n  - [ ] Child\n# Notes\n");
    expect(result.movedTaskCount).toBe(1);
    expect(result.movedNoteCount).toBe(0);
  });

  it("moves only website links", () => {
    const result = organizeCurrentNote(input, { ...nothingEnabled, organizeWebsiteLinks: true });
    expect(result.movedLinkCount).toBe(1);
    expect(result.movedTaskCount).toBe(0);
    expect(result.movedNoteCount).toBe(0);
    expect(result.bulletAddedCount).toBe(0);
    expect(result.removedEmptyLineCount).toBe(0);
  });

  for (const emptyLines of ["keep", "collapse", "remove"] as const) {
    for (let mask = 0; mask < 16; mask++) {
      it(`is stable on repeated use with ${emptyLines} and toggle combination ${mask}`, () => {
        const options = {
          emptyLines,
          organizeWebsiteLinks: !!(mask & 1),
          moveTasks: !!(mask & 2),
          moveNotes: !!(mask & 4),
          addBullets: !!(mask & 8),
        };
        const first = organizeCurrentNote(input, options);
        expect(organizeCurrentNote(first.text, options).text).toBe(first.text);
        expect(first.movedLinkCount).toBe(options.organizeWebsiteLinks ? 1 : 0);
        expect(first.movedTaskCount).toBe(options.moveTasks ? 1 : 0);
        if (!options.moveNotes) expect(first.movedNoteCount).toBe(0);
        if (!options.addBullets) expect(first.bulletAddedCount).toBe(0);
      });
    }
  }
});

describe("Markdown safety", () => {
  it.each([
    "---\nurls:\n  - https://yaml.test\n---",
    "````md\n```\nhttps://example.test\n\n\n# Notes\n````",
    "~~~md\n~~\nhttps://example.test\n~~~",
    "<!--\nComment text\nhttps://example.test\n\n\nMore comment\n-->",
    "$$\nx+y\nhttps://example.test\n\n\n$$",
    "Heading\n=======",
    "[reference]: https://example.test",
  ])("keeps literal blocks unchanged: %s", (input) => {
    expect(moveWebsiteLinks(input).text).toBe(input);
    expect(organizeCurrentNote(input).text).toBe(input);
  });

  it("does not append links to a fake Links section inside code", () => {
    const input = "```\n- [[Links]]\n```\nhttps://real.test";
    expect(moveWebsiteLinks(input).text).toBe("```\n- [[Links]]\n```\n\n- [[Links]]\n  - [](https://real.test)");
  });

  it("keeps every existing Links list in place", () => {
    const input = "- [[Links]]\n  - https://first.test\n# Other\n- [[Links]]\n  - https://second.test";
    expect(moveWebsiteLinks(input).text).toBe(input);
  });

  it("does not detach links from parents or children or indented code", () => {
    const input = "- Parent\n  - https://child.test\nhttps://parent.test\n  Child text\n\n    https://code.test";
    expect(moveWebsiteLinks(input).text).toBe(input);
  });

  it("handles thousands of task sections without moving already filed tasks", () => {
    const input = Array.from({ length: 2000 }, (_, i) => `# Tasks ${i}\n- [ ] Task ${i}`).join("\n");
    expect(organizeCurrentNote(input).text).toBe(input);
  });
});

it("keeps existing blank lines when filing links with Keep all selected", () => {
  const input = "# Notes\n\n\nhttps://example.test\n\n\n";
  const result = organizeCurrentNote(input, { ...nothingEnabled, organizeWebsiteLinks: true });
  expect(result.text).toBe("# Notes\n\n\n\n\n- [[Links]]\n  - [](https://example.test)\n");
});


it("collapses gaps created by moving text in the same run", () => {
  const input = "# Inbox\n\nText\n\n# Notes\n\nExisting\n";
  const options = { ...nothingEnabled, emptyLines: "collapse" as const, moveNotes: true };
  const result = organizeCurrentNote(input, options);
  expect(result.text).toBe("# Inbox\n\n# Notes\n\nExisting\nText\n");
  expect(result.removedEmptyLineCount).toBe(1);
  expect(organizeCurrentNote(result.text, options).text).toBe(result.text);
});
