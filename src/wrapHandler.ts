import * as vscode from 'vscode';
import {
  loadStorage,
  patchEntry,
  saveStorage,
  type WrapState,
  type MementoLike,
} from './storage';
import { docKey, isPersistable } from './util';

// Documents whose wrap state has already been reconciled this session. VS Code stores wrap as an
// in-memory transient model property that resets when a document is closed and reopened, so a
// document we have not yet touched is guaranteed to be at its configured default.
const synced = new Set<string>();

function defaultWrapForDoc(doc: vscode.TextDocument): WrapState {
  const val = vscode.workspace.getConfiguration('editor', doc).get<string>('wordWrap', 'off');
  return val === 'off' ? 'off' : 'on';
}

// Bound to Alt+W by two keybindings that route on the `editorWordWrap` context key and pass the
// resulting state as `target`. Because the routing reflects VS Code's real wrap state, `target` is
// authoritative regardless of how wrap was last toggled (including the built-in Alt+Z).
export async function setWordWrap(memento: MementoLike, target: WrapState): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return;
  await vscode.commands.executeCommand('editor.action.toggleWordWrap');
  const doc = editor.document;
  if (!isPersistable(doc)) return;
  const key = docKey(doc);
  synced.add(key);
  await saveStorage(memento, patchEntry(loadStorage(memento), key, { wordWrap: target }, Date.now()));
}

export async function restoreOnActiveEditor(
  memento: MementoLike,
  editor: vscode.TextEditor,
): Promise<void> {
  const doc = editor.document;
  if (!isPersistable(doc)) return;
  const key = docKey(doc);
  if (synced.has(key)) return;
  synced.add(key);
  const stored = loadStorage(memento)[key];
  if (stored?.wordWrap && stored.wordWrap !== defaultWrapForDoc(doc)) {
    await vscode.commands.executeCommand('editor.action.toggleWordWrap');
  }
}

export function forgetWrap(key: string): void {
  synced.delete(key);
}
