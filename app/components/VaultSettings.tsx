'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useT } from '@/lib/i18n';
import { useLocalStorageState } from '@/lib/local-storage';
import {
  AUTO_LOCK_KEY,
  isUnlocked,
  reissueRecoveryCode,
  removeVault,
  rotatePassphrase,
  subscribeToVault,
  vaultExists,
} from '@/lib/vault';
import { requestVaultSetup } from '@/app/components/VaultGate';
import { useConfirm } from '@/app/components/Confirm';

const MIN_PASSPHRASE = 10;
const AUTO_LOCK_CHOICES = [0, 5, 15, 60];

export default function VaultSettings() {
  const { t } = useT();
  const confirm = useConfirm();
  const [state, setState] = useState({ exists: false, unlocked: false });
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [freshCode, setFreshCode] = useState('');
  const [autoLock, setAutoLock] = useLocalStorageState(AUTO_LOCK_KEY, 0);

  useEffect(() => {
    const settle = () => setState({ exists: vaultExists(), unlocked: isUnlocked() });
    settle();
    return subscribeToVault(settle);
  }, []);

  const handleChange = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setNotice('');

    if (next.length < MIN_PASSPHRASE) {
      setError(t('vault.tooShort', { min: MIN_PASSPHRASE }));
      return;
    }

    setBusy(true);
    try {
      await rotatePassphrase(current, next);
      setCurrent('');
      setNext('');
      setNotice(t('vault.changed'));
    } catch (changeError) {
      setError(changeError instanceof Error ? changeError.message : 'Could not change it.');
    } finally {
      setBusy(false);
    }
  };

  const handleReissue = async () => {
    setError('');
    setNotice('');
    setBusy(true);

    try {
      setFreshCode(await reissueRecoveryCode());
    } catch (reissueError) {
      setError(reissueError instanceof Error ? reissueError.message : 'Could not issue a code.');
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async () => {
    const { confirmed } = await confirm({
      message: t('vault.removeConfirm'),
      confirmLabel: t('vault.removeAction'),
      danger: true,
    });
    if (!confirmed) return;

    setError('');
    try {
      await removeVault();
      setNotice('');
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : 'Could not turn it off.');
    }
  };

  if (!state.exists) {
    return (
      <section className="card p-6">
        <h2 className="text-lg font-semibold">{t('vault.panelTitle')}</h2>
        <p className="mt-1 max-w-2xl text-sm muted">{t('vault.panelBody')}</p>
        <p className="mt-3 text-sm text-[var(--warn)]">{t('vault.notSetUp')}</p>

        <button className="btn btn-primary mt-4" onClick={requestVaultSetup}>
          {t('vault.enable')}
        </button>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      <section className="card p-6">
        <h2 className="text-lg font-semibold">{t('vault.changeTitle')}</h2>

        <form className="mt-4 grid gap-4 md:grid-cols-2" onSubmit={handleChange}>
          <label className="text-sm muted">
            <span className="mb-2 block">{t('vault.currentPassphrase')}</span>
            <input
              className="field"
              type="password"
              autoComplete="current-password"
              value={current}
              onChange={(event) => setCurrent(event.target.value)}
            />
          </label>

          <label className="text-sm muted">
            <span className="mb-2 block">{t('vault.newPassphrase')}</span>
            <input
              className="field"
              type="password"
              autoComplete="new-password"
              value={next}
              onChange={(event) => setNext(event.target.value)}
            />
          </label>

          <div className="md:col-span-2">
            <button className="btn btn-primary" disabled={busy} type="submit">
              {busy ? t('vault.working') : t('vault.changeAction')}
            </button>
          </div>
        </form>

        <label className="mt-6 block text-sm muted">
          <span className="mb-2 block">{t('vault.autoLock')}</span>
          <select
            className="field field-inline"
            value={autoLock}
            onChange={(event) => setAutoLock(Number(event.target.value))}
          >
            {AUTO_LOCK_CHOICES.map((minutes) => (
              <option key={minutes} value={minutes} style={{ color: 'var(--ink)', background: 'var(--surface)' }}>
                {minutes === 0 ? t('vault.autoLockNever') : t('vault.autoLockMinutes', { count: minutes })}
              </option>
            ))}
          </select>
        </label>

        {error && <p className="mt-4 text-sm text-[var(--bad)]">{error}</p>}
        {notice && !error && <p className="mt-4 text-sm text-[var(--good)]">{notice}</p>}
      </section>

      <section className="card p-6">
        <h2 className="text-lg font-semibold">{t('vault.newCodeTitle')}</h2>
        <p className="mt-1 max-w-2xl text-sm muted">{t('vault.newCodeBody')}</p>

        {freshCode ? (
          <>
            <p className="mt-4 select-all break-all rounded-[10px] border border-[var(--line-strong)] bg-[var(--surface-sunken)] p-4 text-center font-mono text-sm">
              {freshCode}
            </p>
            <p className="mt-2 text-xs faint">{t('vault.recoveryBody')}</p>
            <button className="btn mt-3" onClick={() => setFreshCode('')}>
              {t('vault.continue')}
            </button>
          </>
        ) : (
          <button className="btn mt-4" disabled={busy} onClick={handleReissue}>
            {t('vault.newCodeAction')}
          </button>
        )}
      </section>

      <section className="card p-6">
        <h2 className="text-lg font-semibold">{t('vault.removeTitle')}</h2>
        <p className="mt-1 max-w-2xl text-sm muted">{t('vault.removeBody')}</p>

        <button className="btn btn-danger mt-4" onClick={handleRemove}>
          {t('vault.removeAction')}
        </button>
      </section>
    </div>
  );
}
