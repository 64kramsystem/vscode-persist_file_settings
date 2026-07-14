import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  initialLangState,
  reduceClose,
  reduceOpen,
  reduceRestoreFailed,
  type LangState,
} from '../languageReducer';

const KEY = 'file:///a.txt';

// --- reduceClose ---

test('reduceClose: real close reports realClose and clears both maps for the key', () => {
  const state: LangState = { pending: { [KEY]: 'python', 'file:///b': 'go' }, restoring: { [KEY]: 'rust' } };
  const { state: next, realClose } = reduceClose(state, { key: KEY, isClosed: true, currentLanguageId: 'python' });
  assert.equal(realClose, true);
  assert.deepEqual(next, { pending: { 'file:///b': 'go' }, restoring: {} });
});

test('reduceClose: language-change close records the current languageId and is not a real close', () => {
  const { state: next, realClose } = reduceClose(initialLangState, {
    key: KEY,
    isClosed: false,
    currentLanguageId: 'go',
  });
  assert.equal(realClose, false);
  assert.deepEqual(next, { pending: { [KEY]: 'go' }, restoring: {} });
});

test('reduceClose: language-change close overwrites a prior pending entry', () => {
  const state: LangState = { pending: { [KEY]: 'python' }, restoring: {} };
  const { state: next } = reduceClose(state, { key: KEY, isClosed: false, currentLanguageId: 'go' });
  assert.equal(next.pending[KEY], 'go');
});

// --- reduceOpen: fresh open (no pending) ---

test('reduceOpen: unknown file does nothing and preserves referential identity', () => {
  const { state: next, touch, decision } = reduceOpen(initialLangState, {
    key: KEY,
    currentLanguageId: 'plaintext',
    storedExists: false,
  });
  assert.equal(next, initialLangState);
  assert.equal(touch, false);
  assert.deepEqual(decision, { kind: 'none' });
});

test('reduceOpen: known file with no stored language touches lastOpenedAt only', () => {
  const { touch, decision } = reduceOpen(initialLangState, {
    key: KEY,
    currentLanguageId: 'plaintext',
    storedExists: true,
  });
  assert.equal(touch, true);
  assert.deepEqual(decision, { kind: 'none' });
});

test('reduceOpen: stored language equal to current touches but does not restore', () => {
  const { touch, decision } = reduceOpen(initialLangState, {
    key: KEY,
    currentLanguageId: 'javascript',
    storedLanguageId: 'javascript',
    storedExists: true,
  });
  assert.equal(touch, true);
  assert.deepEqual(decision, { kind: 'none' });
});

test('reduceOpen: stored language differing from current restores and marks restoring', () => {
  const { state: next, touch, decision } = reduceOpen(initialLangState, {
    key: KEY,
    currentLanguageId: 'plaintext',
    storedLanguageId: 'javascript',
    storedExists: true,
  });
  assert.equal(touch, true);
  assert.deepEqual(decision, { kind: 'restore', languageId: 'javascript' });
  assert.equal(next.restoring[KEY], 'javascript');
});

// --- reduceOpen: language-change open (pending present) ---

test('reduceOpen: user language change persists the new language and clears pending', () => {
  const state: LangState = { pending: { [KEY]: 'plaintext' }, restoring: {} };
  const { state: next, touch, decision } = reduceOpen(state, {
    key: KEY,
    currentLanguageId: 'go',
    storedExists: true,
  });
  assert.equal(touch, false);
  assert.deepEqual(decision, { kind: 'persist', languageId: 'go' });
  assert.deepEqual(next, initialLangState);
});

test('reduceOpen: our own restore completing does not persist', () => {
  const state: LangState = { pending: { [KEY]: 'plaintext' }, restoring: { [KEY]: 'javascript' } };
  const { state: next, decision } = reduceOpen(state, {
    key: KEY,
    currentLanguageId: 'javascript',
    storedExists: true,
  });
  assert.deepEqual(decision, { kind: 'none' });
  assert.deepEqual(next, initialLangState);
});

test('reduceOpen: language unchanged across the close+open pair does not persist', () => {
  const state: LangState = { pending: { [KEY]: 'go' }, restoring: {} };
  const { decision } = reduceOpen(state, { key: KEY, currentLanguageId: 'go', storedExists: true });
  assert.deepEqual(decision, { kind: 'none' });
});

// --- reduceRestoreFailed ---

test('reduceRestoreFailed: clears restoring when it still holds the attempted language', () => {
  const state: LangState = { pending: {}, restoring: { [KEY]: 'rust' } };
  const next = reduceRestoreFailed(state, KEY, 'rust');
  assert.deepEqual(next, initialLangState);
});

test('reduceRestoreFailed: leaves state untouched when a later event replaced the entry', () => {
  const state: LangState = { pending: {}, restoring: { [KEY]: 'python' } };
  const next = reduceRestoreFailed(state, KEY, 'rust');
  assert.equal(next, state);
});

// --- sequences (the crux: our restore vs a user change) ---

test('sequence: extension restore does not re-persist the language', () => {
  // open -> we ask to restore javascript
  let s = reduceOpen(initialLangState, {
    key: KEY,
    currentLanguageId: 'plaintext',
    storedLanguageId: 'javascript',
    storedExists: true,
  }).state;
  // setTextDocumentLanguage fires a language-change close carrying the old language
  s = reduceClose(s, { key: KEY, isClosed: false, currentLanguageId: 'plaintext' }).state;
  // followed by an open at the new language
  const { state: end, decision } = reduceOpen(s, { key: KEY, currentLanguageId: 'javascript', storedExists: true });
  assert.deepEqual(decision, { kind: 'none' });
  assert.deepEqual(end, initialLangState);
});

test('sequence: a genuine user language change is persisted', () => {
  // user changes plaintext -> go via the status bar: close (old lang) then open (new lang)
  let s = reduceClose(initialLangState, { key: KEY, isClosed: false, currentLanguageId: 'plaintext' }).state;
  const { state: end, decision } = reduceOpen(s, { key: KEY, currentLanguageId: 'go', storedExists: false });
  assert.deepEqual(decision, { kind: 'persist', languageId: 'go' });
  assert.deepEqual(end, initialLangState);
});

// --- immutability ---

test('reducers do not mutate their input state', () => {
  const state: LangState = { pending: { [KEY]: 'plaintext' }, restoring: { [KEY]: 'javascript' } };
  reduceClose(state, { key: KEY, isClosed: true, currentLanguageId: 'plaintext' });
  reduceOpen(state, { key: KEY, currentLanguageId: 'javascript', storedExists: true });
  assert.deepEqual(state, { pending: { [KEY]: 'plaintext' }, restoring: { [KEY]: 'javascript' } });
});
