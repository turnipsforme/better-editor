import { Platform, type App } from "obsidian";

export interface TabBarOptions {
  enabled: boolean;
  hidden: boolean;
  autoHideSingleTab: boolean;
  gradientHeight: number;
}

export class TabBarController {
  constructor(
    private readonly app: App,
    private readonly getOptions: () => TabBarOptions
  ) {}

  refresh(): void {
    const options = this.getOptions();
    if (!Platform.isDesktopApp || !options.enabled) {
      this.clearStyles();
      return;
    }

    let tabCount = 0;
    this.app.workspace.iterateRootLeaves(() => {
      tabCount++;
    });

    const autoHide = options.autoHideSingleTab && tabCount === 1;
    document.body.classList.toggle("better-editor-hide-tabs", options.hidden || autoHide);
    document.body.style.setProperty(
      "--better-editor-tab-gradient-height",
      `${options.gradientHeight}px`
    );
  }

  destroy(): void {
    this.clearStyles();
  }

  private clearStyles(): void {
    document.body.classList.remove("better-editor-hide-tabs");
    document.body.style.removeProperty("--better-editor-tab-gradient-height");
  }
}
