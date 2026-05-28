import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  patchEntry,
  removeEntry,
  type Storage,
} from '../storage';

test('patchEntry creates entry with lastOpenedAt when key absent', () => {
  const out = patchEntry({}, 'file:///a.txt', { languageId: 'python' }, 100);
  assert.deepEqual(out, {
    'file:///a.txt': { languageId: 'python', lastOpenedAt: 100 },
  });
});

test('patchEntry merges into existing entry and refreshes lastOpenedAt', () => {
  const start: Storage = {
    'file:///a.txt': { languageId: 'python', wordWrap: 'off', lastOpenedAt: 1 },
  };
  const out = patchEntry(start, 'file:///a.txt', { wordWrap: 'on' }, 200);
  assert.deepEqual(out, {
    'file:///a.txt': { languageId: 'python', wordWrap: 'on', lastOpenedAt: 200 },
  });
});

test('patchEntry does not mutate input', () => {
  const start: Storage = { 'file:///a.txt': { lastOpenedAt: 1 } };
  patchEntry(start, 'file:///a.txt', { languageId: 'go' }, 2);
  assert.deepEqual(start, { 'file:///a.txt': { lastOpenedAt: 1 } });
});

test('removeEntry drops the key', () => {
  const start: Storage = {
    'file:///a.txt': { lastOpenedAt: 1 },
    'file:///b.txt': { lastOpenedAt: 2 },
  };
  const out = removeEntry(start, 'file:///a.txt');
  assert.deepEqual(out, { 'file:///b.txt': { lastOpenedAt: 2 } });
});

test('removeEntry is a no-op for missing key', () => {
  const start: Storage = { 'file:///a.txt': { lastOpenedAt: 1 } };
  const out = removeEntry(start, 'file:///missing.txt');
  assert.deepEqual(out, start);
});
