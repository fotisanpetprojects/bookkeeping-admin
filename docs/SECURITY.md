# How the encryption works

This repository is public, which raises an obvious question: if anyone can read the
code, what stops them reading the books?

The answer is that **there is no secret in the code, because there is no secret
anywhere**. No password hash, no key, no recovery value on disk. A wrong passphrase
fails an authentication tag rather than mismatching something stored.

This document exists so that claim can be checked rather than taken on faith.

## The shape

A random 256-bit **data key** encrypts the records. That key is then *wrapped* twice:

```
                    ┌─ wrapped by ── key derived from your passphrase
   data key (DEK) ──┤
                    └─ wrapped by ── key derived from your recovery code

   records ── encrypted by ── data key
```

Either wrapping unwraps the same data key, so either secret opens the vault, and
neither can be derived from the other.

Wrapping rather than encrypting twice buys two things:

- **Changing the passphrase re-wraps one small key** instead of re-encrypting every
  invoice, expense and transaction.
- **A second way in costs one wrapped copy**, not a second full ciphertext.

## Parameters

| | |
|---|---|
| Key derivation | PBKDF2-HMAC-SHA256 |
| Iterations | 600,000 (OWASP's current floor), recorded per vault so it can be raised later |
| Encryption | AES-GCM, 256-bit |
| IV | 12 random bytes, fresh for every encryption |
| Salt | 16 random bytes, separate per wrapping |
| Recovery code | 256 bits of `crypto.getRandomValues`, base32 |

All of it is the platform's own WebCrypto. No dependency touches the keys.

The recovery code is only lightly stretched (1,000 iterations) because it is already
256 bits of randomness — there is no low-entropy secret there to protect against
guessing. The passphrase is the one that needs the work factor.

## Why base32 and not base64

Base64 was the first attempt, and a test caught it. Its `+`, `/` and `=` carry
meaning, so grouping the code into readable chunks silently destroyed key material
and the vault could not be reopened. Base32 is alphanumeric, survives being written
on paper, and `O`/`0` and `I`/`1` slips are corrected on the way back in rather than
rejected.

## Where the key lives

Only in memory, for as long as the tab is open and unlocked. It is never written to
`localStorage`, `sessionStorage`, a cookie, or anywhere else. A reload therefore asks
again — that is the intended trade, not an oversight.

Optionally the vault locks itself after a period of inactivity. Off by default.

## What this protects against

- Someone opening the app on your unlocked computer
- Anyone reading the browser profile off a disk, backup or stolen laptop
- The hosted deployment being public — there is no data on the server either way
- A future sync server: it would only ever hold ciphertext it cannot read

## What it does **not** protect against

Stated plainly, because a security document that only lists wins is not much use:

- **A compromised browser or machine.** If something can run code in the page while
  the vault is unlocked, it can read the decrypted records. Encryption at rest is not
  a defence against an attacker already inside.
- **A weak passphrase.** 600,000 iterations raises the cost of guessing; it does not
  save `password123`.
- **Exported backups.** The backup file is plaintext JSON by design, so it can be
  restored anywhere. Treat it as sensitive — it is the one readable copy.
- **The recovery code.** Anyone holding it can open the vault. It is a spare key.
- **Forgetting both.** The data is then unrecoverable, by anyone, including me. This
  is the direct cost of the property that makes the rest true.

## Why there is no password reset

A reset link works because the server can restore access, which means the server can
read your data. Those two properties are mutually exclusive. The recovery code is the
reset mechanism, which is why setup makes saving it deliberately hard to skip.

## Verifying it yourself

```bash
npm test
```

Twelve tests assert the properties this document claims: that a wrong secret is
refused rather than returning rubbish, that tampering is detected, that a rotated
passphrase retires the old one while the recovery code still works, that two vaults
made from the same passphrase share no key material, and that no plaintext,
passphrase or recovery code survives into what gets written to disk.

You can also check it by hand. With the vault locked, open DevTools → Application →
Local Storage. There should be a single `vault.v1` blob of base64 and no readable
client name, amount or IBAN anywhere.

## Reading the code

- `lib/crypto.ts` — key derivation, wrapping, encryption. No app logic.
- `lib/vault.ts` — the in-memory store, the debounced flush, and the migration.
- `lib/local-storage.ts` — the four points where storage became vault-aware.
- `lib/crypto.test.ts` — the tests.
