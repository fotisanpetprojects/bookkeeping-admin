'use client';

import { Dispatch, SetStateAction, useRef, useSyncExternalStore } from 'react';

const LOCAL_STORAGE_EVENT = 'local-storage-change';
const snapshotCache = new Map<string, { raw: string | null; parsed: unknown }>();

function readStoredValue<T>(key: string, fallback: T) {
  if (typeof window === 'undefined') {
    return fallback;
  }

  const raw = window.localStorage.getItem(key);
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
  snapshotCache.set(key, { raw, parsed: value });
  window.localStorage.setItem(key, raw);
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
