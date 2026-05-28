import { test, beforeEach } from 'node:test';
import { strict as assert } from 'node:assert';
import type * as vscode from 'vscode';
import {
  handleClose,
  pendingLanguageChange,
  restoringLanguage,
  _resetForTests,
} from '../languageDispatch';

interface FakeDoc {
  uri: { scheme: string; toString(): string };
  isUntitled: boolean;
  isClosed: boolean;
  languageId: string;
}

function makeDoc(opts: Partial<FakeDoc> & { uriString?: string }): vscode.TextDocument {
  const uriString = opts.uriString ?? 'file:///a.txt';
  return {
    uri: {
      scheme: opts.uri?.scheme ?? 'file',
      toString: () => uriString,
    },
    isUntitled: opts.isUntitled ?? false,
    isClosed: opts.isClosed ?? false,
    languageId: opts.languageId ?? 'plaintext',
  } as unknown as vscode.TextDocument;
}

beforeEach(() => _resetForTests());

test('handleClose ignores docs with a non-file scheme', () => {
  const doc = makeDoc({ uri: { scheme: 'untitled', toString: () => 'untitled:foo' } });
  const result = handleClose(doc);
  assert.deepEqual(result, { kind: 'ignored' });
  assert.equal(pendingLanguageChange.size, 0);
  assert.equal(restoringLanguage.size, 0);
});

test('handleClose ignores untitled docs even when scheme is file', () => {
  const doc = makeDoc({ isUntitled: true });
  const result = handleClose(doc);
  assert.deepEqual(result, { kind: 'ignored' });
  assert.equal(pendingLanguageChange.size, 0);
});

test('handleClose returns realClose and clears both maps when doc.isClosed is true', () => {
  pendingLanguageChange.set('file:///a.txt', 'python');
  restoringLanguage.set('file:///a.txt', 'rust');

  const result = handleClose(makeDoc({ isClosed: true }));

  assert.deepEqual(result, { kind: 'realClose', key: 'file:///a.txt' });
  assert.equal(pendingLanguageChange.has('file:///a.txt'), false);
  assert.equal(restoringLanguage.has('file:///a.txt'), false);
});

test('handleClose returns languageChangeClose and records current languageId when doc.isClosed is false', () => {
  const result = handleClose(makeDoc({ isClosed: false, languageId: 'go' }));

  assert.deepEqual(result, { kind: 'languageChangeClose', key: 'file:///a.txt' });
  assert.equal(pendingLanguageChange.get('file:///a.txt'), 'go');
  assert.equal(restoringLanguage.size, 0);
});

test('handleClose realClose only clears the closed doc, not other entries', () => {
  pendingLanguageChange.set('file:///a.txt', 'python');
  pendingLanguageChange.set('file:///b.txt', 'rust');
  restoringLanguage.set('file:///b.txt', 'rust');

  handleClose(makeDoc({ isClosed: true, uriString: 'file:///a.txt' }));

  assert.equal(pendingLanguageChange.has('file:///a.txt'), false);
  assert.equal(pendingLanguageChange.get('file:///b.txt'), 'rust');
  assert.equal(restoringLanguage.get('file:///b.txt'), 'rust');
});

test('handleClose languageChangeClose overwrites any prior pending entry for the same key', () => {
  pendingLanguageChange.set('file:///a.txt', 'python');

  handleClose(makeDoc({ isClosed: false, languageId: 'go' }));

  assert.equal(pendingLanguageChange.get('file:///a.txt'), 'go');
});
