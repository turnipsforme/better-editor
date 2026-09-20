# Mini toolbar review for 1.3.0

Reviewed the complete selection-toolbar UI, actions, settings refresh, positioning, selection handling, styles, and lifecycle using Emil Kowalski's design-engineering guidance. This is a frequent editing control, so opening and closing remain immediate. The user requested removal of the color picker.

| Before | After | Why |
| --- | --- | --- |
| Color picker button, menus, palette actions, DOM customization, and menu styles | All removed; six formatting buttons remain | Remove the unwanted feature and its upkeep |
| Some icon buttons had no descriptive tooltip | Every button has a tooltip and accessible name | Make actions understandable without guessing icons |
| Pointer presses could move focus away from the editor | Primary mouse presses keep editor focus and selection | Apply formatting to the intended selection |
| Button settings changed while visible UI remained stale | Settings refresh rebuilds the visible toolbar immediately | Heading replacements should take effect at once |
| A toolbar could appear before positioning completed | Toolbar stays hidden until its position is ready | Avoid a flash in the wrong place |
| Older async position results could overwrite newer ones | Only the latest request can update the current toolbar | Avoid jumps during rapid selection changes |
| Selection bounds disagreed with reported width for right-to-left text | Bounds and width use the same minimum and maximum coordinates | Give positioning consistent geometry |
| The first selection range anchored the popup | The primary selection anchors it | Match the selection used by the formatting actions |
| An existing selection did not create a toolbar at startup | Initial nonempty selections create one immediately | Consistent behavior when enabling the feature |
| No explicit keyboard focus treatment or dismissal | Visible focus outlines and Escape dismissal | Support keyboard use |
| Generic button styling and tiny unconstrained targets | At least 28px targets, hover feedback for precise pointers, subtle press feedback | Improve desktop usability without slowing frequent actions |
| Deep equality checks over tooltip objects containing newly created functions | Identity checks plus explicit settings refresh | Remove work that could not avoid an update; remove the unused dependency |

Saved text colors and highlights from older releases remain readable, alongside underline support. Their storage and legacy theme values remain for compatibility; no picker or code for applying new colors remains.

Validation: all 130 tests passed, including eight new DOM interaction tests and a primary-selection regression. TypeScript checks and the production build passed. DOM tests cover six-button rendering, accessible names, empty selections, live heading-setting changes, click selection retention, right-to-left bounds, async result ordering, destruction, and positioning failures. The production JavaScript bundle is about 9.6 KB smaller than 1.2.0. The test DOM library is a development-only dependency.

No Obsidian app controls or live-vault UI tests were used. Native theme rendering, real layout measurement, and keyboard behavior inside Obsidian remain unverified by these DOM tests. The position-based formatting limitations described below still apply.

---

# Reliability and performance review for 1.2.0

Reviewed the organizer, settings and startup, editor commands, toolbar and local formatting storage, tab controls, task marker handling, and linked-file deletion. Changes focus on concrete faults and repeated work rather than replacing the plugin architecture.

## Fixed

- Every existing organizer transformation has its own setting in independent manual and automatic profiles. Existing installations retain their previous defaults and feature switches.
- Link filing now shares the organizer's literal-block checks. It no longer extracts URLs from YAML, longer fenced examples, HTML comments, display math, nested items, or parents with indented children. Every existing Links list is respected, and fake sections inside literal blocks are ignored.
- Blank-line controls are independent of movement and bullet formatting. Keeping blank lines no longer causes simple lines followed by a gap to be mistaken for compound blocks. Existing trailing gaps are saved when link filing is combined with Keep all.
- Section boundaries use a stack and membership uses line masks instead of repeatedly searching every section. Task blocks are flattened without repeatedly copying an accumulating array. Link filing does not scan ahead through blank lines unless a movable link was actually found.
- Automatic file edits recheck enabled settings when the vault callback runs and stop after unload. Editor organization uses an undoable range edit instead of replacing the editor value, with cursor columns clamped to the resulting line.
- Unrelated settings no longer refresh all toolbars and reading views. Cursor-only transactions reuse formatting decorations. Typing in unstyled notes no longer saves empty formatting data.
- Toolbar selection offsets use numeric bounds. Async positioning ignores a toolbar that closed while positioning was pending. Detached journal editors are released from the tracking set, and pending injections check whether the feature remains enabled.
- Cut waits for a successful clipboard write before removing text and checks that the note and selection have not changed in the meantime. Failed copy/cut operations show a notice.
- Multiple task-marker deletions map cursor positions through the combined edit. Removed the redundant deletion observer, which dispatched during a CodeMirror update and used old change coordinates against the new document. Marker deletion is handled in one keyboard transaction.
- Release automation can upload assets to an already-created release, allowing a verified manual publication without a duplicate-release failure.

## Validation

- 121 automated tests, including all 48 combinations of organizer toggles and blank-line modes, repeated-run stability, CRLF handling, literal Markdown blocks, old settings migration, manual and automatic entry points, delayed automatic callbacks, and settings grouping/disabled states.
- Regression checks for formatting-state reuse, feature toggles, numeric selection bounds, clipboard failure/races, and multiple-cursor task deletion.
- TypeScript check and production build.
- Synthetic organizer timing on the development machine, median of five warmed runs: 1,000 task sections / 26,779 characters took 3.6 ms; 10,000 sections / 287,779 characters took 31.1 ms. This measures the pure transformation, not Obsidian rendering or vault I/O.
- No Obsidian UI automation or live-vault testing was performed.

## Remaining limitations

The organizer is a conservative line-based transformation, not a complete Markdown parser. Plain paragraphs are intentionally treated as simple note lines; disable movement and bullets when paragraph structure should stay intact. User-supplied HTML and plugin-specific Markdown can have semantics beyond these checks.

Local toolbar formatting remains position-based. Arbitrary edits outside an open editor and moving styled passages can invalidate those positions. Reading-view styling also retains the existing rendered-text offset approach, which does not reliably map complex Markdown source positions to rendered content. A source-aware formatting model would be a separate change requiring broader editor and preview coverage.

Linked-file deletion retains its existing guarded staging, content checks, and rollback behavior. Its correctness depends on Obsidian's metadata cache being complete; it stops when known references cannot be safely located. This review does not make it a transaction across the entire vault.
