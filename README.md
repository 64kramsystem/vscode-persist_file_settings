# Persist Per-File Settings

VS Code extension. Remembers each file's **language mode** and **word wrap**
state and restores them when the file is reopened. Cleans up stale entries
automatically.

## Commands

- `Persist File Settings: Toggle Word Wrap` — bound to **Alt+W**. Toggles wrap
  and persists the new state for the active file.
- `Persist File Settings: Clear for This File` — drop the persisted entry for
  the active file.
- `Persist File Settings: Clear All Entries` — drop every persisted entry
  (modal confirmation).

## Settings

- `persistFileSettings.cleanupAfterDays` (default `14`) — drop entries for
  files not opened within this many days. Cleanup runs once at startup. Set
  to `0` to disable.

## Behavior

**Language**: When you change a file's language mode (status bar, "Change
Language Mode" command, or any extension calling `setTextDocumentLanguage`),
the new language is persisted. On reopen, the persisted language is restored.

The extension distinguishes a language-change close (VS Code emits close+open
without disposing the document — `doc.isClosed === false`) from a real tab
close (`doc.isClosed === true`). Both bugs that the naive close+open
detection would have — same-session reopen overwriting the stored language,
and wrap tracking dropped during language changes — are avoided.

**Word wrap**: Only the extension's `Alt+W` command persists wrap. VS Code's
API does not expose per-editor wrap state nor fire an event on toggle, so
toggling wrap through the View menu, Command Palette, the default `Alt+Z`
binding, or any other path **will not persist** the change.

**Rename**: When a file or folder is renamed inside VS Code, persisted
entries follow. Folder renames migrate every child entry.

**Cleanup**: At startup, after already-open documents have been processed,
entries with `lastOpenedAt` older than `cleanupAfterDays` are pruned.

## Storage

Settings are stored locally in VS Code's `globalState` and are **not** synced
across machines.

## Install (local)

```bash
npm install
npm run compile
npx vsce package
code --install-extension persist-file-settings-0.0.1.vsix
```

## Manual smoke test

After installing the .vsix and reloading VS Code:

1. **Language persistence**: open a file, change its language mode via the
   status bar (e.g. `Plain Text → JavaScript`), close it, reopen → it should
   come back in JavaScript.
2. **Same-session reopen**: same as above, but reopen in the same VS Code
   session — language should still be restored (not overwritten with the
   editor default).
3. **Word-wrap persistence**: open a file, press **Alt+W** to toggle wrap,
   close, reopen → wrap should be in the toggled state.
4. **Word-wrap survives a language change**: with wrap toggled via Alt+W,
   change the file's language mode → wrap state should remain (the editor
   stays open across the close+open pair).
5. **Rename migration**: open a file, toggle wrap (Alt+W), rename the file
   in the Explorer, reopen the renamed file → wrap state preserved.
6. **Folder rename migration**: persist wrap or language for a file inside a
   folder, rename the folder, reopen the file at its new path → persistence
   preserved.
7. **Cleanup**: invoke `Clear All Entries`, persist something, then set
   `persistFileSettings.cleanupAfterDays` to `0` (disabled) and back to `14`
   to confirm the config knob is wired. Entries older than the cutoff
   disappear on next startup.

## Limitations

- **Word-wrap via built-in paths is not persisted** (API limitation — see
  Behavior above).
- **Cross-machine sync** is not supported (`globalState` is local-only by
  design).
- **Concurrent windows can lose an update**: all files share one `globalState` key and each window caches its own copy, so a write from one window can overwrite an entry another window changed at the same moment. It is self-healing — the next toggle, language change, or close rewrites the affected entry — and rare outside heavy multi-window use.
