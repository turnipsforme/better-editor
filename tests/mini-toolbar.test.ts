import { describe, expect, it } from "vitest";
import { toHeadingLine } from "../src/mini-toolbar/heading";
import {
  headingLevelForAction,
  normalizeToolbarAction,
} from "../src/mini-toolbar/toolbar-settings";

describe("mini toolbar settings", () => {
  it("keeps the button's own action and valid heading replacements", () => {
    expect(normalizeToolbarAction("copy", "copy")).toBe("copy");
    expect(normalizeToolbarAction("heading-2", "copy")).toBe("heading-2");
    expect(normalizeToolbarAction("heading-3", "strikethrough")).toBe("heading-3");
    expect(normalizeToolbarAction("heading-4", "underline")).toBe("heading-4");
  });

  it("rejects actions belonging to another button and unknown values", () => {
    expect(normalizeToolbarAction("underline", "copy")).toBe("copy");
    expect(normalizeToolbarAction("heading-1", "underline")).toBe("underline");
    expect(normalizeToolbarAction(null, "strikethrough")).toBe("strikethrough");
  });

  it("reads the configured heading level", () => {
    expect(headingLevelForAction("heading-2")).toBe(2);
    expect(headingLevelForAction("heading-4")).toBe(4);
  });
});

describe("mini toolbar headings", () => {
  it("adds a heading without changing the text", () => {
    expect(toHeadingLine("A title", 2)).toBe("## A title");
    expect(toHeadingLine("  Indented", 3)).toBe("  ### Indented");
  });

  it("replaces an existing ATX heading marker", () => {
    expect(toHeadingLine("#### Existing", 2)).toBe("## Existing");
    expect(toHeadingLine("  # Nested", 4)).toBe("  #### Nested");
  });

  it("handles an empty heading line", () => {
    expect(toHeadingLine("###", 2)).toBe("##");
  });
});
