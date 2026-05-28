import * as vscode from 'vscode';
import {
  loadStorage,
  patchEntry,
  saveStorage,
  type WrapState,
  type MementoLike,
} from './storage';
import { docKey, isPersistable, defaultWrapForDoc } from './util';

const editorWrapState = new Map<string, WrapState>();

function flip(s: WrapState): WrapState {
  return s === 'on' ? 'off' : 'on';
}

export async function toggleAndPersist(memento: MementoLike): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return;
  await vscode.commands.executeCommand('editor.action.toggleWordWrap');

  const doc = editor.document;
  if (!isPersistable(doc)) return;
  const key = docKey(doc);
  const before = editorWrapState.get(key) ?? defaultWrapForDoc(doc);
  const after = flip(before);
  editorWrapState.set(key, after);
  const next = patchEntry(loadStorage(memento), key, { wordWrap: after }, Date.now());
  await saveStorage(memento, next);
}

export async function restoreOnActiveEditor(
  memento: MementoLike,
  editor: vscode.TextEditor,
): Promise<void> {
  const doc = editor.document;
  if (!isPersistable(doc)) return;
  const key = docKey(doc);
  const stored = loadStorage(memento)[key];
  if (!stored?.wordWrap) return;

  const current = editorWrapState.get(key) ?? defaultWrapForDoc(doc);
  if (current !== stored.wordWrap) {
    await vscode.commands.executeCommand('editor.action.toggleWordWrap');
  }
  editorWrapState.set(key, stored.wordWrap);
}

export function forgetWrap(key: string): void {
  editorWrapState.delete(key);
}
