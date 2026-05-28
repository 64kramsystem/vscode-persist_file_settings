import * as vscode from 'vscode';
import {
  loadStorage,
  saveStorage,
  type MementoLike,
  type Storage,
} from './storage';

export function applyRename(s: Storage, oldKey: string, newKey: string): Storage {
  const oldPrefix = oldKey + '/';
  const newPrefix = newKey + '/';
  let changed = false;
  const out: Storage = {};
  for (const [key, entry] of Object.entries(s)) {
    if (key === oldKey || key.startsWith(oldPrefix)) {
      changed = true;
      continue;
    }
    out[key] = entry;
  }
  if (!changed) return s;
  for (const [key, entry] of Object.entries(s)) {
    if (key === oldKey) {
      out[newKey] = entry;
    } else if (key.startsWith(oldPrefix)) {
      out[newPrefix + key.slice(oldPrefix.length)] = entry;
    }
  }
  return out;
}

export async function handleRename(
  memento: MementoLike,
  event: vscode.FileRenameEvent,
): Promise<void> {
  let storage = loadStorage(memento);
  let changed = false;
  for (const { oldUri, newUri } of event.files) {
    if (oldUri.scheme !== 'file') continue;
    const next = applyRename(storage, oldUri.toString(), newUri.toString());
    if (next !== storage) {
      storage = next;
      changed = true;
    }
  }
  if (changed) await saveStorage(memento, storage);
}
