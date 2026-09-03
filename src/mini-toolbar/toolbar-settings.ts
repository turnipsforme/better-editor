export type HeadingAction = "heading-2" | "heading-3" | "heading-4";

export type ToolbarButtonAction =
  | "copy"
  | "strikethrough"
  | "underline"
  | HeadingAction;

export interface FloatingToolbarSettings {
  enabled: boolean;
  copyButtonAction: ToolbarButtonAction;
  strikethroughButtonAction: ToolbarButtonAction;
  underlineButtonAction: ToolbarButtonAction;
}

export const DEFAULT_TOOLBAR_SETTINGS: FloatingToolbarSettings = {
  enabled: true,
  copyButtonAction: "copy",
  strikethroughButtonAction: "strikethrough",
  underlineButtonAction: "underline",
};

export const isHeadingAction = (action: ToolbarButtonAction): action is HeadingAction =>
  action === "heading-2" || action === "heading-3" || action === "heading-4";

export const headingLevelForAction = (action: HeadingAction): number =>
  Number(action.slice(-1));

export const isToolbarButtonAction = (
  action: unknown,
): action is ToolbarButtonAction =>
  typeof action === "string" &&
  ["copy", "strikethrough", "underline", "heading-2", "heading-3", "heading-4"].includes(
    action,
  );

export const normalizeToolbarAction = (
  action: unknown,
  defaultAction: ToolbarButtonAction,
): ToolbarButtonAction => {
  if (action === defaultAction) return defaultAction;
  if (isToolbarButtonAction(action) && isHeadingAction(action)) return action;
  return defaultAction;
};
