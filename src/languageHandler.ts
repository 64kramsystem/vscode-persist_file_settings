import * as vscode from 'vscode';
import { loadStorage, patchEntry, saveStorage, type MementoLike } from './storage';
import { docKey, isPersistable } from './util';
import {
  initialLangState,
  reduceClose,
  reduceOpen,
  reduceRestoreFailed,
  type LangState,
} from './languageReducer';

// Imperative shell around the pure reducer: holds the state, loads/saves storage, and calls the
// VS Code APIs the reducer's decisions describe.
let langState: LangState = initialLangState;

export interface CloseOutcome {
  realClose: boolean;
  key: string;
}

export function handleClose(doc: vscode.TextDocument): CloseOutcome | null {
  if (!isPersistable(doc)) return null;
  const key = docKey(doc);
  const { state, realClose } = reduceClose(langState, {
    key,
    isClosed: doc.isClosed,
    currentLanguageId: doc.languageId,
  });
  langState = state;
  return { realClose, key };
}

export async function handleOpen(memento: MementoLike, doc: vscode.TextDocument): Promise<void> {
  if (!isPersistable(doc)) return;
  const key = docKey(doc);
  const storage = loadStorage(memento);
  const stored = storage[key];
  const { state, touch, decision } = reduceOpen(langState, {
    key,
    currentLanguageId: doc.languageId,
    storedLanguageId: stored?.languageId,
    storedExists: stored !== undefined,
  });
  langState = state;

  if (touch) {
    await saveStorage(memento, patchEntry(storage, key, {}, Date.now()));
  }

  if (decision.kind === 'persist') {
    await saveStorage(
      memento,
      patchEntry(loadStorage(memento), key, { languageId: decision.languageId }, Date.now()),
    );
  } else if (decision.kind === 'restore') {
    try {
      await vscode.languages.setTextDocumentLanguage(doc, decision.languageId);
    } catch {
      langState = reduceRestoreFailed(langState, key, decision.languageId);
    }
  }
}

export async function processAlreadyOpenDocs(memento: MementoLike): Promise<void> {
  for (const doc of vscode.workspace.textDocuments) {
    await handleOpen(memento, doc);
  }
}
