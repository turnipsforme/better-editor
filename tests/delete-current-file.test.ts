import { beforeEach, describe, expect, it, vi } from "vitest";
import type { App, TFile } from "obsidian";

const notices = vi.hoisted(() => [] as string[]);

vi.mock("obsidian", () => ({
  ButtonComponent: class {},
  Modal: class {},
  Notice: class {
    constructor(message: string) {
      notices.push(message);
    }
  },
  TFile: class {},
  parseLinktext: (link: string) => ({ path: link.split("#")[0], subpath: "" }),
}));

import { CurrentFileDeletion } from "../src/delete-current-file";

function file(path: string): TFile {
  const name = path.split("/").pop() ?? path;
  return { path, name, basename: name.replace(/\.md$/, ""), extension: "md" } as TFile;
}

function createVault(contents: Record<string, string>, linkedTo = "Target.md") {
  const files = new Map(Object.keys(contents).map((path) => [path, file(path)]));
  const text = new Map(Object.entries(contents));
  const events: string[] = [];

  const app = {
    vault: {
      getMarkdownFiles: () => [...files.values()].filter((item) => text.has(item.path)),
      read: vi.fn(async (item: TFile) => text.get(item.path) ?? ""),
      process: vi.fn(async (item: TFile, change: (current: string) => string) => {
        const updated = change(text.get(item.path) ?? "");
        text.set(item.path, updated);
        events.push(`write ${item.path}`);
        return updated;
      }),
    },
    metadataCache: {
      get resolvedLinks() {
        const links: Record<string, Record<string, number>> = {};
        for (const [path, body] of text) {
          const count = body.split(`[[${linkedTo.replace(/\.md$/, "")}`).length - 1;
          if (count > 0 && files.has(linkedTo) && text.has(linkedTo)) links[path] = { [linkedTo]: count };
        }
        return links;
      },
      getFileCache: (item: TFile) => {
        const body = text.get(item.path) ?? "";
        const links = [...body.matchAll(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g)].map((match) => ({
          link: match[1],
          original: match[0],
          displayText: match[2] ?? match[1],
          position: {
            start: { offset: match.index ?? 0 },
            end: { offset: (match.index ?? 0) + match[0].length }
          }
        }));
        return { links };
      },
      getFirstLinkpathDest: (linkPath: string) => files.get(`${linkPath}.md`) ?? null,
    },
    fileManager: {
      // Like Obsidian, confirming the native prompt trashes the file immediately.
      promptForDeletion: vi.fn(async (item: TFile) => {
        await app.fileManager.trashFile(item);
        return true;
      }),
      trashFile: vi.fn(async (item: TFile) => {
        if (!text.has(item.path)) throw new Error("ENOENT: file already deleted");
        text.delete(item.path);
        events.push(`trash ${item.path}`);
      }),
    },
  } as unknown as App;

  return { app, text, events, files };
}

describe("CurrentFileDeletion", () => {
  beforeEach(() => {
    notices.length = 0;
  });

  it("changes linked mentions to plain text before trashing the file", async () => {
    const { app, text, events, files } = createVault({
      "Target.md": "Target body",
      "Source.md": "See [[Target]] and [[Target|the target]].",
      "Other.md": "Unrelated [[Elsewhere]]",
    });
    const confirm = vi.fn(async () => true);

    await new CurrentFileDeletion(app, () => "plain-text", confirm).run(files.get("Target.md")!);

    expect(confirm).toHaveBeenCalledWith(app, files.get("Target.md"), 2, "plain-text");
    expect(text.get("Source.md")).toBe("See Target and the target.");
    expect(text.get("Other.md")).toBe("Unrelated [[Elsewhere]]");
    expect(text.has("Target.md")).toBe(false);
    expect(events).toEqual(["write Source.md", "trash Target.md"]);
    expect(app.fileManager.promptForDeletion).not.toHaveBeenCalled();
    expect(notices).toEqual(["Deleted Target.md; 2 linked mentions were changed to plain text."]);
  });

  it("removes linked mentions when that action is selected", async () => {
    const { app, text, files } = createVault({
      "Target.md": "Target body",
      "Source.md": "Before [[Target]] after",
    });

    await new CurrentFileDeletion(app, () => "remove", async () => true).run(files.get("Target.md")!);

    expect(text.get("Source.md")).toBe("Before  after");
    expect(text.has("Target.md")).toBe(false);
    expect(notices).toEqual(["Deleted Target.md; 1 linked mention was removed."]);
  });

  it("changes nothing when the deletion is canceled", async () => {
    const { app, text, files } = createVault({
      "Target.md": "Target body",
      "Source.md": "See [[Target]].",
    });

    await new CurrentFileDeletion(app, () => "plain-text", async () => false).run(files.get("Target.md")!);

    expect(text.get("Source.md")).toBe("See [[Target]].");
    expect(text.has("Target.md")).toBe(true);
    expect(app.vault.process).not.toHaveBeenCalled();
    expect(app.fileManager.trashFile).not.toHaveBeenCalled();
  });

  it("deletes files without linked mentions quietly", async () => {
    const { app, text, files } = createVault({ "Target.md": "Target body", "Other.md": "Nothing here" });

    await new CurrentFileDeletion(app, () => "plain-text", async () => true).run(files.get("Target.md")!);

    expect(text.has("Target.md")).toBe(false);
    expect(app.vault.process).not.toHaveBeenCalled();
    expect(notices).toEqual([]);
  });

  it("restores linked notes when trashing fails", async () => {
    const { app, text, files } = createVault({
      "Target.md": "Target body",
      "Source.md": "See [[Target]].",
    });
    vi.mocked(app.fileManager.trashFile).mockRejectedValueOnce(new Error("Trash unavailable"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    await new CurrentFileDeletion(app, () => "plain-text", async () => true).run(files.get("Target.md")!);

    expect(text.get("Source.md")).toBe("See [[Target]].");
    expect(text.has("Target.md")).toBe(true);
    expect(notices).toEqual(["Could not delete Target.md: Trash unavailable"]);
  });
});
