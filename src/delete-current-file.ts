import {
  ButtonComponent,
  Modal,
  Notice,
  TFile,
  parseLinktext,
  type App,
  type CachedMetadata,
  type FrontmatterLinkCache,
  type ReferenceCache
} from "obsidian";
import {
  rewriteLinkedMentions,
  type LinkedMentionAction,
  type PositionedLinkReference
} from "./link-cleanup";

interface StagedRewrite {
  file: TFile;
  originalText: string;
  updatedText: string;
  mentionCount: number;
}

function resolvesToTarget(app: App, reference: { link: string }, source: TFile, target: TFile): boolean {
  const linkPath = parseLinktext(reference.link).path;
  return app.metadataCache.getFirstLinkpathDest(linkPath, source.path)?.path === target.path;
}

function frontmatterReferences(
  text: string,
  cache: CachedMetadata,
  links: FrontmatterLinkCache[]
): PositionedLinkReference[] {
  const bounds = cache.frontmatterPosition;
  if (!bounds || links.length === 0) return [];

  const start = bounds.start.offset;
  const end = bounds.end.offset;
  const references: PositionedLinkReference[] = [];
  const uniqueLinks = new Map<string, FrontmatterLinkCache>();
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

function uniqueReferenceCount(references: PositionedLinkReference[]): number {
  return new Set(references.map((reference) => (
    `${reference.position.start.offset}:${reference.position.end.offset}`
  ))).size;
}

export type DeletionConfirmation = (
  app: App,
  target: TFile,
  mentionCount: number,
  action: LinkedMentionAction
) => Promise<boolean>;

class DeleteFileModal extends Modal {
  private confirmed = false;

  constructor(
    app: App,
    private readonly target: TFile,
    private readonly mentionCount: number,
    private readonly action: LinkedMentionAction,
    private readonly resolve: (confirmed: boolean) => void
  ) {
    super(app);
  }

  onOpen(): void {
    this.setTitle("Delete file");
    this.contentEl.createEl("p", {
      cls: "u-break-word",
      text: `Are you sure you want to delete "${this.target.name}"?`
    });
    if (this.mentionCount > 0) {
      const result = this.action === "remove" ? "removed" : "changed to plain text";
      this.contentEl.createEl("p", {
        text: `${this.mentionCount} linked mention${this.mentionCount === 1 ? "" : "s"} in other notes will be ${result}.`
      });
    }

    const buttons = this.contentEl.createDiv({ cls: "modal-button-container" });
    const deleteButton = new ButtonComponent(buttons)
      .setButtonText("Delete")
      .setWarning()
      .onClick(() => {
        this.confirmed = true;
        this.close();
      });
    new ButtonComponent(buttons)
      .setButtonText("Cancel")
      .onClick(() => this.close());
    deleteButton.buttonEl.focus();
  }

  onClose(): void {
    this.contentEl.empty();
    this.resolve(this.confirmed);
  }
}

// Obsidian's promptForDeletion trashes the file itself once confirmed, which would
// remove it before its linked mentions could be located, so ask with a plain modal.
export const confirmDeletion: DeletionConfirmation = (app, target, mentionCount, action) => (
  new Promise((resolve) => new DeleteFileModal(app, target, mentionCount, action, resolve).open())
);

export class CurrentFileDeletion {
  constructor(
    private readonly app: App,
    private readonly getAction: () => LinkedMentionAction,
    private readonly confirm: DeletionConfirmation = confirmDeletion
  ) {}

  async run(target: TFile): Promise<void> {
    const confirmed = await this.confirm(this.app, target, this.linkedMentionCount(target), this.getAction());
    if (!confirmed) return;

    let staged: StagedRewrite[] = [];
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
        new Notice(
          `Deleted ${target.name}; ${mentionCount} linked mention${mentionCount === 1 ? " was" : "s were"} ${action}.`
        );
      }
    } catch (error) {
      console.error("Better Editor could not safely delete the current file.", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      new Notice(`Could not delete ${target.name}: ${message}`);
    }
  }

  private linkedMentionCount(target: TFile): number {
    let count = 0;
    for (const source of this.app.vault.getMarkdownFiles()) {
      if (source.path === target.path) continue;
      count += this.app.metadataCache.resolvedLinks[source.path]?.[target.path] ?? 0;
    }
    return count;
  }

  private async stageLinkedMentionChanges(target: TFile): Promise<StagedRewrite[]> {
    const action = this.getAction();
    const staged: StagedRewrite[] = [];

    for (const source of this.app.vault.getMarkdownFiles()) {
      if (source.path === target.path) continue;

      const expectedCount = this.app.metadataCache.resolvedLinks[source.path]?.[target.path] ?? 0;
      if (expectedCount === 0) continue;

      const cache = this.app.metadataCache.getFileCache(source);
      if (!cache) throw new Error(`Obsidian has not finished indexing ${source.path}.`);

      const bodyReferences = ([...(cache.links ?? []), ...(cache.embeds ?? [])] as ReferenceCache[])
        .filter((reference) => resolvesToTarget(this.app, reference, source, target));
      const matchingFrontmatterLinks = (cache.frontmatterLinks ?? [])
        .filter((reference) => resolvesToTarget(this.app, reference, source, target));
      const originalText = await this.app.vault.read(source);
      const references: PositionedLinkReference[] = [
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

  private async applyChanges(staged: StagedRewrite[]): Promise<void> {
    const applied: StagedRewrite[] = [];
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

  private async rollbackChanges(staged: StagedRewrite[]): Promise<void> {
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
}
