import { EditorState, StateField } from "@codemirror/state";
import {
  App,
  BaseComponent,
  ButtonComponent,
  Component,
  Menu,
  setIcon,
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
  NOTION_TEXT_COLOR_NAMES,
  setTextColorByName,
  NOTION_TEXT_COLOR_MAP,
  NOTION_BG_COLOR_NAMES,
  setBgColorByName,
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

  const sel = state.selection.ranges[0];
  if (!sel) return null;

  const { anchor, head, empty } = sel;
  let [start, end] = [anchor, head].sort();

  const createToolbar = (container: HTMLElement) => {
    const toolbar = new ToolBar(container)
      .addSmallButton((btn) =>
        btn.setIcon("scissors").onClick(() => cutText(state)),
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
      .addSmallButton((btn) => btn.setIcon("bold").onClick(() => boldText(app)))
      .addSmallButton((btn) =>
        btn.setIcon("italic").onClick(() => italicText(app)),
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
      )
      // Text color dropdown (Notion-like colors)
      .addSmallButton((btn) =>
        btn
          .setDropdownIcon("palette")
          .setTooltip("Text color")
          .setOptionsList(NOTION_TEXT_COLOR_NAMES)
          .setOnSelectOption((name) => setTextColorByName(state, name))
          .setOnSelectBgOption((name) => setBgColorByName(state, name))
          // onClick is required to attach the dropdown handler
          .onClick(() => {}),
      );

    return toolbar;
  };

  return {
    start: start,
    end: empty ? undefined : end,
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

const getComponentDom = (component: object): HTMLElement | undefined => {
  const dom = (component as { dom?: unknown }).dom;
  return dom instanceof HTMLElement ? dom : undefined;
};

class SmallButton extends BaseComponent {
  button: ButtonComponent;
  dropdownOptions: string[] = [];
  onSelectOption: ((title: string) => void) | null = null;
  onSelectBgOption: ((title: string) => void) | null = null;
  menu: Menu | undefined;
  menuOpened = false;

  constructor(containerEl: HTMLElement) {
    super();
    this.button = new ButtonComponent(containerEl);
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

  setDropdownIcon(iconId: string = "highlighter"): this {
    const highlightIconDiv = this.button.buttonEl.createDiv(
      "better-editor-mini-toolbar-highlight-icon",
    );
    const iconDiv = this.button.buttonEl.createDiv(
      "better-editor-mini-toolbar-icon-with-icon",
    );
    setIcon(highlightIconDiv, iconId);
    setIcon(iconDiv, "chevron-down");

    return this;
  }

  setTooltip(tooltip: string): this {
    this.button.setTooltip(tooltip);
    return this;
  }

  setOptionsList(optionsList: string[]): this {
    this.dropdownOptions = optionsList;
    return this;
  }

  setOnSelectOption(handler: (title: string) => void): this {
    this.onSelectOption = handler;
    return this;
  }

  setOnSelectBgOption(handler: (title: string) => void): this {
    this.onSelectBgOption = handler;
    return this;
  }

  onClick(cb: (evt: MouseEvent) => void): this {
    if (this.dropdownOptions.length > 0) {
      this.button.onClick((evt) => this.showEditMenu(evt));
      return this;
    }
    this.button.onClick(cb);
    return this;
  }

  showEditMenu(event: MouseEvent): void {
    this.menuOpened = !this.menuOpened;
    if (!this.menuOpened) {
      return;
    }
    this.menu = new Menu();
    this.menu.onHide(() => {
      this.menuOpened = false;
    });

    // Customize menu DOM to mimic Notion color picker
    const menuEl = getComponentDom(this.menu);
    if (menuEl) {
      menuEl.addClass("better-editor-mini-toolbar-color-menu");
      // Defer grid/header decoration until after items are rendered
    }

    const sortButton = event.currentTarget as HTMLElement;
    const currentTargetRect = sortButton.getBoundingClientRect();
    const menuShowPoint = {
      x: currentTargetRect.left - 6,
      y: currentTargetRect.bottom + 6,
    };
    // Text color items
    for (let a = 0; a < this.dropdownOptions?.length; a++) {
      const name = this.dropdownOptions[a];
      const colorHex =
        name === "Default"
          ? "var(--text-normal)"
          : NOTION_TEXT_COLOR_MAP[name as keyof typeof NOTION_TEXT_COLOR_MAP];
      this.menu.addItem((item) => {
        item.setTitle("A").onClick(() => {
          this.onSelectOption?.(name);
        });
        const tooltip = name === "Default" ? "Default" : `${name} text`;
        const itemEl = getComponentDom(item);
        itemEl?.setAttr("title", tooltip);
        itemEl?.setAttr("data-color-kind", "text");
        itemEl?.addClass("better-editor-mini-toolbar-color-item");
        const titleEl = itemEl?.querySelector(
          ".menu-item-title",
        ) as HTMLElement | undefined;
        if (titleEl) {
          titleEl.setCssStyles({ color: colorHex });
        }
      });
    }

    // Visual separator between sections
    this.menu.addSeparator();

    // Background highlight items
    for (let b = 0; b < NOTION_BG_COLOR_NAMES.length; b++) {
      const name = NOTION_BG_COLOR_NAMES[b];
      const colorValue = name === "Default" ? "transparent" : `var(--better-editor-toolbar-bg-${name.toLowerCase()})`;
      this.menu.addItem((item) => {
        item.setTitle("A").onClick(() => {
          this.onSelectBgOption?.(name);
        });
        const tooltip = name === "Default" ? "Default background" : `${name} background`;
        const itemEl = getComponentDom(item);
        itemEl?.setAttr("title", tooltip);
        itemEl?.setAttr("data-color-kind", "background");
        itemEl?.addClass("better-editor-mini-toolbar-color-item");
        const titleEl = itemEl?.querySelector(
          ".menu-item-title",
        ) as HTMLElement | undefined;
        if (titleEl) {
          titleEl.setCssStyles({
            backgroundColor: colorValue,
            color: "var(--text-normal)",
          });
        }
      });
    }

    this.menu.setParentElement(sortButton).showAtPosition(menuShowPoint);

    // Decorate once DOM is fully built
    window.requestAnimationFrame(() => {
      const menuEl = this.menu ? getComponentDom(this.menu) : undefined;
      if (!menuEl) return;
      const scrollerEl =
        (menuEl.querySelector(".menu-scroller") as HTMLElement | null) ||
        (menuEl.querySelector(".menu-scroll") as HTMLElement | null) ||
        menuEl;

      // Try to split items into two groups (text/background)
      let groups = Array.from(scrollerEl.querySelectorAll<HTMLElement>(".menu-group"));

      if (groups.length === 1) {
        // Create a second group and move background items into it
        const bgGroup = scrollerEl.createDiv({ cls: "menu-group" });
        const allItems = Array.from(groups[0].querySelectorAll<HTMLElement>(".menu-item"));
        for (const it of allItems) {
          const kind = it.getAttr("data-color-kind");
          if (kind === "background") {
            bgGroup.appendChild(it);
          }
        }
        // Insert bg group after original
        groups[0].insertAdjacentElement("afterend", bgGroup);
        groups = [groups[0], bgGroup];
      }

      const textGroup = groups[0];
      const bgGroup = groups[1];

      if (textGroup) {
        const textHeader = scrollerEl.createDiv({
          cls: "better-editor-mini-toolbar-color-header",
          text: "Text colour",
        });
        scrollerEl.insertBefore(textHeader, textGroup);
        textGroup.addClass("better-editor-mini-toolbar-color-grid");
      }
      if (bgGroup) {
        const bgHeader = scrollerEl.createDiv({
          cls: "better-editor-mini-toolbar-color-header",
          text: "Background",
        });
        scrollerEl.insertBefore(bgHeader, bgGroup);
        bgGroup.addClass("better-editor-mini-toolbar-color-grid");
      }
    });
  }

}

export class ToolBar extends Component {
  dom: HTMLElement;
  smallBtnContainer: HTMLElement;

  constructor(container: HTMLElement) {
    super();
    this.dom = container.createDiv({ cls: "cm-better-editor-mini-toolbar" });
    this.smallBtnContainer = this.dom;
  }

  addSmallButton(cb: (button: SmallButton) => unknown): this {
    cb(new SmallButton(this.smallBtnContainer));
    return this;
  }

  unloading: boolean = false;

  hide() {
    this.unload();
    if (this.unloading) return this;
    this.unloading = true;
    this.dom.detach();
    this.unloading = false;
    return this;
  }
}
