import { EditorState, StateField } from "@codemirror/state";
import {
  App,
  BaseComponent,
  ButtonComponent,
  Component,
} from "obsidian";

import { showTooltip, Tooltip } from "./popper";
import { refreshMiniToolbarEffect } from "./effects";
import {
  applyHeading,
  boldText,
  copyText,
  cutText,
  italicText,
  strikethroughText,
  toggleUnderline,
} from "./defaultCommand";
import { isCodeMirrorView, type EditorWithCodeMirror } from "./editor-view";
import {
  headingLevelForAction,
  isHeadingAction,
  FloatingToolbarSettings,
  ToolbarButtonAction,
} from "./toolbar-settings";

export { refreshMiniToolbarEffect };

/**
 * Presence marker so we can tell whether an editor already carries the mini
 * toolbar extensions. Used when injecting into editors that Obsidian does not
 * cover with registerEditorExtension (e.g. embedded editors inside custom
 * views like Journal View).
 */
export const miniToolbarMarkerField = StateField.define<null>({
  create: () => null,
  update: (value) => value,
});

const getCursorTooltips = (
  state: EditorState,
  app: App,
  getSettings: () => FloatingToolbarSettings,
): Tooltip | null => {
  const settings = getSettings();
  if (!settings.enabled) return null;

  const sel = state.selection.main;
  if (!sel || sel.empty) return null;

  const { anchor, head } = sel;
  const start = Math.min(anchor, head);
  const end = Math.max(anchor, head);

  const createToolbar = (container: HTMLElement) => {
    const toolbar = new ToolBar(container)
      .addSmallButton((btn) =>
        btn.setIcon("scissors").setTooltip("Cut").onClick(() => cutText(state)),
      )
      .addSmallButton((btn) =>
        configureActionButton(
          btn,
          state,
          settings.copyButtonAction,
          "copy",
          "Copy",
          () => copyText(state),
        ),
      )
      .addSmallButton((btn) => btn.setIcon("bold").setTooltip("Bold").onClick(() => boldText(app)))
      .addSmallButton((btn) =>
        btn.setIcon("italic").setTooltip("Italic").onClick(() => italicText(app)),
      )
      .addSmallButton((btn) =>
        configureActionButton(
          btn,
          state,
          settings.strikethroughButtonAction,
          "strikethrough",
          "Strikethrough",
          () => strikethroughText(app),
        ),
      )
      .addSmallButton((btn) =>
        configureActionButton(
          btn,
          state,
          settings.underlineButtonAction,
          "underline",
          "Underline",
          () => toggleUnderline(state),
        ),
      );
    return toolbar;
  };

  return {
    start,
    end,
    create: createToolbar,
  };
};

export const cursorTooltipField = (
  app: App,
  getSettings: () => FloatingToolbarSettings,
) => {
  return StateField.define<Tooltip | null>({
    create: (state: EditorState) => getCursorTooltips(state, app, getSettings),

    update: (tooltips, tr) => {
      if (
        !tr.docChanged &&
        !tr.selection &&
        !tr.effects.some((effect) => effect.is(refreshMiniToolbarEffect))
      ) {
        return tooltips;
      }
      return getCursorTooltips(tr.state, app, getSettings);
    },

    // enable showtooltips extension with tooltips info provided from statefield
    provide: (f) => showTooltip.from(f),
  });
};

export const ToolBarExtension = (
  app: App,
  getSettings: () => FloatingToolbarSettings,
) => {
  return [cursorTooltipField(app, getSettings), miniToolbarMarkerField];
};

const configureActionButton = (
  button: SmallButton,
  state: EditorState,
  action: ToolbarButtonAction,
  defaultIcon: string,
  defaultTooltip: string,
  defaultHandler: () => void,
): SmallButton => {
  if (isHeadingAction(action)) {
    const level = headingLevelForAction(action);
    return button
      .setHeadingIcon(level)
      .setTooltip(`Heading ${level}`)
      .onClick(() => applyHeading(state, level));
  }

  return button
    .setIcon(defaultIcon)
    .setTooltip(defaultTooltip)
    .onClick(() => defaultHandler());
};

export const refreshVisibleToolbars = (app: App) => {
  // Journal View mounts Obsidian's own markdown editors for each day; they are
  // covered by the injection below, so refresh them too.
  const leafTypes = ["markdown", "journal-view"];
  for (const type of leafTypes) {
    for (const leaf of app.workspace.getLeavesOfType(type)) {
      const view = leaf.view as typeof leaf.view & {
        editor?: EditorWithCodeMirror;
      };
      const cm = view.editor?.cm ?? view.editor?.cmEditor ?? view.editor?.cm6;
      if (isCodeMirrorView(cm)) {
        cm.dispatch({ effects: refreshMiniToolbarEffect.of(undefined) });
      }
    }
  }
};

class SmallButton extends BaseComponent {
  button: ButtonComponent;
  constructor(containerEl: HTMLElement) {
    super();
    this.button = new ButtonComponent(containerEl);
    this.button.buttonEl.type = "button";
    // Keep the editor selection and active command target on pointer presses.
    this.button.buttonEl.addEventListener("mousedown", (event) => {
      if (event.button === 0) event.preventDefault();
    });
  }

  setIcon(iconId: string): this {
    this.button.setIcon(iconId);
    return this;
  }

  setHeadingIcon(level: number): this {
    this.button.buttonEl.empty();
    const label = this.button.buttonEl.createSpan({
      cls: "better-editor-mini-toolbar-heading-icon",
    });
    label.appendText("H");
    label.createEl("sup", { text: String(level) });
    this.button.buttonEl.setAttr("aria-label", `Heading ${level}`);
    return this;
  }

  setTooltip(tooltip: string): this {
    this.button.setTooltip(tooltip);
    this.button.buttonEl.setAttribute("aria-label", tooltip);
    return this;
  }

  onClick(cb: (evt: MouseEvent) => void): this {
    this.button.onClick(cb);
    return this;
  }
}

export class ToolBar extends Component {
  dom: HTMLElement;
  smallBtnContainer: HTMLElement;

  constructor(container: HTMLElement) {
    super();
    this.dom = container.createDiv({ cls: "cm-better-editor-mini-toolbar" });
    this.smallBtnContainer = this.dom;
    this.dom.setAttribute("role", "group");
    this.dom.setAttribute("aria-label", "Text formatting");
  }

  addSmallButton(cb: (button: SmallButton) => unknown): this {
    const button = new SmallButton(this.smallBtnContainer);
    cb(button);
    return this;
  }

  hide(): this {
    this.unload();
    this.dom.detach();
    return this;
  }
}
