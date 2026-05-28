import * as vscode from 'vscode';
import {
  loadStorage,
  patchEntry,
  saveStorage,
  type MementoLike,
} from './storage';
import { docKey, isPersistable } from './util';
import { pendingLanguageChange, restoringLanguage } from './languageDispatch';

export { handleClose, type CloseResult } from './languageDispatch';

export async function handleOpen(
  memento: MementoLike,
  doc: vscode.TextDocument,
): Promise<void> {
  if (!isPersistable(doc)) return;
  const key = docKey(doc);
  const previousLanguageId = pendingLanguageChange.get(key);
  pendingLanguageChange.delete(key);

  if (previousLanguageId !== undefined) {
    const restoreTarget = restoringLanguage.get(key);
    restoringLanguage.delete(key);
    if (restoreTarget === doc.languageId) return;
    if (previousLanguageId !== doc.languageId) {
      await saveStorage(
        memento,
        patchEntry(loadStorage(memento), key, { languageId: doc.languageId }, Date.now()),
      );
    }
    return;
  }

  let storage = loadStorage(memento);
  if (storage[key]) {
    storage = patchEntry(storage, key, {}, Date.now());
    await saveStorage(memento, storage);
  }

  const stored = storage[key];
  if (stored?.languageId && stored.languageId !== doc.languageId) {
    restoringLanguage.set(key, stored.languageId);
    try {
      await vscode.languages.setTextDocumentLanguage(doc, stored.languageId);
    } catch {
      if (restoringLanguage.get(key) === stored.languageId) {
        restoringLanguage.delete(key);
      }
    }
  }
}

export async function processAlreadyOpenDocs(memento: MementoLike): Promise<void> {
  for (const doc of vscode.workspace.textDocuments) {
    await handleOpen(memento, doc);
  }
}
