# Adding features from another plugin

- Read its full source, settings, styles, tests, manifest, and license first.
- Move every useful behavior and setting into a clearly named Better Editor module. Do not depend on the old plugin folder.
- Add one main feature switch. When it is off, stop its behavior and remove its commands. Disable its smaller settings too.
- Keep manual and automatic commands, edge cases, and saved data working. Obsidian will show commands as `Better Editor: Command name`.
- Remove old names from code, IDs, CSS, settings, and user text. Keep required credits and license notices.
- Add tests, update the README and release files, then run the full test and production build before publishing.
