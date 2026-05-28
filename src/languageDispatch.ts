import type * as vscode from 'vscode';
import { docKey, isPersistable } from './util';

export const pendingLanguageChange = new Map<string, string>();
export const restoringLanguage = new Map<string, string>();

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

export function _resetForTests(): void {
  pendingLanguageChange.clear();
  restoringLanguage.clear();
}
