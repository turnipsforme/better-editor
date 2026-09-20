# Better Editor

Better Editor brings a set of focused writing and workspace tools into one Obsidian plugin. Every feature has its own switch in **Settings → Better Editor**. Turning a feature off also removes its commands and stops its automatic behavior.

## Features

### Website link filing

**Better Editor: Move standalone website links to Links list** moves lone `http://` and `https://` links under a `[[Links]]` list. It leaves paragraph links, task links, images, inline code, and fenced code alone.

### Note organizer

**Better Editor: Organize current note** can be run at any time, even when automatic organization is off. Manual and automatic organization each have their own settings:

| Setting | Choices / behavior |
| --- | --- |
| Empty lines | Remove all, collapse repeated blank lines to one, or keep all |
| Move website links to Links | File standalone website links under the Links list |
| Move tasks to Tasks | Move top-level tasks and their children under the first Tasks or To-do heading |
| Move free text to Notes | Move simple text lines and list items under the first Notes heading |
| Add bullets to text | Add bullets whether text moves or stays in place |

Existing behavior stays enabled by default. Turning off **Website link filing** disables link filing in both organizer modes as well as its standalone command. Task and note movement require an existing matching heading; those headings are not created automatically. Turning off movement does not turn off bullet formatting, which has its own switch.

**Organize notes when opened** enables the automatic profile. **Only daily notes** limits it to the Daily notes core plugin's folder and date format. Feature switches appear beside their related settings, and disabled features keep their saved options.

The organizer protects YAML frontmatter, fenced code (including longer fences), HTML comments, display math, headings, link definitions, and compound list blocks. Links nested under another item or attached to indented children stay in place. Empty-line cleanup applies outside protected literal blocks. Organization is an ordinary editor edit that can be undone.

### Smart selection

**Better Editor: Expand selection by paragraph, section, then note** grows the selection in three steps:

1. Select the current paragraph without its list or task marker.
2. Select the text below the current heading and above the next heading.
3. Select the whole note except its first top-level `#` heading.

### Task marker deletion

When Backspace or Delete reaches a task marker such as `- [ ] ` or `- [x] `, Better Editor removes the marker as one unit. This also works with multiple cursors.

### Mini toolbar

On desktop, a floating toolbar appears when you select text. It includes cut, copy, bold, italic, strikethrough, and underline. The color picker has been removed.

The Copy, Strikethrough, and Underline buttons can each be changed to Heading 2, Heading 3, or Heading 4 in Better Editor's settings. Heading actions replace an existing heading marker cleanly. The toolbar and saved styling also work in Journal View editors, while small embedded editors such as table cells are left alone.

Underlines and any colors or highlights saved in earlier releases are stored in Better Editor's local plugin data instead of being written into the Markdown. Existing saved formatting remains readable, but there is no color picker or color-setting action. They will not appear in other Markdown apps and are hidden while the Mini toolbar feature is disabled.

### Tab bar controls

The desktop-only **Better Editor: Hide/show tab bar** command hides or shows the main tab bar in the current window. It keeps the editor in the freed space and adds a configurable top gradient behind the window controls. The tab bar can also hide automatically in each window that has only one main tab open.

### Linked file deletion

**Better Editor: Delete current file and clean linked mentions** uses Obsidian's normal deletion confirmation and configured trash location. Before deleting the file, it updates links to that file in other Markdown notes. In settings, choose either:

- **Keep their display text** to turn wiki links and Markdown links into unlinked text
- **Remove them completely** to remove only the matching link tokens

Better Editor prepares and validates every edit before changing a linked note. If a note changes during deletion or every mention cannot be located safely, deletion stops. If moving the file to trash fails, completed link edits are restored when it is safe to do so.

## Installation

### BRAT

1. Install BRAT in Obsidian.
2. Add `turnipsforme/better-editor` as a beta plugin.
3. Enable **Better Editor** in **Settings → Community plugins**.

### Manual

Copy `main.js`, `manifest.json`, and `styles.css` into:

```text
<vault>/.obsidian/plugins/better-editor/
```

Then reload Obsidian and enable **Better Editor**.

## Latest release: 1.3.1

Fixes the Obsidian review findings by using its supported style helper for toolbar positioning and making the cut and copy button callbacks return synchronously. Clipboard actions still run asynchronously and keep their existing failure handling.

### 1.3.0

Removes the color picker, its menus, color-setting actions, and unused menu styles. The six remaining toolbar buttons have clear labels and focus indicators, retain the selection when clicked, and update immediately when their heading options change. Positioning handles rapid updates, right-to-left selections, existing selections on startup, and closed toolbars. Escape dismisses the toolbar; opening and closing stay instant.

Existing saved formatting remains readable. See [the audit notes](AUDIT.md) for the Emil-based toolbar review, validation, and remaining limitations.

## Development

```sh
npm install
npm test
npm run build
```

## Privacy

Better Editor works locally. It does not require an account, make network requests, use telemetry, or access files outside your Obsidian vault.

## Credits

The mini toolbar is based on [xRyul's Mini Toolbar V2](https://github.com/xRyul/obsidian-mini-toolbar-v2), which builds on [Quorafind's Mini Toolbar](https://github.com/Quorafind/Obsidian-Mini-Toolbar). See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for its license notice.

## License

Better Editor is released under the MIT License. See [LICENSE](LICENSE).
