'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useT } from '@/lib/i18n';
import {
  isUnlocked,
  lock,
  setUpVault,
  subscribeToVault,
  unlock,
  unlockWithRecovery,
  vaultExists,
  AUTO_LOCK_KEY,
} from '@/lib/vault';

/** Long enough to matter, short enough that people will actually choose one. */
const MIN_PASSPHRASE = 10;

const SETUP_REQUEST = 'vault-setup-request';

export function requestVaultSetup() {
  window.dispatchEvent(new Event(SETUP_REQUEST));
}

type Screen = 'checking' | 'open' | 'locked' | 'setup' | 'recovery-shown';

export default function VaultGate({ children }: { children: React.ReactNode }) {
  const { t } = useT();
  const [screen, setScreen] = useState<Screen>('checking');
  const [passphrase, setPassphrase] = useState('');
  const [repeat, setRepeat] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [usingRecovery, setUsingRecovery] = useState(false);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const settle = () => {
      if (!vaultExists()) setScreen('open');
      else setScreen(isUnlocked() ? 'open' : 'locked');
    };

    settle();
    const unsubscribe = subscribeToVault(settle);

    // Auto-lock. The timer restarts on any real interaction, so it only fires when
    // the app has genuinely been left alone.
    let idleTimer: ReturnType<typeof setTimeout> | null = null;

    const resetIdle = () => {
      if (idleTimer) clearTimeout(idleTimer);

      const minutes = Number(
        JSON.parse(window.localStorage.getItem(AUTO_LOCK_KEY) ?? '0') || 0
      );
      if (!minutes || !isUnlocked()) return;

      idleTimer = setTimeout(() => void lock(), minutes * 60_000);
    };

    const activity = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const;
    for (const event of activity) window.addEventListener(event, resetIdle, { passive: true });
    resetIdle();

    // The home page asks for the setup screen; the gate owns it because it already
    // owns the locked and unlocked states.
    const openSetup = () => setScreen('setup');
    window.addEventListener(SETUP_REQUEST, openSetup);

    return () => {
      unsubscribe();
      window.removeEventListener(SETUP_REQUEST, openSetup);
      for (const event of activity) window.removeEventListener(event, resetIdle);
      if (idleTimer) clearTimeout(idleTimer);
    };
  }, []);

  const clear = () => {
    setPassphrase('');
    setRepeat('');
    setError('');
  };

  const handleUnlock = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');

    try {
      if (usingRecovery) await unlockWithRecovery(recoveryCode);
      else await unlock(passphrase);
      clear();
      setRecoveryCode('');
    } catch (unlockError) {
      setError(unlockError instanceof Error ? unlockError.message : 'Could not unlock.');
    } finally {
      setBusy(false);
    }
  };

  const handleSetup = async (event: FormEvent) => {
    event.preventDefault();

    if (passphrase.length < MIN_PASSPHRASE) {
      setError(t('vault.tooShort', { min: MIN_PASSPHRASE }));
      return;
    }
    if (passphrase !== repeat) {
      setError(t('vault.mismatch'));
      return;
    }

    setBusy(true);
    setError('');

    try {
      const code = await setUpVault(passphrase);
      setRecoveryCode(code);
      clear();
      setScreen('recovery-shown');
    } catch (setupError) {
      setError(setupError instanceof Error ? setupError.message : 'Could not set that up.');
    } finally {
      setBusy(false);
    }
  };

  const downloadRecovery = () => {
    const blob = new Blob(
      [
        `Bookkeeping Admin — recovery code\n\n${recoveryCode}\n\n` +
          `This code opens your vault if you forget your passphrase.\n` +
          `Nobody can recover your data without one of the two. Keep this somewhere safe and private.\n` +
          `Created ${new Date().toLocaleString('nl-NL')}\n`,
      ],
      { type: 'text/plain' }
    );

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'bookkeeping-recovery-code.txt';
    link.click();
    URL.revokeObjectURL(url);
    setSaved(true);
  };

  if (screen === 'checking') {
    return null;
  }

  if (screen === 'open') {
    return (
      <>
        {children}
        {vaultExists() && (
          <button className="btn lock-button" onClick={() => void lock()} title={t('vault.lock')}>
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden>
              <rect x="4" y="9" width="12" height="8" rx="2" stroke="currentColor" strokeWidth="1.5" />
              <path d="M7 9V6.5a3 3 0 016 0V9" stroke="currentColor" strokeWidth="1.5" />
            </svg>
            {t('vault.lock')}
          </button>
        )}
      </>
    );
  }

  if (screen === 'recovery-shown') {
    return (
      <div className="vault-screen">
        <section className="card-raised w-full max-w-lg p-8">
          <h1 className="text-xl font-semibold">{t('vault.recoveryTitle')}</h1>
          <p className="mt-2 text-sm muted">{t('vault.recoveryBody')}</p>

          <p className="mt-5 select-all break-all rounded-[10px] border border-[var(--line-strong)] bg-[var(--surface-sunken)] p-4 text-center font-mono text-sm tracking-wide">
            {recoveryCode}
          </p>

          <div className="mt-4 flex flex-wrap gap-3">
            <button className="btn btn-primary" onClick={downloadRecovery}>
              {t('vault.download')}
            </button>
            <button
              className="btn"
              onClick={() => {
                void navigator.clipboard?.writeText(recoveryCode);
                setSaved(true);
              }}
            >
              {t('vault.copy')}
            </button>
          </div>

          <label className="mt-6 flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={saved}
              onChange={(event) => setSaved(event.target.checked)}
            />
            <span>{t('vault.confirmSaved')}</span>
          </label>

          <button
            className="btn btn-primary mt-5 w-full justify-center"
            disabled={!saved}
            onClick={() => {
              setRecoveryCode('');
              setScreen('open');
            }}
          >
            {t('vault.continue')}
          </button>
        </section>
      </div>
    );
  }

  if (screen === 'setup') {
    return (
      <div className="vault-screen">
        <form className="card-raised w-full max-w-md p-8" onSubmit={handleSetup}>
          <h1 className="text-xl font-semibold">{t('vault.setupTitle')}</h1>
          <p className="mt-2 text-sm muted">{t('vault.setupBody')}</p>

          <label className="mt-5 block text-sm muted">
            <span className="mb-2 block">{t('vault.passphrase')}</span>
            <input
              className="field"
              type="password"
              autoFocus
              autoComplete="new-password"
              value={passphrase}
              onChange={(event) => setPassphrase(event.target.value)}
            />
          </label>

          <label className="mt-4 block text-sm muted">
            <span className="mb-2 block">{t('vault.repeat')}</span>
            <input
              className="field"
              type="password"
              autoComplete="new-password"
              value={repeat}
              onChange={(event) => setRepeat(event.target.value)}
            />
          </label>

          <p className="mt-4 panel p-3 text-xs muted">{t('vault.noResetWarning')}</p>

          {error && <p className="mt-4 text-sm text-[var(--bad)]">{error}</p>}

          <div className="mt-5 flex gap-3">
            <button className="btn btn-primary flex-1 justify-center" disabled={busy} type="submit">
              {busy ? t('vault.working') : t('vault.createVault')}
            </button>
            <button
              className="btn"
              type="button"
              onClick={() => {
                clear();
                setScreen('open');
              }}
            >
              {t('fin.cancel')}
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="vault-screen">
      <form className="card-raised w-full max-w-md p-8" onSubmit={handleUnlock}>
        <h1 className="text-xl font-semibold">{t('vault.lockedTitle')}</h1>
        <p className="mt-2 text-sm muted">{t('vault.lockedBody')}</p>

        {usingRecovery ? (
          <label className="mt-5 block text-sm muted">
            <span className="mb-2 block">{t('vault.recoveryCode')}</span>
            <textarea
              className="field font-mono text-sm"
              rows={3}
              autoFocus
              value={recoveryCode}
              onChange={(event) => setRecoveryCode(event.target.value)}
            />
          </label>
        ) : (
          <label className="mt-5 block text-sm muted">
            <span className="mb-2 block">{t('vault.passphrase')}</span>
            <input
              className="field"
              type="password"
              autoFocus
              autoComplete="current-password"
              value={passphrase}
              onChange={(event) => setPassphrase(event.target.value)}
            />
          </label>
        )}

        {error && <p className="mt-4 text-sm text-[var(--bad)]">{error}</p>}

        <button className="btn btn-primary mt-5 w-full justify-center" disabled={busy} type="submit">
          {busy ? t('vault.working') : t('vault.unlock')}
        </button>

        <button
          className="mt-4 w-full text-center text-sm underline muted"
          type="button"
          onClick={() => {
            setUsingRecovery((value) => !value);
            setError('');
          }}
        >
          {usingRecovery ? t('vault.usePassphrase') : t('vault.forgot')}
        </button>
      </form>
    </div>
  );
}

/** Entry point for turning the lock on, rendered from the home page. */
export function useVaultSetup() {
  const [, force] = useState(0);

  useEffect(() => subscribeToVault(() => force((n) => n + 1)), []);

  return {
    exists: typeof window !== 'undefined' && vaultExists(),
    unlocked: isUnlocked(),
  };
}
