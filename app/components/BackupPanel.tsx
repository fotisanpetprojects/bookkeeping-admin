'use client';

import { ChangeEvent, useMemo, useRef, useState } from 'react';
import { useLocalStorageState } from '@/lib/local-storage';
import { useT } from '@/lib/i18n';
import { useConfirm } from '@/app/components/Confirm';
import { ClientProfile, SavedBusinessProfile, StoredInvoice } from '@/lib/billing';
import {
  BackupPayload,
  RestoreMode,
  applyBackup,
  describeBackup,
  downloadBackup,
  parseBackup,
} from '@/lib/backup';

type Expense = { id: number };

export default function BackupPanel() {
  const [businessProfiles] = useLocalStorageState<SavedBusinessProfile[]>(
    'business-profiles',
    []
  );
  const [clientProfiles] = useLocalStorageState<ClientProfile[]>('client-profiles', []);
  const [invoices] = useLocalStorageState<StoredInvoice[]>('invoices', []);
  const [expenses] = useLocalStorageState<Expense[]>('expenses', []);
  const [transactions] = useLocalStorageState<{ id: string }[]>('bank-transactions', []);

  const [pendingBackup, setPendingBackup] = useState<BackupPayload | null>(null);
  const [pendingFileName, setPendingFileName] = useState('');
  const [mode, setMode] = useState<RestoreMode>('merge');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { t } = useT();
  const confirm = useConfirm();

  const hasData =
    businessProfiles.length > 0 ||
    clientProfiles.length > 0 ||
    invoices.length > 0 ||
    expenses.length > 0 ||
    transactions.length > 0;

  const pendingCounts = useMemo(() => {
    return pendingBackup ? describeBackup(pendingBackup.data) : null;
  }, [pendingBackup]);

  const clearPending = () => {
    setPendingBackup(null);
    setPendingFileName('');
    setMode('merge');

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleExport = () => {
    setError('');

    try {
      downloadBackup();
      setNotice(t('msg.backupDownloaded'));
    } catch {
      setNotice('');
      setError(t('msg.backupFailed'));
    }
  };

  const handleFileChosen = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError('');
    setNotice('');

    try {
      const payload = parseBackup(await file.text());
      setPendingBackup(payload);
      setPendingFileName(file.name);
    } catch (parseError) {
      clearPending();
      setError(parseError instanceof Error ? parseError.message : 'Could not read that file.');
    }
  };

  const handleRestore = async () => {
    if (!pendingBackup) return;

    setError('');
    setNotice('');

    if (mode === 'replace') {
      const { confirmed } = await confirm({
        message: t('backup.replaceConfirm'),
        confirmLabel: t('backup.replaceBtn'),
        danger: true,
      });

      if (!confirmed) {
        return;
      }

      try {
        downloadBackup();
      } catch {
        setError(t('msg.safetyBackupFailed'));
        return;
      }
    }

    try {
      const result = applyBackup(pendingBackup, mode);
      const { added } = result;

      setNotice(
        mode === 'replace'
          ? 'Restore complete. Your data now matches the backup file.'
          : `Merge complete. Added ${added.invoices} invoice(s), ${added.expenses} expense(s), ${added.clientProfiles} client profile(s) and ${added.businessProfiles} business profile(s). Existing entries were left untouched.`
      );
      clearPending();
    } catch (restoreError) {
      setError(
        restoreError instanceof Error ? restoreError.message : 'Could not restore that backup.'
      );
    }
  };

  return (
    <section className="card p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-xl font-semibold">{t('backup.title')}</h2>
          <p className="mt-2 max-w-2xl text-sm muted">
            {t('backup.intro')}
          </p>
          <p className="mt-2 text-sm faint">
            {t('backup.stored')}{' '}{invoices.length} invoice(s) · {expenses.length} expense(s) ·{' '}
            {transactions.length} bank transaction(s) · {clientProfiles.length} client
            profile(s) · {businessProfiles.length} business profile(s)
          </p>
        </div>

        <button
          onClick={handleExport}
          disabled={!hasData}
          className="btn btn-primary disabled:cursor-not-allowed disabled:opacity-40"
        >
          {t('backup.download')}
        </button>
      </div>

      <div className="mt-5 border-t border-[var(--line)] pt-5">
        <label className="block text-sm muted">
          <span className="mb-2 block">{t('backup.restoreFrom')}</span>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            onChange={handleFileChosen}
            className="field max-w-md file:mr-3 file:rounded-[7px] file:border-0 file:bg-[var(--surface-sunken)] file:px-3 file:py-1.5 file:text-sm file:font-medium"
          />
        </label>

        {pendingBackup && pendingCounts && (
          <div className="mt-4 panel p-4">
            <div className="text-sm muted">
              <span className="font-medium">{pendingFileName}</span> contains{' '}
              {pendingCounts.invoices} invoice(s), {pendingCounts.expenses} expense(s),{' '}
              {pendingCounts.transactions} bank transaction(s),{' '}
              {pendingCounts.clientProfiles} client profile(s) and{' '}
              {pendingCounts.businessProfiles} business profile(s)
              {pendingBackup.exportedAt
                ? `, exported ${new Date(pendingBackup.exportedAt).toLocaleString('nl-NL')}`
                : ''}
              .
            </div>

            <div className="mt-4 space-y-2 text-sm">
              <label className="flex items-start gap-3">
                <input
                  type="radio"
                  name="restore-mode"
                  checked={mode === 'merge'}
                  onChange={() => setMode('merge')}
                  className="mt-1"
                />
                <span>
                  <span className="font-medium">{t('backup.merge')}</span>
                  <span className="block muted">
                    {t('backup.mergeHint')}
                  </span>
                </span>
              </label>

              <label className="flex items-start gap-3">
                <input
                  type="radio"
                  name="restore-mode"
                  checked={mode === 'replace'}
                  onChange={() => setMode('replace')}
                  className="mt-1"
                />
                <span>
                  <span className="font-medium">{t('backup.replace')}</span>
                  <span className="block muted">
                    {t('backup.replaceHint')}
                  </span>
                </span>
              </label>
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              <button
                onClick={handleRestore}
                className="btn btn-primary"
              >
                {mode === 'merge' ? t('backup.mergeBtn') : t('backup.replaceBtn')}
              </button>
              <button
                onClick={clearPending}
                className="btn"
              >
                {t('backup.cancel')}
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="mt-4 panel p-3 text-sm text-[var(--bad)]">
            {error}
          </div>
        )}

        {notice && !error && (
          <div className="mt-4 panel p-3 text-sm text-[var(--good)]">
            {notice}
          </div>
        )}
      </div>
    </section>
  );
}
