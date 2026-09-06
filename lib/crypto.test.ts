/**
 * Tests for the vault crypto. Run with `npm test`.
 *
 * These matter more than most: a bug here does not throw, it silently produces a
 * vault nobody can open, or one anybody can. Every property worth relying on is
 * asserted rather than assumed.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  changePassphrase,
  createVault,
  decryptWithDek,
  encryptWithDek,
  formatRecoveryCode,
  fromBase64,
  generateRecoveryCode,
  resetRecoveryCode,
  toBase64,
  unlockWithPassphrase,
  unlockWithRecoveryCode,
} from './crypto.ts';

const PASSPHRASE = 'correct horse battery staple';
const BOOKS = JSON.stringify({
  invoices: [{ id: 1, client: 'CANARY-MARKER-9137', total: 1234.56 }],
});

test('a vault round-trips with the passphrase that made it', async () => {
  const { envelope, recoveryCode } = await createVault(PASSPHRASE, BOOKS);
  assert.ok(recoveryCode.length > 20);

  const dek = await unlockWithPassphrase(envelope, PASSPHRASE);
  assert.equal(await decryptWithDek(dek, envelope.payload), BOOKS);
});

test('the recovery code opens the same vault', async () => {
  const { envelope, recoveryCode } = await createVault(PASSPHRASE, BOOKS);

  const dek = await unlockWithRecoveryCode(envelope, recoveryCode);
  assert.equal(await decryptWithDek(dek, envelope.payload), BOOKS);
});

test('a recovery code survives being written down and typed back', async () => {
  const { envelope, recoveryCode } = await createVault(PASSPHRASE, BOOKS);

  // Lower case, spaces instead of hyphens, and the usual O/0 and I/1 slips.
  const asTypedByHand = recoveryCode
    .toLowerCase()
    .replace(/-/g, ' ')
    .replace(/O/gi, '0')
    .replace(/I/gi, '1');

  const dek = await unlockWithRecoveryCode(envelope, asTypedByHand);
  assert.equal(await decryptWithDek(dek, envelope.payload), BOOKS);
});

test('a wrong passphrase is rejected rather than returning wrong data', async () => {
  const { envelope } = await createVault(PASSPHRASE, BOOKS);

  await assert.rejects(
    () => unlockWithPassphrase(envelope, 'correct horse battery stapl'),
    /does not open/
  );
});

test('a wrong recovery code is rejected', async () => {
  const { envelope } = await createVault(PASSPHRASE, BOOKS);

  await assert.rejects(
    () => unlockWithRecoveryCode(envelope, formatRecoveryCode(generateRecoveryCode())),
    /does not open/
  );
});

test('changing the passphrase retires the old one and keeps the data', async () => {
  const { envelope, dek, recoveryCode } = await createVault(PASSPHRASE, BOOKS);
  const rotated = await changePassphrase(envelope, dek, 'a completely different phrase');

  await assert.rejects(() => unlockWithPassphrase(rotated, PASSPHRASE), /does not open/);

  const withNew = await unlockWithPassphrase(rotated, 'a completely different phrase');
  assert.equal(await decryptWithDek(withNew, rotated.payload), BOOKS);

  // The data key never changed, so the recovery code still opens it.
  const withRecovery = await unlockWithRecoveryCode(rotated, recoveryCode);
  assert.equal(await decryptWithDek(withRecovery, rotated.payload), BOOKS);
});

test('what gets stored contains no plaintext, passphrase or recovery code', async () => {
  const { envelope, recoveryCode } = await createVault(PASSPHRASE, BOOKS);
  const stored = JSON.stringify(envelope);

  assert.ok(!stored.includes('CANARY-MARKER-9137'), 'plaintext leaked into the envelope');
  assert.ok(!stored.includes('battery staple'), 'passphrase leaked into the envelope');
  assert.ok(!stored.includes(recoveryCode.replace(/-/g, '')), 'recovery code leaked into the envelope');
});

test('the same plaintext encrypts differently every time', async () => {
  const { dek } = await createVault(PASSPHRASE, BOOKS);

  const first = await encryptWithDek(dek, 'same input');
  const second = await encryptWithDek(dek, 'same input');

  assert.notEqual(first.iv, second.iv);
  assert.notEqual(first.ciphertext, second.ciphertext);
});

test('tampered ciphertext is refused, not decrypted into rubbish', async () => {
  const { envelope, dek } = await createVault(PASSPHRASE, BOOKS);

  const bytes = fromBase64(envelope.payload.ciphertext);
  bytes[5] ^= 0xff;

  await assert.rejects(() =>
    decryptWithDek(dek, { iv: envelope.payload.iv, ciphertext: toBase64(bytes) })
  );
});

test('a new recovery code retires the old one and keeps the passphrase working', async () => {
  const { envelope, dek, recoveryCode } = await createVault(PASSPHRASE, BOOKS);
  const { envelope: reissued, recoveryCode: fresh } = await resetRecoveryCode(envelope, dek);

  assert.notEqual(fresh, recoveryCode);
  await assert.rejects(() => unlockWithRecoveryCode(reissued, recoveryCode), /does not open/);

  const viaFresh = await unlockWithRecoveryCode(reissued, fresh);
  assert.equal(await decryptWithDek(viaFresh, reissued.payload), BOOKS);

  const viaPassphrase = await unlockWithPassphrase(reissued, PASSPHRASE);
  assert.equal(await decryptWithDek(viaPassphrase, reissued.payload), BOOKS);
});

test('two vaults made from the same passphrase do not share key material', async () => {
  const first = await createVault(PASSPHRASE, BOOKS);
  const second = await createVault(PASSPHRASE, BOOKS);

  // Different random salts and data keys, so nothing is reusable between them.
  assert.notEqual(first.envelope.passphrase.salt, second.envelope.passphrase.salt);
  assert.notEqual(first.envelope.passphrase.wrapped, second.envelope.passphrase.wrapped);
  assert.notEqual(first.envelope.payload.ciphertext, second.envelope.payload.ciphertext);
  assert.notEqual(first.recoveryCode, second.recoveryCode);
});
