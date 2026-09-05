import { Compartment, StateEffect, type Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import type { App, MarkdownPostProcessorContext } from "obsidian";
import {
  createColorExtension,
  type ColorStorage,
  type FileColorData,
  type Range,
} from "./colorRanges";
import type { FloatingToolbarSettings } from "./toolbar-settings";
import {
  miniToolbarMarkerField,
  refreshMiniToolbarEffect,
  refreshVisibleToolbars,
  ToolBarExtension,
} from "./toolbar";

export interface MiniToolbarOptions extends FloatingToolbarSettings {
  colors: Record<string, FileColorData>;
}

type RangeLike = Range & { color?: string };

const sortRanges = <T extends RangeLike>(ranges: T[]): T[] =>
  ranges.length > 1 ? [...ranges].sort((left, right) => left.from - right.from) : ranges;

class RangeCursor<T extends RangeLike> {
  private index = 0;

  constructor(private readonly ranges: T[]) {}

  advanceTo(position: number): void {
    while (this.index < this.ranges.length && this.ranges[this.index].to <= position) {
      this.index++;
    }
  }

  addBoundaries(target: Set<number>, start: number, end: number): void {
    if (!this.ranges.length) return;
    let index = this.index;
    if (index > 0 && this.ranges[index - 1].to > start) index--;
    for (; index < this.ranges.length; index++) {
      const range = this.ranges[index];
      if (range.from >= end) break;
      if (range.to > start) {
        target.add(Math.max(start, range.from));
        target.add(Math.min(end, range.to));
      }
    }
  }

  rangeAt(position: number): T | null {
    if (!this.ranges.length) return null;
    let index = this.index;
    if (index >= this.ranges.length) index = this.ranges.length - 1;
    if (index > 0 && this.ranges[index - 1].to > position) index--;
    for (; index < this.ranges.length; index++) {
      const range = this.ranges[index];
      if (range.from > position) break;
      if (range.to > position) {
        this.index = index;
        return range;
      }
    }
    return null;
  }
}

export class MiniToolbarFeature {
  readonly editorExtensions: Extension[];
  private injectHandle: number | null = null;
  private readonly journalCompartment = new Compartment();
  private readonly journalEditors = new Set<EditorView>();

  constructor(
    private readonly app: App,
    private readonly getOptions: () => MiniToolbarOptions,
    onColorsChanged: () => void,
  ) {
    const storage: ColorStorage = {
      load: (path) => this.getOptions().colors[path],
      save: (path, data) => {
        this.getOptions().colors[path] = data;
        onColorsChanged();
      },
    };
    const getToolbarSettings = (): FloatingToolbarSettings => {
      const options = this.getOptions();
      return {
        enabled: options.enabled,
        copyButtonAction: options.copyButtonAction,
        strikethroughButtonAction: options.strikethroughButtonAction,
        underlineButtonAction: options.underlineButtonAction,
      };
    };

    this.editorExtensions = [
      ...ToolBarExtension(this.app, getToolbarSettings),
      createColorExtension(storage, () => this.getOptions().enabled),
    ];
  }

  scheduleJournalInjection = (): void => {
    if (!this.getOptions().enabled) return;
    if (this.injectHandle !== null) window.clearTimeout(this.injectHandle);
    this.injectHandle = window.setTimeout(() => {
      this.injectHandle = null;
      this.injectIntoJournalEditors();
    }, 150);
  };

  refresh(): void {
    if (this.getOptions().enabled) {
      this.injectIntoJournalEditors();
    } else {
      this.removeFromJournalEditors();
    }
    refreshVisibleToolbars(this.app);
    this.forEachJournalEditor((view) => {
      if (view.state.field(miniToolbarMarkerField, false) !== undefined) {
        view.dispatch({ effects: refreshMiniToolbarEffect.of(undefined) });
      }
    });
    this.refreshReadingViews();
  }

  processReadingView(containerEl: HTMLElement, ctx: MarkdownPostProcessorContext): void {
    if (!this.getOptions().enabled || containerEl.closest(".markdown-source-view")) return;
    const data = this.getOptions().colors[ctx.sourcePath];
    if (!data) return;
    this.applyColorsToReadingView(containerEl, data);
  }

  destroy(): void {
    if (this.injectHandle !== null) {
      window.clearTimeout(this.injectHandle);
      this.injectHandle = null;
    }
    this.removeFromJournalEditors();
  }

  private injectIntoJournalEditors(): void {
    try {
      this.forEachJournalEditor((view) => {
        if (view.state.field(miniToolbarMarkerField, false) !== undefined) return;
        view.dispatch({
          effects: StateEffect.appendConfig.of(
            this.journalCompartment.of(this.editorExtensions),
          ),
        });
        this.journalEditors.add(view);
      });
    } catch (error) {
      console.warn("Better Editor could not add the mini toolbar to journal editors.", error);
    }
  }

  private removeFromJournalEditors(): void {
    for (const view of this.journalEditors) {
      if (view.dom.isConnected) {
        view.dispatch({ effects: this.journalCompartment.reconfigure([]) });
      }
    }
    this.journalEditors.clear();
  }

  private forEachJournalEditor(callback: (view: EditorView) => void): void {
    for (const leaf of this.app.workspace.getLeavesOfType("journal-view")) {
      const container = (leaf.view as { containerEl?: HTMLElement })?.containerEl;
      if (!container?.isConnected) continue;
      for (const content of Array.from(container.querySelectorAll<HTMLElement>(".cm-content"))) {
        const view = EditorView.findFromDOM(content);
        if (view) callback(view);
      }
    }
  }

  private refreshReadingViews(): void {
    for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
      const previewMode = (leaf.view as { previewMode?: { rerender?: (full?: boolean) => void } })
        .previewMode;
      previewMode?.rerender?.(true);
    }
  }

  private applyColorsToReadingView(containerEl: HTMLElement, data: FileColorData): void {
    const textRanges = data.text ?? [];
    const backgroundRanges = data.bg ?? [];
    const underlineRanges: Range[] = data.underline ?? [];
    if (!textRanges.length && !backgroundRanges.length && !underlineRanges.length) return;

    const textCursor = new RangeCursor(sortRanges(textRanges));
    const backgroundCursor = new RangeCursor(sortRanges(backgroundRanges));
    const underlineCursor = new RangeCursor(sortRanges(underlineRanges));
    const doc = containerEl.ownerDocument || document;
    const walker = doc.createTreeWalker(containerEl, NodeFilter.SHOW_TEXT, null);
    let offset = 0;

    const isSkippable = (node: Node): boolean => {
      const parent = (node as HTMLElement).parentElement;
      return !!parent?.closest("code, pre, .math, .cm-inline-code, .cm-codeblock");
    };

    let current: Node | null;
    while ((current = walker.nextNode())) {
      const textNode = current as Text;
      const text = textNode.nodeValue ?? "";
      const start = offset;
      const end = start + text.length;
      offset = end;
      if (!text.length || isSkippable(textNode)) continue;

      textCursor.advanceTo(start);
      backgroundCursor.advanceTo(start);
      underlineCursor.advanceTo(start);
      const boundaries = new Set<number>([start, end]);
      textCursor.addBoundaries(boundaries, start, end);
      backgroundCursor.addBoundaries(boundaries, start, end);
      underlineCursor.addBoundaries(boundaries, start, end);
      if (
        boundaries.size === 2 &&
        !textCursor.rangeAt(start) &&
        !backgroundCursor.rangeAt(start) &&
        !underlineCursor.rangeAt(start)
      ) {
        continue;
      }

      const sorted = Array.from(boundaries).sort((left, right) => left - right);
      const fragments: Node[] = [];
      for (let index = 0; index < sorted.length - 1; index++) {
        const segmentStart = sorted[index];
        const segmentEnd = sorted[index + 1];
        if (segmentStart >= segmentEnd) continue;

        const slice = text.slice(segmentStart - start, segmentEnd - start);
        if (!slice) continue;
        const textColor = textCursor.rangeAt(segmentStart)?.color ?? null;
        const backgroundColor = backgroundCursor.rangeAt(segmentStart)?.color ?? null;
        const underline = !!underlineCursor.rangeAt(segmentStart);

        if (!textColor && !backgroundColor && !underline) {
          fragments.push(doc.createTextNode(slice));
        } else {
          const span = createSpan();
          span.setCssStyles({
            color: textColor ?? "",
            backgroundColor: backgroundColor ?? "",
            textDecoration: underline ? "underline" : "",
          });
          span.textContent = slice;
          fragments.push(span);
        }
      }

      const parent = textNode.parentNode;
      if (!parent || !fragments.length) continue;
      for (const fragment of fragments) parent.insertBefore(fragment, textNode);
      parent.removeChild(textNode);
    }
  }
}
