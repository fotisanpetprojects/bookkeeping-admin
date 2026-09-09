'use client';

import { useMemo } from 'react';
import { useT } from '@/lib/i18n';
import { useLocalStorageState } from '@/lib/local-storage';
import { BankTransaction, normaliseAccount } from '@/lib/bank';
import { ACCOUNT_LABELS_KEY, AccountKind, AccountLabel, labelFor } from '@/lib/accounts';

export default function AccountSettings() {
  const { t } = useT();
  const [transactions, setTransactions] = useLocalStorageState<BankTransaction[]>(
    'bank-transactions',
    []
  );
  const [labels, setLabels] = useLocalStorageState<AccountLabel[]>(ACCOUNT_LABELS_KEY, []);

  /**
   * Discards every imported transaction. It lives here rather than on the finance
   * page because it is a once-a-year action next to an everyday one, and nobody
   * should be able to wipe a year's import while glancing at their spending.
   */
  const clearAll = () => {
    if (!window.confirm(t('acc.clearConfirm', { count: transactions.length }))) return;
    setTransactions([]);
  };

  const accounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const transaction of transactions) {
      const key = normaliseAccount(transaction.account);
      if (!key) continue;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [transactions]);

  const update = (account: string, patch: Partial<AccountLabel>) => {
    const key = normaliseAccount(account);
    const existing = labels.find((label) => normaliseAccount(label.account) === key);

    setLabels(
      existing
        ? labels.map((label) =>
            normaliseAccount(label.account) === key ? { ...label, ...patch } : label
          )
        : [...labels, { ...labelFor(labels, key), ...patch, account: key }]
    );
  };

  return (
    <section className="card p-6">
      <h2 className="text-lg font-semibold">{t('acc.title')}</h2>
      <p className="mt-1 max-w-3xl text-sm muted">{t('acc.body')}</p>

      {transactions.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button className="btn btn-danger" onClick={clearAll}>
            {t('acc.clearAll')}
          </button>
          <span className="text-xs faint">{t('acc.clearHint')}</span>
        </div>
      )}

      {accounts.length === 0 ? (
        <p className="mt-5 text-sm faint">{t('acc.none')}</p>
      ) : (
        <div className="mt-5 space-y-4">
          {accounts.map(([account, count]) => {
            const label = labelFor(labels, account);

            return (
              <div key={account} className="panel grid gap-3 p-4 md:grid-cols-[1fr_1fr_auto]">
                <label className="text-sm muted">
                  <span className="mb-1.5 block">{t('acc.name')}</span>
                  <input
                    className="field"
                    value={label.name}
                    placeholder={t('acc.namePlaceholder')}
                    onChange={(event) => update(account, { name: event.target.value })}
                  />
                </label>

                <label className="text-sm muted">
                  <span className="mb-1.5 block">{t('acc.kind')}</span>
                  <select
                    className="field"
                    value={label.kind}
                    onChange={(event) => update(account, { kind: event.target.value as AccountKind })}
                  >
                    <option value="personal" style={{ color: 'var(--ink)', background: 'var(--surface)' }}>
                      {t('acc.personal')}
                    </option>
                    <option value="business" style={{ color: 'var(--ink)', background: 'var(--surface)' }}>
                      {t('acc.business')}
                    </option>
                  </select>
                </label>

                <div className="self-end text-sm">
                  {/* The number itself, so there is no doubt which account this row is. */}
                  <div className="font-mono text-xs faint">{account}</div>
                  <div className="mt-1 faint">{t('acc.transactions', { count })}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
