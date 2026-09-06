/**
 * Vault cryptography.
 *
 * The design is an envelope. A random data key (the DEK) encrypts the books, and
 * that key is itself wrapped twice: once by a key derived from the passphrase, and
 * once by a key derived from a recovery code. Either unwraps the same DEK, so both
 * open the vault and neither can be computed from the other.
 *
 * Wrapping rather than encrypting directly buys two things. Changing the passphrase
 * re-wraps a small key instead of re-encrypting every record, and adding a second way
 * in costs one more wrapped copy rather than a second ciphertext of everything.
 *
 * What is never stored, anywhere, in any form: the passphrase, the recovery code, and
 * the DEK itself. A wrong passphrase produces a failed authentication tag rather than
 * a mismatch against some stored hash, so there is nothing to steal or brute-force
 * offline beyond the wrapped key.
 *
 * Everything here uses the platform's own WebCrypto. No dependency handles the keys.
 */

/** OWASP's 2023 floor for PBKDF2-SHA256. Recorded per vault so it can be raised later. */
export const PBKDF2_ITERATIONS = 600_000;

const SALT_BYTES = 16;
const IV_BYTES = 12;
const RECOVERY_BYTES = 32;

export type WrappedKey = {
  /** Base64 of the DEK encrypted under a key-encryption key. */
  wrapped: string;
  iv: string;
  salt: string;
  iterations: number;
};

export type VaultEnvelope = {
  version: 1;
  /** The DEK, wrapped by the passphrase-derived key. */
  passphrase: WrappedKey;
  /** The same DEK, wrapped by the recovery-code-derived key. */
  recovery: WrappedKey;
  /** The books themselves, encrypted under the DEK. */
  payload: { iv: string; ciphertext: string };
  updatedAt: string;
};

function subtle() {
  if (typeof globalThis.crypto?.subtle === 'undefined') {
    throw new Error(
      'This browser does not expose WebCrypto, which the vault needs. A secure context (https or localhost) is required.'
    );
  }
  return globalThis.crypto.subtle;
}

function randomBytes(length: number) {
  return globalThis.crypto.getRandomValues(new Uint8Array(length));
}

