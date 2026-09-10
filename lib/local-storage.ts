'use client';

import { type Dispatch, type SetStateAction, useRef, useSyncExternalStore } from 'react';

import { vaultDelete, vaultGet, vaultSet } from './vault.ts';

const LOCAL_STORAGE_EVENT = 'local-storage-change';
const snapshotCache = new Map<string, { raw: string | null; parsed: unknown }>();

/**
 * Thrown when a write to localStorage could not be persisted, most commonly
 * because the origin ran out of quota. Callers should surface this to the user:
 * the in-memory value is deliberately left untouched so the UI keeps showing
 * what is actually on disk instead of a change that was never saved.
 */
export class StorageWriteError extends Error {
  readonly isQuotaError: boolean;

  constructor(message: string, isQuotaError: boolean) {
    super(message);
    this.name = 'StorageWriteError';
    this.isQuotaError = isQuotaError;
  }
}

function isQuotaExceeded(error: unknown) {
  if (!(error instanceof DOMException)) {
    return false;
  }

  return (
    error.name === 'QuotaExceededError' ||
    error.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    error.code === 22
  );
}

function readStoredValue<T>(key: string, fallback: T) {
  if (typeof window === 'undefined') {
    return fallback;
  }

  // While the vault is open its contents stand in for localStorage, so no page has
  // to know whether the records it is reading are encrypted at rest.
  const vaulted = vaultGet(key);
  const raw = vaulted === undefined ? window.localStorage.getItem(key) : vaulted;
  const cached = snapshotCache.get(key);

  if (cached && cached.raw === raw) {
    return cached.parsed as T;
  }

  if (raw === null) {
    snapshotCache.set(key, { raw, parsed: fallback });
    return fallback;
  }

  try {
    const parsed = JSON.parse(raw) as T;
    snapshotCache.set(key, { raw, parsed });
    return parsed;
  } catch {
    snapshotCache.set(key, { raw, parsed: fallback });
    return fallback;
  }
}

function subscribeToKey(key: string, onStoreChange: () => void) {
  if (typeof window === 'undefined') {
    return () => undefined;
  }

  const handleStorage = (event: StorageEvent) => {
    if (event.key === key || event.key === null) {
      onStoreChange();
    }
  };

  const handleLocalChange = (event: Event) => {
    const customEvent = event as CustomEvent<{ key?: string }>;
    if (customEvent.detail?.key === key) {
      onStoreChange();
    }
  };

  window.addEventListener('storage', handleStorage);
  window.addEventListener(LOCAL_STORAGE_EVENT, handleLocalChange);

  return () => {
    window.removeEventListener('storage', handleStorage);
    window.removeEventListener(LOCAL_STORAGE_EVENT, handleLocalChange);
  };
}

function writeStoredValue<T>(key: string, value: T) {
  if (typeof window === 'undefined') {
    return;
  }

  const raw = JSON.stringify(value);

  // An open vault takes the write instead; persisting it is its business, and it
  // re-encrypts on a debounce rather than on every keystroke.
  if (vaultSet(key, raw)) {
    snapshotCache.set(key, { raw, parsed: value });
    window.dispatchEvent(new CustomEvent(LOCAL_STORAGE_EVENT, { detail: { key } }));
    return;
  }

  // Write to disk *before* touching the snapshot cache. If setItem throws we
  // must not leave the cache holding a value that was never persisted, or the
  // UI would report a successful save that disappears on the next reload.
  try {
    window.localStorage.setItem(key, raw);
  } catch (error) {
    if (isQuotaExceeded(error)) {
      throw new StorageWriteError(
        'Not enough browser storage left to save this. Remove a large receipt file, or export a backup and clear old entries, then try again.',
        true
      );
    }

    throw new StorageWriteError(
      'Could not save to browser storage. If you are in a private window, or site data is blocked, this page cannot store your bookkeeping.',
      false
    );
  }

  snapshotCache.set(key, { raw, parsed: value });
  window.dispatchEvent(new CustomEvent(LOCAL_STORAGE_EVENT, { detail: { key } }));
}

export function useLocalStorageState<T>(
  key: string,
  fallback: T
): [T, Dispatch<SetStateAction<T>>] {
  const fallbackRef = useRef(fallback);

  const value = useSyncExternalStore(
    (onStoreChange) => subscribeToKey(key, onStoreChange),
    () => readStoredValue(key, fallbackRef.current),
    () => fallbackRef.current
  );

  const setValue: Dispatch<SetStateAction<T>> = (nextValue) => {
    const currentValue = readStoredValue(key, fallbackRef.current);
    const valueToStore =
      typeof nextValue === 'function'
        ? (nextValue as (previousValue: T) => T)(currentValue)
        : nextValue;

    writeStoredValue(key, valueToStore);
  };

  return [value, setValue];
}

/** Message for a failed save, suitable for showing in a page's error banner. */
export function describeStorageError(error: unknown) {
  if (error instanceof StorageWriteError) {
    return error.message;
  }

  return 'Could not save your change. Nothing was written, so your existing data is unchanged.';
}

/** Read a stored JSON value outside of React (used by backup/restore). */
export function readStoredJson<T>(key: string, fallback: T) {
  return readStoredValue<T>(key, fallback);
}

/**
 * Write a stored JSON value outside of React. Throws StorageWriteError if the
 * value could not be persisted; nothing is changed in that case.
 */
export function writeStoredJson<T>(key: string, value: T) {
  writeStoredValue(key, value);
}

/** Restore a key to a previously captured raw string (used to roll back a failed restore). */
export function restoreRawValue(key: string, raw: string | null) {
  if (typeof window === 'undefined') {
    return;
  }

  // A rollback has to land wherever the value came from. Writing plaintext to
  // localStorage while a vault is open would undo the encryption for that key.
  if (vaultGet(key) !== undefined) {
    if (raw === null) vaultDelete(key);
    else vaultSet(key, raw);
  } else if (raw === null) {
    window.localStorage.removeItem(key);
  } else {
    window.localStorage.setItem(key, raw);
  }

  snapshotCache.delete(key);
  window.dispatchEvent(new CustomEvent(LOCAL_STORAGE_EVENT, { detail: { key } }));
}

/** Capture the raw stored string for a key, for rollback purposes. */
export function captureRawValue(key: string) {
  if (typeof window === 'undefined') {
    return null;
  }

  const vaulted = vaultGet(key);
  return vaulted === undefined ? window.localStorage.getItem(key) : vaulted;
}
