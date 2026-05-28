import type { Storage } from './storage';

const DAY_MS = 86_400_000;

export function pruneOldEntries(s: Storage, now: number, days: number): Storage {
  if (days <= 0) return s;
  const cutoff = now - days * DAY_MS;
  const out: Storage = {};
  let changed = false;
  for (const [key, entry] of Object.entries(s)) {
    if (entry.lastOpenedAt >= cutoff) {
      out[key] = entry;
    } else {
      changed = true;
    }
  }
  return changed ? out : s;
}
