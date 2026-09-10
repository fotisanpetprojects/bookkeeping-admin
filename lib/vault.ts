'use client';

/**
 * The vault: where records live once a passphrase is set.
 *
 * The problem this solves is a mismatch. Every page reads and writes storage
 * synchronously, while WebCrypto is asynchronous — so encrypting on each read
 * would mean rewriting every component to await its own data.
 *
 * Instead the whole set is decrypted once on unlock and held in memory, reads and
 * writes hit that memory synchronously exactly as before, and a debounced task
 * re-encrypts and persists in the background. Pages did not change at all.
 *
 * What reaches disk is one opaque blob. While locked — and before any passphrase
 * exists — nothing here is in play and storage behaves as it always did, so the
 * app is still usable without ever setting one up.
 */

import {
  type VaultEnvelope,
  changePassphrase,
  createVault,
  decryptWithDek,
  resetRecoveryCode,
  sealVault,
  unlockWithPassphrase,
  unlockWithRecoveryCode,
} from './crypto.ts';

export const VAULT_KEY = 'vault.v1';

/** Minutes of inactivity before locking. 0 means never. */
export const AUTO_LOCK_KEY = 'vault-auto-lock-minutes';

/** The keys whose contents move into the vault. */
export const VAULTED_KEYS = [
  'business-profile',
  'business-profiles',
  'client-profiles',
  'invoices',
  'expenses',
  'bank-transactions',
] as const;

type Listener = () => void;

const listeners = new Set<Listener>();

/** Decrypted contents, held only while unlocked. Null means locked or absent. */
let memory: Map<string, string> | null = null;
let dek: CryptoKey | null = null;
let envelope: VaultEnvelope | null = null;
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function notify() {
  for (const listener of listeners) listener();
}

export function subscribeToVault(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function readEnvelope(): VaultEnvelope | null {
  if (typeof window === 'undefined') return null;

  const raw = window.localStorage.getItem(VAULT_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as VaultEnvelope;
  } catch {
    return null;
  }
}

export function vaultExists() {
  return readEnvelope() !== null;
}

export function isUnlocked() {
  return memory !== null && dek !== null;
}

/** Reads a vaulted key. Returns undefined when the vault is not in play. */
export function vaultGet(key: string): string | null | undefined {
  if (!memory) return undefined;
  return memory.get(key) ?? null;
}

export function vaultSet(key: string, raw: string) {
  if (!memory) return false;
  memory.set(key, raw);
  scheduleFlush();
  return true;
}

export function vaultDelete(key: string) {
  if (!memory) return false;
  memory.delete(key);
  scheduleFlush();
  return true;
}

/**
 * Re-encrypts after a short pause. Typing in a form can touch storage many times a
 * second, and each write would otherwise mean a fresh AES pass over every record.
 */
function scheduleFlush() {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => {
    void flushNow();
  }, 400);
}

/**
 * The last write that failed, or null.
 *
 * Encrypting happens on a timer, away from whatever the user was doing, so a
 * failure here has no call stack to surface through. Left unhandled it becomes a
 * rejected promise nobody sees: the app carries on showing the change, the change
 * is not on disk, and the next reload quietly loses it. Recording it is what lets
 * the interface say so.
 */
let lastWriteError: string | null = null;

export function getWriteError() {
  return lastWriteError;
}

export async function flushNow() {
  if (!memory || !dek || !envelope) return;

  try {
    const plaintext = JSON.stringify(Object.fromEntries(memory));
    const next = await sealVault(envelope, dek, plaintext);

    // Write before adopting: if the write fails, the envelope in memory must still
    // match what is on disk, or the next flush encrypts against the wrong one.
    window.localStorage.setItem(VAULT_KEY, JSON.stringify(next));
    envelope = next;

    if (lastWriteError) {
      lastWriteError = null;
      notify();
    }
  } catch (error) {
    const quota =
      error instanceof DOMException &&
      (error.name === 'QuotaExceededError' ||
        error.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
        error.code === 22);

    lastWriteError = quota
      ? 'Your last change could not be saved: this browser is out of storage. Export a backup, then remove a large receipt or some old transactions.'
      : 'Your last change could not be saved to this browser. Export a backup before closing this tab.';

    notify();
  }
}

