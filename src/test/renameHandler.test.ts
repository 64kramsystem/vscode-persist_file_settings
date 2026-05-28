import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { applyRename } from '../renameHandler';
import type { Storage } from '../storage';

test('applyRename migrates an exact file key', () => {
  const s: Storage = {
    'file:///repo/old.txt': { languageId: 'rust', lastOpenedAt: 1 },
    'file:///other.txt': { lastOpenedAt: 2 },
  };
  const out = applyRename(s, 'file:///repo/old.txt', 'file:///repo/new.txt');
  assert.deepEqual(out, {
    'file:///repo/new.txt': { languageId: 'rust', lastOpenedAt: 1 },
    'file:///other.txt': { lastOpenedAt: 2 },
  });
});

test('applyRename migrates every key under a renamed folder', () => {
  const s: Storage = {
    'file:///repo/old/a.ts': { languageId: 'ts', lastOpenedAt: 1 },
    'file:///repo/old/sub/b.ts': { lastOpenedAt: 2 },
    'file:///repo/keep.ts': { lastOpenedAt: 3 },
  };
  const out = applyRename(s, 'file:///repo/old', 'file:///repo/new');
  assert.deepEqual(out, {
    'file:///repo/new/a.ts': { languageId: 'ts', lastOpenedAt: 1 },
    'file:///repo/new/sub/b.ts': { lastOpenedAt: 2 },
    'file:///repo/keep.ts': { lastOpenedAt: 3 },
  });
});

test('applyRename does not match keys that only share a string prefix without a path separator', () => {
  const s: Storage = {
    'file:///repo/oldname.ts': { lastOpenedAt: 1 },
  };
  const out = applyRename(s, 'file:///repo/old', 'file:///repo/new');
  assert.deepEqual(out, s);
});

test('applyRename is a no-op when nothing matches', () => {
  const s: Storage = { 'file:///x.txt': { lastOpenedAt: 1 } };
  const out = applyRename(s, 'file:///old.txt', 'file:///new.txt');
  assert.equal(out, s);
});

test('applyRename overwrites the destination when it already exists (renamed source wins)', () => {
  const s: Storage = {
    'file:///old.txt': { languageId: 'rust', lastOpenedAt: 1 },
    'file:///new.txt': { languageId: 'go', lastOpenedAt: 2 },
  };
  const out = applyRename(s, 'file:///old.txt', 'file:///new.txt');
  assert.deepEqual(out, {
    'file:///new.txt': { languageId: 'rust', lastOpenedAt: 1 },
  });
});

test('applyRename folder rename overwrites colliding destination children', () => {
  const s: Storage = {
    'file:///repo/old/a.ts': { languageId: 'ts', lastOpenedAt: 1 },
    'file:///repo/new/a.ts': { languageId: 'js', lastOpenedAt: 2 },
  };
  const out = applyRename(s, 'file:///repo/old', 'file:///repo/new');
  assert.deepEqual(out, {
    'file:///repo/new/a.ts': { languageId: 'ts', lastOpenedAt: 1 },
  });
});

test('applyRename does not mutate input', () => {
  const s: Storage = { 'file:///old.txt': { lastOpenedAt: 1 } };
  applyRename(s, 'file:///old.txt', 'file:///new.txt');
  assert.deepEqual(s, { 'file:///old.txt': { lastOpenedAt: 1 } });
});
