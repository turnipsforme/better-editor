import {
  EditorView,
  PluginValue,
  ViewPlugin,
  ViewUpdate,
} from "@codemirror/view";
import { ClientRectObject } from "@floating-ui/core";
import { computePosition, flip, offset, shift } from "@floating-ui/dom";
import { refreshMiniToolbarEffect } from "../effects";
import { editorInfoField } from "obsidian";

import { ToolBar } from "../toolbar";
import { tooltipConfig } from "./config";
import { ToolbarEventName, Tooltip } from "./define";
import { showTooltip } from "./index";

const isEmbeddedEditorView = (view: EditorView): boolean => {
  // Known wrapper for Obsidian Live Preview table cell editors.
  // Keep the selector narrow to avoid false positives.
  return !!view.dom.closest(".cm-table-widget");
};

const isSelectionInsideEmbeddedChild = (view: EditorView): boolean => {
  try {
    const sel = view.dom.ownerDocument.getSelection();
    const node = sel?.anchorNode as Node | null;
    if (!node) return false;
    const el = (node.nodeType === 1 ? (node as Element) : (node.parentElement)) as HTMLElement | null;
    if (!el) return false;
    // If selection lives inside a table widget, treat it as embedded.
    return !!el.closest(".cm-table-widget");
  } catch {
    return false;
  }
};
type Rect = { left: number; right: number; top: number; bottom: number };
export const getRectFromPosCoords = (
  start: Rect | null,
  end?: Rect | null,
): ClientRectObject | null => {
  if (!start) return null;
  const left = Math.min(start.left, end?.left ?? start.left);
  const right = Math.max(start.right, end?.right ?? start.right);
  return {
    left, right, top: start.top, bottom: start.bottom,
    width: right - left, height: start.bottom - start.top,
    x: left, y: start.top,
  };
};

export class ViewPluginClass implements PluginValue {
  containerEl = this.view.dom;
  toolbar: ToolBar | null = null;
  embedded: boolean;

  get workspace() {
    return this.view.state.field(editorInfoField).app.workspace;
  }

  tooltipInfo: Tooltip | null;

  private positionRequest = 0;

  defaultPlacement = this.view.state.facet(tooltipConfig).defaultPlacement;

  constructor(readonly view: EditorView) {
    this.tooltipInfo = view.state.facet(showTooltip);
    this.embedded = isEmbeddedEditorView(view);
    if (this.view.inView && !this.shouldRemoveToolbar() && this.tooltipInfo) this.createToolbar(this.tooltipInfo);
    this.maybeMeasure();
  }

  shouldRemoveToolbar(input?: Tooltip | null): boolean {
    if (this.embedded) return true;
    const info = input ?? this.tooltipInfo;
    return !info || info.end === undefined || info.end <= info.start;
  }

  createToolbar(input?: Tooltip): void {
    if (this.embedded) return;
    const info = input ?? this.tooltipInfo;
    if (!info) return;
    this.removeToolbar();
    const view = this.view.state.field(editorInfoField);
    if (!view?.editor) return;
    const toolbar = info.create(this.containerEl);
    const from = view.editor.offsetToPos(info.start);
    const to = info.end ? view.editor.offsetToPos(info.end) : from;
    this.workspace.trigger(
      ToolbarEventName,
      toolbar,
      { from, to },
      view.editor,
      view,
    );
    this.toolbar = toolbar;
  }

  removeToolbar(): void {
    this.positionRequest++;
    if (!this.toolbar) return;
    this.toolbar.hide();
    this.toolbar = null;
  }

  update(update: ViewUpdate): void {
    const input = update.state.facet(showTooltip);
    const updated = input !== this.tooltipInfo;
    this.tooltipInfo = input;
    if (this.embedded || !this.view.inView || isSelectionInsideEmbeddedChild(this.view)) {
      this.removeToolbar();
      return;
    }
    const settingsChanged = update.transactions.some((transaction) =>
      transaction.effects.some((effect) => effect.is(refreshMiniToolbarEffect)));
    if (this.shouldRemoveToolbar()) this.removeToolbar();
    else if (input && (!this.toolbar || settingsChanged)) this.createToolbar(input);

    const newConfig = update.state.facet(tooltipConfig);
    const placementChanged = newConfig.defaultPlacement !== this.defaultPlacement;
    this.defaultPlacement = newConfig.defaultPlacement;
    if (updated || update.geometryChanged || settingsChanged || placementChanged) this.maybeMeasure();
  }

  destroy(): void {
    this.removeToolbar();
    this.toolbar = null;
  }

  readFromDOM = (): ClientRectObject | null => {
    if (this.embedded) return null;
    if (this.tooltipInfo) {
      let { start, end } = this.tooltipInfo;
      if (end && start === end) {
        end = undefined;
      }
      const startRect = this.view.coordsAtPos(start);
      let endRect = end ? this.view.coordsAtPos(end) : null;
      // Anchor multiline selections to the first visual line.
      if (startRect && endRect && startRect.top !== endRect.top) {
        const contentRect = this.view.contentDOM.getBoundingClientRect();
        endRect = {
          left: contentRect.right,
          right: contentRect.right,
          top: startRect.top,
          bottom: startRect.bottom,
        };
      }
      return getRectFromPosCoords(startRect, endRect);
    }
    return null;
  };

  async computePosition(refRect: ClientRectObject): Promise<void> {
    if (this.embedded || !this.toolbar) return;
    const request = ++this.positionRequest;
    const { padding } = this.view.state.facet(tooltipConfig);
    const toolbar = this.toolbar;
    const reference = { getBoundingClientRect: () => refRect, contextElement: this.view.scrollDOM };
    try {
      const { x, y } = await computePosition(reference, toolbar.dom, {
        placement: this.defaultPlacement,
        middleware: [
          offset({ mainAxis: 5 }),
          flip({ padding, boundary: this.view.scrollDOM }),
          shift({ padding, boundary: this.view.scrollDOM }),
        ],
      });
      if (this.toolbar !== toolbar || request !== this.positionRequest) return;
      toolbar.dom.setCssStyles({
        top: "0", left: "0", visibility: "visible",
        transform: `translate(${Math.round(x)}px,${Math.round(y)}px)`,
      });
    } catch (error) {
      if (this.toolbar !== toolbar || request !== this.positionRequest) return;
      this.removeToolbar();
      console.warn("Better Editor could not position the mini toolbar.", error);
    }
  }

  maybeMeasure(): void {
    if (this.embedded || !this.view.inView || !this.toolbar) return;
    this.view.requestMeasure({
      key: this,
      read: this.readFromDOM,
      write: (rect) => {
        if (rect) void this.computePosition(rect);
        else if (this.toolbar) this.toolbar.dom.setCssStyles({ visibility: "hidden" });
      },
    });
  }
}

const tooltipPlugin = ViewPlugin.fromClass(ViewPluginClass, {
  eventHandlers: {
    keydown(event) {
      if (event.key !== "Escape" || !this.toolbar) return false;
      this.removeToolbar();
      this.view.focus();
      return true;
    },
    scroll() {
      this.maybeMeasure();
    },
  },
});
export default tooltipPlugin;
