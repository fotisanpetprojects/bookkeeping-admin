'use client';

import { useEffect } from 'react';
import {
  BACKUP_KEYS,
  applyBackup,
  parseBackup,
} from '@/lib/backup';
import { captureRawValue, readStoredJson, writeStoredJson } from '@/lib/local-storage';
import { vaultExists } from '@/lib/vault';

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
const LOGO_RESTORED_KEY = 'seed-logo-restored';

type ProfileLike = { id?: number; letterheadDataUrl?: string };

/**
 * The seed carries no letterhead, so replacing wiped the logo off the business
 * profile. The pre-seed snapshot still holds it: put it back once, without
 * touching anything else on the profile.
 */
function restoreLetterheadFromSnapshot() {
  if (window.localStorage.getItem(LOGO_RESTORED_KEY) === SEED_VERSION) {
    return;
  }

  const snapshot = readStoredJson<{ previous?: Record<string, string | null> } | null>(
    ROLLBACK_KEY,
    null
  );
  const rawPrevious = snapshot?.previous?.['business-profiles'];
  if (!rawPrevious) {
    return;
  }

  let oldProfiles: ProfileLike[];
  try {
    oldProfiles = JSON.parse(rawPrevious) as ProfileLike[];
  } catch {
    return;
  }

  const letterhead = oldProfiles.find((profile) => profile?.letterheadDataUrl)?.letterheadDataUrl;
  if (!letterhead) {
    return;
  }

  const current = readStoredJson<ProfileLike[]>('business-profiles', []);
  if (current.length === 0 || current.some((profile) => profile.letterheadDataUrl)) {
    return;
  }

  writeStoredJson(
    'business-profiles',
    current.map((profile, index) =>
      index === 0 ? { ...profile, letterheadDataUrl: letterhead } : profile
    )
  );
  window.localStorage.setItem(LOGO_RESTORED_KEY, SEED_VERSION);
}

export default function SeedLoader() {
  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        // Once a vault exists the seed has no business running: it would either
        // write plaintext beside the encrypted copy, or overwrite real books that
        // are merely locked rather than absent.
        if (vaultExists()) {
          return;
        }

        if (window.localStorage.getItem(APPLIED_KEY) === SEED_VERSION) {
          // The seed already ran; the logo it overwrote may still need putting back.
          restoreLetterheadFromSnapshot();
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

        const existingLetterhead = readStoredJson<ProfileLike[]>('business-profiles', []).find(
          (profile) => profile?.letterheadDataUrl
        )?.letterheadDataUrl;

        applyBackup(payload, 'replace');

        if (existingLetterhead) {
          const seeded = readStoredJson<ProfileLike[]>('business-profiles', []);
          writeStoredJson(
            'business-profiles',
            seeded.map((profile, index) =>
              index === 0 ? { ...profile, letterheadDataUrl: existingLetterhead } : profile
            )
          );
        }

        window.localStorage.setItem(APPLIED_KEY, SEED_VERSION);
        window.localStorage.setItem(LOGO_RESTORED_KEY, SEED_VERSION);
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
