import type { App } from "obsidian";

export interface TabBarOptions {
  enabled: boolean;
  autoHideSingleTab: boolean;
  gradientHeight: number;
}

export class TabBarController {
  private readonly manuallyHidden = new WeakMap<Document, boolean>();
  private readonly styledDocuments = new Set<Document>();

  constructor(
    private readonly app: App,
    private readonly getOptions: () => TabBarOptions
  ) {}

  refresh(): void {
    const options = this.getOptions();
    if (!options.enabled) {
      this.clearStyles();
      return;
    }
    if (!this.app.workspace.layoutReady || !this.app.workspace.rootSplit) return;

    const tabCounts = this.getTabCounts();
    for (const doc of this.styledDocuments) {
      if (!tabCounts.has(doc)) this.clearDocumentStyles(doc);
    }

    for (const [doc, tabCount] of tabCounts) {
      this.applyStyles(doc, tabCount, options);
    }
  }

  toggle(doc: Document): void {
    const options = this.getOptions();
    if (!options.enabled) return;
    if (!this.app.workspace.layoutReady || !this.app.workspace.rootSplit) return;

    const tabCount = this.getTabCounts().get(doc) ?? 0;
    const currentlyHidden = this.shouldHide(doc, tabCount, options);
    this.manuallyHidden.set(doc, !currentlyHidden);
    this.applyStyles(doc, tabCount, options);
  }

  destroy(): void {
    this.clearStyles();
  }

  private getTabCounts(): Map<Document, number> {
    const tabCounts = new Map<Document, number>([
      [this.app.workspace.rootSplit.doc, 0]
    ]);

    this.app.workspace.iterateRootLeaves((leaf) => {
      const doc = leaf.getContainer().doc;
      tabCounts.set(doc, (tabCounts.get(doc) ?? 0) + 1);
    });

    return tabCounts;
  }

  private shouldHide(
    doc: Document,
    tabCount: number,
    options: TabBarOptions
  ): boolean {
    return this.manuallyHidden.get(doc) ??
      (options.autoHideSingleTab && tabCount === 1);
  }

  private applyStyles(
    doc: Document,
    tabCount: number,
    options: TabBarOptions
  ): void {
    doc.body.classList.toggle(
      "better-editor-hide-tabs",
      this.shouldHide(doc, tabCount, options)
    );
    doc.body.style.setProperty(
      "--better-editor-tab-gradient-height",
      `${options.gradientHeight}px`
    );
    this.styledDocuments.add(doc);
  }

  private clearStyles(): void {
    for (const doc of this.styledDocuments) this.clearDocumentStyles(doc);
  }

  private clearDocumentStyles(doc: Document): void {
    doc.body.classList.remove("better-editor-hide-tabs");
    doc.body.style.removeProperty("--better-editor-tab-gradient-height");
    this.styledDocuments.delete(doc);
  }
}
