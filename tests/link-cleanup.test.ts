import { describe, expect, it } from "vitest";
import {
  linkDisplayText,
  rewriteLinkedMentions,
  type PositionedLinkReference
} from "../src/link-cleanup";

function reference(text: string, original: string, displayText?: string): PositionedLinkReference {
  const from = text.indexOf(original);
  return {
    original,
    displayText,
    position: {
      start: { offset: from },
      end: { offset: from + original.length }
    }
  };
}

describe("rewriteLinkedMentions", () => {
  it("keeps the visible text for wiki and Markdown links", () => {
    const text = "See [[Folder/Target|friendly name]] and [another name](../Target.md).";
    const wiki = reference(text, "[[Folder/Target|friendly name]]", "friendly name");
    const markdown = reference(text, "[another name](../Target.md)", "another name");

    expect(rewriteLinkedMentions(text, [wiki, markdown], "plain-text", "Target")).toEqual({
      text: "See friendly name and another name.",
      count: 2
    });
  });

  it("removes only the exact link tokens", () => {
    const text = "Before [[Target]] after\nKeep this line";

    expect(rewriteLinkedMentions(
      text,
      [reference(text, "[[Target]]")],
      "remove",
      "Target"
    )).toEqual({
      text: "Before  after\nKeep this line",
      count: 1
    });
  });

  it("uses aliases and Markdown labels when cache display text is absent", () => {
    expect(linkDisplayText(reference("[[Target|Alias]]", "[[Target|Alias]]"), "Target"))
      .toBe("Alias");
    expect(linkDisplayText(reference("[Label](Target.md)", "[Label](Target.md)"), "Target"))
      .toBe("Label");
  });

  it("stops instead of applying stale cache positions", () => {
    const text = "Changed [[Target]]";
    const stale = {
      original: "[[Target]]",
      position: { start: { offset: 0 }, end: { offset: 10 } }
    };

    expect(() => rewriteLinkedMentions(text, [stale], "remove", "Target"))
      .toThrow("changed before its links could be updated");
  });
});