function hydrate(plaintext: string) {
  const parsed = JSON.parse(plaintext) as Record<string, string>;
  memory = new Map(Object.entries(parsed));
}

/**
 * Turns the plaintext already in this browser into a vault, then removes it. The
 * order matters: the envelope is written and verified before anything is deleted,
 * so a failure mid-way leaves the original records untouched.
 */
export async function setUpVault(passphrase: string) {
  const existing: Record<string, string> = {};
  for (const key of VAULTED_KEYS) {
    const raw = window.localStorage.getItem(key);
    if (raw !== null) existing[key] = raw;
  }

  const { envelope: created, dek: key, recoveryCode } = await createVault(
    passphrase,
    JSON.stringify(existing)
  );

  window.localStorage.setItem(VAULT_KEY, JSON.stringify(created));

  // Prove it opens before dropping the only readable copy.
  const check = await unlockWithPassphrase(created, passphrase);
  const roundTripped = await decryptWithDek(check, created.payload);
  if (roundTripped !== JSON.stringify(existing)) {
    window.localStorage.removeItem(VAULT_KEY);
    throw new Error('The vault did not verify after being created, so nothing was changed.');
  }

  for (const vaulted of VAULTED_KEYS) {
    window.localStorage.removeItem(vaulted);
  }

  envelope = created;
  dek = key;
  memory = new Map(Object.entries(existing));
  notify();

  return recoveryCode;
}

async function open(loaded: VaultEnvelope, key: CryptoKey) {
  const plaintext = await decryptWithDek(key, loaded.payload);
  hydrate(plaintext);
  dek = key;
  envelope = loaded;
  notify();
}

export async function unlock(passphrase: string) {
  const loaded = readEnvelope();
  if (!loaded) throw new Error('There is no vault in this browser to unlock.');

  await open(loaded, await unlockWithPassphrase(loaded, passphrase));
}

export async function unlockWithRecovery(code: string) {
  const loaded = readEnvelope();
  if (!loaded) throw new Error('There is no vault in this browser to unlock.');

  await open(loaded, await unlockWithRecoveryCode(loaded, code));
}

/** Drops the key and the decrypted copy. Anything pending is written out first. */
export async function lock() {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }

  await flushNow();

  memory = null;
  dek = null;
  envelope = null;
  notify();
}

/**
 * Swaps the passphrase. The current one is required even though the vault is
 * already open — otherwise anyone passing an unlocked laptop could lock the owner
 * out of their own books.
 */
export async function rotatePassphrase(current: string, next: string) {
  if (!envelope || !dek) throw new Error('Unlock the vault before changing its passphrase.');

  // Throws WrongSecretError if the current passphrase is not right.
  await unlockWithPassphrase(envelope, current);

  const rotated = await changePassphrase(envelope, dek, next);
  envelope = rotated;
  window.localStorage.setItem(VAULT_KEY, JSON.stringify(rotated));
  notify();
}

/** Issues a fresh recovery code and retires the previous one. */
export async function reissueRecoveryCode() {
  if (!envelope || !dek) throw new Error('Unlock the vault before issuing a new recovery code.');

  const { envelope: next, recoveryCode } = await resetRecoveryCode(envelope, dek);
  envelope = next;
  window.localStorage.setItem(VAULT_KEY, JSON.stringify(next));
  notify();

  return recoveryCode;
}

/**
 * Removes the encryption, writing the records back as ordinary storage. The plain
 * copies are written first and only then is the envelope dropped, so an
 * interruption leaves a readable vault rather than nothing at all.
 */
export async function removeVault() {
  if (!memory) throw new Error('Unlock the vault before turning encryption off.');

  for (const [key, raw] of memory) {
    window.localStorage.setItem(key, raw);
  }

  window.localStorage.removeItem(VAULT_KEY);

  memory = null;
  dek = null;
  envelope = null;
  notify();
}
