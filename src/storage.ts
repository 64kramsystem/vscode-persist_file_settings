import type * as vscode from 'vscode';

export const STORAGE_KEY = 'persistFileSettings.perFile.v1';

export type WrapState = 'on' | 'off';

export interface FileEntry {
  languageId?: string;
  wordWrap?: WrapState;
  lastOpenedAt: number;
}

export type Storage = Record<string, FileEntry>;

export interface MementoLike {
  get<T>(key: string, defaultValue: T): T;
  update(key: string, value: unknown): Thenable<void>;
}

export function loadStorage(m: MementoLike): Storage {
  return m.get<Storage>(STORAGE_KEY, {});
}

export function saveStorage(m: MementoLike, s: Storage): Thenable<void> {
  return m.update(STORAGE_KEY, s);
}

export function patchEntry(
  s: Storage,
  key: string,
  patch: Partial<FileEntry>,
  now: number,
): Storage {
  const existing = s[key] ?? { lastOpenedAt: now };
  return { ...s, [key]: { ...existing, ...patch, lastOpenedAt: now } };
}

export function removeEntry(s: Storage, key: string): Storage {
  if (!(key in s)) return s;
  const { [key]: _removed, ...rest } = s;
  return rest;
}

export function migrateKey(s: Storage, oldKey: string, newKey: string): Storage {
  const entry = s[oldKey];
  if (!entry) return s;
  const { [oldKey]: _removed, ...rest } = s;
  return { ...rest, [newKey]: entry };
}
