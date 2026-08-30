'use client';

import { useEffect } from 'react';
import {
  BACKUP_KEYS,
  applyBackup,
  parseBackup,
} from '@/lib/backup';
import { captureRawValue, writeStoredJson } from '@/lib/local-storage';

/**
 * One-time local backfill.
 *
 * Loads /seed/backfill.json when present and applies it in replace mode, once
 * per seed version. This exists so a prepared set of books can be loaded on this
 * machine without anyone hand-entering it. The file is gitignored: it holds real
 * bookkeeping data and never belongs in the repository.
 *
 * Nothing is destroyed. Whatever is in storage first is copied to
 * `pre-seed-backup` so it can be recovered, and the applied marker stops the
 * seed from ever running a second time and re-overwriting later edits.
 */
const SEED_URL = '/seed/backfill.json';
const APPLIED_KEY = 'seed-applied';
const ROLLBACK_KEY = 'pre-seed-backup';
const SEED_VERSION = '2025-2026-backfill-v1';

export default function SeedLoader() {
  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        if (window.localStorage.getItem(APPLIED_KEY) === SEED_VERSION) {
          return;
        }

        const response = await fetch(SEED_URL, { cache: 'no-store' });
        if (!response.ok || cancelled) {
          return;
        }

        const payload = parseBackup(await response.text());
        if (cancelled) {
          return;
        }

        // Keep whatever is here now, so replacing can always be undone.
        const previous: Record<string, string | null> = {};
        for (const key of BACKUP_KEYS) {
          previous[key] = captureRawValue(key);
        }

        const hadData = Object.values(previous).some((value) => value !== null);
        if (hadData) {
          writeStoredJson(ROLLBACK_KEY, { savedAt: new Date().toISOString(), previous });
        }

        applyBackup(payload, 'replace');
        window.localStorage.setItem(APPLIED_KEY, SEED_VERSION);
        window.location.reload();
      } catch {
        // A missing or unreadable seed file is normal — this is a local-only aid.
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
