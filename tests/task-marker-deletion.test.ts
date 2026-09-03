import { describe, expect, it } from "vitest";
import { findTaskMarkerRemoval } from "../src/task-marker-deletion";

describe("findTaskMarkerRemoval", () => {
  it("removes the full task marker when Backspace reaches it", () => {
    expect(findTaskMarkerRemoval("- [ ] Write", 20, 26, true)).toEqual({ from: 20, to: 26 });
    expect(findTaskMarkerRemoval("  - [x] Done", 0, 8, true)).toEqual({ from: 0, to: 8 });
  });

  it("removes the full task marker when Delete reaches its last character", () => {
    expect(findTaskMarkerRemoval("- [X] Done", 0, 5, false)).toEqual({ from: 0, to: 6 });
  });

  it("does not claim normal text or a cursor elsewhere on the task", () => {
    expect(findTaskMarkerRemoval("Plain text", 0, 0, true)).toBeNull();
    expect(findTaskMarkerRemoval("- [ ] Task", 0, 2, true)).toBeNull();
  });
});
