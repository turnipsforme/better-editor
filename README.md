# Better Editor

Better Editor brings a set of focused writing and workspace tools into one Obsidian plugin. Every feature has its own switch in **Settings → Better Editor**. Turning a feature off also removes its commands and stops its automatic behavior.

## Features

### Website link filing

**Better Editor: Move standalone website links to Links list** moves lone `http://` and `https://` links under a `[[Links]]` list. It leaves paragraph links, task links, images, inline code, and fenced code alone.

### Note organizer

**Better Editor: Organize current note** can be run at any time, even when automatic organization is off. It:

- removes blank lines outside frontmatter and fenced code
- moves top-level tasks below the first Tasks, To-do, or similar heading
- moves simple note lines below the first Notes heading and adds bullets where needed
- files standalone website links when Website link filing is enabled

The organizer leaves YAML frontmatter, fenced code, Markdown headings, indented content, and compound list blocks alone. **Organize notes when opened** can run the same organizer automatically. **Only daily notes** limits it to the Daily notes core plugin's folder and date format.

### Smart selection

**Better Editor: Expand selection by paragraph, section, then note** grows the selection in three steps:

1. Select the current paragraph without its list or task marker.
2. Select the text below the current heading and above the next heading.
3. Select the whole note except its first top-level `#` heading.

### Task marker deletion

When Backspace or Delete reaches a task marker such as `- [ ] ` or `- [x] `, Better Editor removes the marker as one unit. This also works with multiple cursors.

### Mini toolbar

On desktop, a floating toolbar appears when you select text. It includes cut, copy, bold, italic, strikethrough, underline, and a color menu for text and highlights.

The Copy, Strikethrough, and Underline buttons can each be changed to Heading 2, Heading 3, or Heading 4 in Better Editor's settings. Heading actions replace an existing heading marker cleanly. The toolbar and saved styling also work in Journal View editors, while small embedded editors such as table cells are left alone.

Text colors, highlights, and underlines are stored in Better Editor's local plugin data instead of being written into the Markdown. They will not appear in other Markdown apps and are hidden while the Mini toolbar feature is disabled.

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

## Latest release: 1.1.4

Fixes a brief "failed to load" error when Obsidian starts. Tab controls and toolbar refreshes now wait for the workspace to finish opening. Disabling the plugin during startup also cancels its pending setup.

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
