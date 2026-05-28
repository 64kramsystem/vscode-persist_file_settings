import * as vscode from 'vscode';
import {
  loadStorage,
  patchEntry,
  saveStorage,
  type MementoLike,
} from './storage';
import { docKey, isPersistable } from './util';

const pendingLanguageChange = new Map<string, string>();
const restoringLanguage = new Map<string, string>();

export type CloseResult =
  | { kind: 'ignored' }
  | { kind: 'realClose'; key: string }
  | { kind: 'languageChangeClose'; key: string };

// Discriminator (verified in VS Code source):
//   extHostDocumentData.ts:57 — dispose() sets _isDisposed = true
//   extHostDocumentData.ts:74 — get isClosed() returns _isDisposed
//   extHostDocumentsAndEditors.ts:146 — dispose runs before onDidRemoveDocuments fires
//   extHostDocuments.ts:117-127 — language change fires close+open without dispose
// So doc.isClosed === true means real disposal; false means language-change close.
export function handleClose(doc: vscode.TextDocument): CloseResult {
  if (!isPersistable(doc)) return { kind: 'ignored' };
  const key = docKey(doc);
  if (doc.isClosed) {
    pendingLanguageChange.delete(key);
    restoringLanguage.delete(key);
    return { kind: 'realClose', key };
  }
  pendingLanguageChange.set(key, doc.languageId);
  return { kind: 'languageChangeClose', key };
}

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
