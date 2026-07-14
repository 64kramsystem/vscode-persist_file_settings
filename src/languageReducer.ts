// Pure state machine for per-file language persistence.
//
// VS Code has no "language changed" event. A language change instead surfaces as a close+open
// pair on the same document *without* disposal (doc.isClosed === false); a real tab close disposes
// it (doc.isClosed === true). To persist a user's language change immediately — and to avoid
// re-persisting the language our own restore sets — we bridge the close event to the following open
// event via `pending`, and mark our own in-flight restores via `restoring`.
//
// Discriminator verified in VS Code source:
//   extHostDocumentData.ts — dispose() sets _isDisposed; get isClosed() returns it
//   extHostDocuments.ts — language change fires close+open without dispose

export interface LangState {
  // key -> languageId the document had at a language-change close, consumed by the next open
  readonly pending: Readonly<Record<string, string>>;
  // key -> languageId we asked VS Code to restore, so the resulting open is not re-persisted
  readonly restoring: Readonly<Record<string, string>>;
}

export const initialLangState: LangState = { pending: {}, restoring: {} };

export type OpenDecision =
  | { kind: 'none' }
  | { kind: 'persist'; languageId: string }
  | { kind: 'restore'; languageId: string };

export interface OpenInput {
  key: string;
  currentLanguageId: string;
  storedLanguageId?: string;
  storedExists: boolean;
}

export interface OpenResult {
  state: LangState;
  touch: boolean; // refresh lastOpenedAt for an already-known file
  decision: OpenDecision;
}

export interface CloseInput {
  key: string;
  isClosed: boolean;
  currentLanguageId: string;
}

export interface CloseResult {
  state: LangState;
  realClose: boolean;
}

function without(rec: Readonly<Record<string, string>>, key: string): Record<string, string> {
  if (!(key in rec)) return rec as Record<string, string>;
  const { [key]: _removed, ...rest } = rec;
  return rest;
}

export function reduceClose(state: LangState, input: CloseInput): CloseResult {
  if (input.isClosed) {
    return {
      state: { pending: without(state.pending, input.key), restoring: without(state.restoring, input.key) },
      realClose: true,
    };
  }
  return {
    state: { pending: { ...state.pending, [input.key]: input.currentLanguageId }, restoring: state.restoring },
    realClose: false,
  };
}

export function reduceOpen(state: LangState, input: OpenInput): OpenResult {
  const prev = state.pending[input.key];
  if (prev !== undefined) {
    const next: LangState = {
      pending: without(state.pending, input.key),
      restoring: without(state.restoring, input.key),
    };
    // Our own restore just completed: the document now has the language we asked for.
    if (state.restoring[input.key] === input.currentLanguageId) {
      return { state: next, touch: false, decision: { kind: 'none' } };
    }
    // Genuine user language change: the new language differs from the pre-change one.
    if (prev !== input.currentLanguageId) {
      return { state: next, touch: false, decision: { kind: 'persist', languageId: input.currentLanguageId } };
    }
    return { state: next, touch: false, decision: { kind: 'none' } };
  }

  if (input.storedLanguageId !== undefined && input.storedLanguageId !== input.currentLanguageId) {
    return {
      state: { pending: state.pending, restoring: { ...state.restoring, [input.key]: input.storedLanguageId } },
      touch: input.storedExists,
      decision: { kind: 'restore', languageId: input.storedLanguageId },
    };
  }
  return { state, touch: input.storedExists, decision: { kind: 'none' } };
}

// A restore that threw (e.g. the stored language is no longer installed) leaves no close+open pair
// to clear `restoring`, so clear it here — but only if a later event has not already replaced it.
export function reduceRestoreFailed(state: LangState, key: string, attemptedLanguageId: string): LangState {
  if (state.restoring[key] !== attemptedLanguageId) return state;
  return { pending: state.pending, restoring: without(state.restoring, key) };
}
