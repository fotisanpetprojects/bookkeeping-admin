'use client';

import {
  captureRawValue,
  describeStorageError,
  readStoredJson,
  restoreRawValue,
  writeStoredJson,
} from '@/lib/local-storage';

export const BACKUP_FORMAT = 'bookkeeping-admin-backup';
export const BACKUP_VERSION = 1;

/** Every localStorage key that holds user bookkeeping data. */
export const BACKUP_KEYS = [
  'business-profile',
  'business-profiles',
  'client-profiles',
  'invoices',
  'expenses',
] as const;

export type BackupKey = (typeof BACKUP_KEYS)[number];

export type BackupPayload = {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  data: Partial<Record<BackupKey, unknown>>;
};

export type BackupCounts = {
  businessProfiles: number;
  clientProfiles: number;
  invoices: number;
  expenses: number;
};

function countArray(value: unknown) {
  return Array.isArray(value) ? value.length : 0;
}

export function describeBackup(data: Partial<Record<BackupKey, unknown>>): BackupCounts {
  return {
    businessProfiles: countArray(data['business-profiles']),
    clientProfiles: countArray(data['client-profiles']),
    invoices: countArray(data['invoices']),
    expenses: countArray(data['expenses']),
  };
}

export function buildBackup(): BackupPayload {
  const data: Partial<Record<BackupKey, unknown>> = {};

  for (const key of BACKUP_KEYS) {
    const value = readStoredJson<unknown>(key, null);
    if (value !== null) {
      data[key] = value;
    }
  }

  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    data,
  };
}

export function backupFileName(date = new Date()) {
  const stamp = date.toISOString().slice(0, 19).replace(/[:T]/g, '-');
  return `bookkeeping-backup-${stamp}.json`;
}

/** Hand any JSON-serialisable payload to the browser as a .json download. */
export function downloadJsonFile(fileName: string, payload: unknown) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** Serialise the current data and hand it to the browser as a .json download. */
export function downloadBackup() {
  const payload = buildBackup();
  downloadJsonFile(backupFileName(), payload);
  return payload;
}

export function parseBackup(text: string): BackupPayload {
  let parsed: unknown;

  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('That file is not valid JSON.');
  }

  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('That file does not look like a bookkeeping backup.');
  }

  const candidate = parsed as Partial<BackupPayload>;

  if (candidate.format !== BACKUP_FORMAT) {
    throw new Error('That file was not exported by Bookkeeping Admin.');
  }

  if (typeof candidate.data !== 'object' || candidate.data === null) {
    throw new Error('That backup file has no data section.');
  }

  const data = candidate.data as Partial<Record<BackupKey, unknown>>;

  for (const key of ['business-profiles', 'client-profiles', 'invoices', 'expenses'] as const) {
    if (key in data && !Array.isArray(data[key])) {
      throw new Error(`The "${key}" section of that backup is malformed.`);
    }
  }

  return {
    format: BACKUP_FORMAT,
    version: typeof candidate.version === 'number' ? candidate.version : 1,
    exportedAt: typeof candidate.exportedAt === 'string' ? candidate.exportedAt : '',
    data,
  };
}

type WithId = { id?: unknown };

/**
 * Union of current and incoming records by id. Anything already on this device
 * wins, so a restore can only ever add entries — never overwrite or drop one.
 */
function mergeById(current: unknown, incoming: unknown) {
  const currentList = Array.isArray(current) ? current : [];
  const incomingList = Array.isArray(incoming) ? incoming : [];
  const seen = new Set(
    currentList.map((item) => String((item as WithId)?.id ?? JSON.stringify(item)))
  );
  const additions = incomingList.filter((item) => {
    const id = String((item as WithId)?.id ?? JSON.stringify(item));
    if (seen.has(id)) {
      return false;
    }
    seen.add(id);
    return true;
  });

  return [...currentList, ...additions];
}

export type RestoreMode = 'merge' | 'replace';

export type RestoreResult = {
  added: BackupCounts;
  mode: RestoreMode;
};

/**
 * Apply a parsed backup. All keys are written inside a rollback guard: if any
 * single write fails (quota, blocked storage), every key is put back exactly as
 * it was, so a failed restore cannot leave the books half-updated.
 */
export function applyBackup(payload: BackupPayload, mode: RestoreMode): RestoreResult {
  const rollback = BACKUP_KEYS.map((key) => ({ key, raw: captureRawValue(key) }));
  const before = describeBackup(
    Object.fromEntries(
      BACKUP_KEYS.map((key) => [key, readStoredJson<unknown>(key, null)])
    ) as Partial<Record<BackupKey, unknown>>
  );

  try {
    for (const key of BACKUP_KEYS) {
      if (!(key in payload.data)) {
        continue;
      }

      const incoming = payload.data[key];

      if (mode === 'replace') {
        writeStoredJson(key, incoming);
        continue;
      }

      if (key === 'business-profile') {
        // Single legacy object: only fill it in if nothing is stored yet.
        const current = readStoredJson<unknown>(key, null);
        if (current === null) {
          writeStoredJson(key, incoming);
        }
        continue;
      }

      const current = readStoredJson<unknown>(key, []);
      writeStoredJson(key, mergeById(current, incoming));
    }
  } catch (error) {
    for (const entry of rollback) {
      restoreRawValue(entry.key, entry.raw);
    }

    throw new Error(
      `${describeStorageError(error)} Nothing was imported — your existing data is untouched.`
    );
  }

  const after = describeBackup(
    Object.fromEntries(
      BACKUP_KEYS.map((key) => [key, readStoredJson<unknown>(key, null)])
    ) as Partial<Record<BackupKey, unknown>>
  );

  return {
    mode,
    added: {
      businessProfiles: after.businessProfiles - before.businessProfiles,
      clientProfiles: after.clientProfiles - before.clientProfiles,
      invoices: after.invoices - before.invoices,
      expenses: after.expenses - before.expenses,
    },
  };
}