export function toBase64(bytes: ArrayBuffer | Uint8Array) {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = '';
  for (const byte of view) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function fromBase64(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Stretches a low-entropy passphrase into a key-encryption key. */
async function deriveKekFromPassphrase(passphrase: string, salt: Uint8Array, iterations: number) {
  const material = await subtle().importKey(
    'raw',
    new TextEncoder().encode(passphrase.normalize('NFKC')),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return subtle().deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['wrapKey', 'unwrapKey']
  );
}

/**
 * Base32 (RFC 4648), because a recovery code has to survive being written on paper
 * and typed back. Base64 cannot: its +, / and = carry meaning, and any formatting
 * that strips punctuation silently destroys key material.
 *
 * I and O are still visually close to 1 and 0, so input is normalised on the way back
 * rather than trusting the reader.
 */
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function toBase32(bytes: Uint8Array) {
  let bits = 0;
  let value = 0;
  let output = '';

  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
}

function fromBase32(code: string) {
  const cleaned = code
    .toUpperCase()
    .replace(/[^A-Z2-7018]/g, '')
    // Common transcription slips, resolved rather than rejected.
    .replace(/0/g, 'O')
    .replace(/1/g, 'I')
    .replace(/8/g, 'B');

  let bits = 0;
  let value = 0;
  const bytes: number[] = [];

  for (const char of cleaned) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index < 0) continue;
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return new Uint8Array(bytes);
}

/**
 * The recovery code is already 256 bits of random, so it is stretched only lightly —
 * there is no low-entropy secret here to protect against guessing.
 */
async function deriveKekFromRecovery(code: string, salt: Uint8Array) {
  const material = await subtle().importKey(
    'raw',
    fromBase32(code) as BufferSource,
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return subtle().deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: 1_000, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['wrapKey', 'unwrapKey']
  );
}

/** Groups of five so it can be read aloud and typed back without losing your place. */
export function formatRecoveryCode(code: string) {
  const compact = code.replace(/[^A-Za-z2-7]/g, '').toUpperCase();
  return (compact.match(/.{1,5}/g) ?? []).join('-');
}

export function generateRecoveryCode() {
  return toBase32(randomBytes(RECOVERY_BYTES));
}

async function wrapDek(dek: CryptoKey, kek: CryptoKey, salt: Uint8Array, iterations: number) {
  const iv = randomBytes(IV_BYTES);
  const wrapped = await subtle().wrapKey('raw', dek, kek, {
    name: 'AES-GCM',
    iv: iv as BufferSource,
  });

  return {
    wrapped: toBase64(wrapped),
    iv: toBase64(iv),
    salt: toBase64(salt),
    iterations,
  };
}

async function unwrapDek(entry: WrappedKey, kek: CryptoKey) {
  return subtle().unwrapKey(
    'raw',
    fromBase64(entry.wrapped) as BufferSource,
    kek,
    { name: 'AES-GCM', iv: fromBase64(entry.iv) as BufferSource },
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

export async function encryptWithDek(dek: CryptoKey, plaintext: string) {
  const iv = randomBytes(IV_BYTES);
  const ciphertext = await subtle().encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    dek,
    new TextEncoder().encode(plaintext)
  );

  return { iv: toBase64(iv), ciphertext: toBase64(ciphertext) };
}

export async function decryptWithDek(dek: CryptoKey, payload: { iv: string; ciphertext: string }) {
  const plaintext = await subtle().decrypt(
    { name: 'AES-GCM', iv: fromBase64(payload.iv) as BufferSource },
    dek,
    fromBase64(payload.ciphertext) as BufferSource
  );

  return new TextDecoder().decode(plaintext);
}

/** Raised when a passphrase or recovery code does not open the vault. */
export class WrongSecretError extends Error {
  constructor() {
    super('That passphrase or recovery code does not open this vault.');
    this.name = 'WrongSecretError';
  }
}

export async function createVault(passphrase: string, plaintext: string) {
  const dek = await subtle().generateKey({ name: 'AES-GCM', length: 256 }, true, [
    'encrypt',
    'decrypt',
  ]);

  const recoveryCode = generateRecoveryCode();

  const passphraseSalt = randomBytes(SALT_BYTES);
  const recoverySalt = randomBytes(SALT_BYTES);

  const [passphraseEntry, recoveryEntry, payload] = await Promise.all([
    deriveKekFromPassphrase(passphrase, passphraseSalt, PBKDF2_ITERATIONS).then((kek) =>
      wrapDek(dek, kek, passphraseSalt, PBKDF2_ITERATIONS)
    ),
    deriveKekFromRecovery(recoveryCode, recoverySalt).then((kek) =>
      wrapDek(dek, kek, recoverySalt, 1_000)
    ),
    encryptWithDek(dek, plaintext),
  ]);

  const envelope: VaultEnvelope = {
    version: 1,
    passphrase: passphraseEntry,
    recovery: recoveryEntry,
    payload,
    updatedAt: new Date().toISOString(),
  };

  return { envelope, dek, recoveryCode: formatRecoveryCode(recoveryCode) };
}

export async function unlockWithPassphrase(envelope: VaultEnvelope, passphrase: string) {
  const entry = envelope.passphrase;
  const kek = await deriveKekFromPassphrase(passphrase, fromBase64(entry.salt), entry.iterations);

  try {
    return await unwrapDek(entry, kek);
  } catch {
    // AES-GCM authenticates, so a wrong key fails here rather than yielding garbage.
    throw new WrongSecretError();
  }
}

export async function unlockWithRecoveryCode(envelope: VaultEnvelope, code: string) {
  const entry = envelope.recovery;
  const kek = await deriveKekFromRecovery(code, fromBase64(entry.salt));

  try {
    return await unwrapDek(entry, kek);
  } catch {
    throw new WrongSecretError();
  }
}

/** Re-wraps the existing data key under a new passphrase; the books are untouched. */
export async function changePassphrase(
  envelope: VaultEnvelope,
  dek: CryptoKey,
  nextPassphrase: string
): Promise<VaultEnvelope> {
  const salt = randomBytes(SALT_BYTES);
  const kek = await deriveKekFromPassphrase(nextPassphrase, salt, PBKDF2_ITERATIONS);

  return {
    ...envelope,
    passphrase: await wrapDek(dek, kek, salt, PBKDF2_ITERATIONS),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Issues a new recovery code and retires the old one. Used when the original is
 * lost, or when it may have been seen by someone it should not have been.
 */
export async function resetRecoveryCode(envelope: VaultEnvelope, dek: CryptoKey) {
  const recoveryCode = generateRecoveryCode();
  const salt = randomBytes(SALT_BYTES);
  const kek = await deriveKekFromRecovery(recoveryCode, salt);

  return {
    envelope: {
      ...envelope,
      recovery: await wrapDek(dek, kek, salt, 1_000),
      updatedAt: new Date().toISOString(),
    } satisfies VaultEnvelope,
    recoveryCode: formatRecoveryCode(recoveryCode),
  };
}

export async function sealVault(
  envelope: VaultEnvelope,
  dek: CryptoKey,
  plaintext: string
): Promise<VaultEnvelope> {
  return {
    ...envelope,
    payload: await encryptWithDek(dek, plaintext),
    updatedAt: new Date().toISOString(),
  };
}
