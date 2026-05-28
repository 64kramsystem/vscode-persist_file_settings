import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { pruneOldEntries } from '../cleanup';
import type { Storage } from '../storage';

const DAY = 86_400_000;

test('drops entries older than the cutoff', () => {
  const now = 100 * DAY;
  const s: Storage = {
    'file:///fresh.txt': { lastOpenedAt: now - 5 * DAY },
    'file:///stale.txt': { lastOpenedAt: now - 30 * DAY },
  };
  const out = pruneOldEntries(s, now, 14);
  assert.deepEqual(out, {
    'file:///fresh.txt': { lastOpenedAt: now - 5 * DAY },
  });
});

test('keeps entries exactly at the cutoff boundary', () => {
  const now = 100 * DAY;
  const cutoff = now - 14 * DAY;
  const s: Storage = {
    'file:///edge.txt': { lastOpenedAt: cutoff },
  };
  const out = pruneOldEntries(s, now, 14);
  assert.deepEqual(out, s);
});

test('days = 0 returns input unchanged', () => {
  const s: Storage = {
    'file:///a.txt': { lastOpenedAt: 0 },
  };
  assert.deepEqual(pruneOldEntries(s, 1_000_000_000, 0), s);
});

test('empty storage returns empty', () => {
  assert.deepEqual(pruneOldEntries({}, 0, 14), {});
});

test('does not mutate input', () => {
  const s: Storage = { 'file:///old.txt': { lastOpenedAt: 0 } };
  pruneOldEntries(s, 100 * DAY, 1);
  assert.deepEqual(s, { 'file:///old.txt': { lastOpenedAt: 0 } });
});
