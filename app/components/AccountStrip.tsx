'use client';

import { useMemo } from 'react';
import { useT } from '@/lib/i18n';
import { formatCurrency } from '@/lib/billing';
import { BankTransaction, normaliseAccount } from '@/lib/bank';
import { AccountKind, AccountLabel, accountColour, labelFor } from '@/lib/accounts';
import { isSpending } from '@/lib/finance';
import InfoMark from '@/app/components/InfoMark';

/**
 * One row per imported account, so it is obvious more than one statement is in play,
 * which colour stands for which, and — crucially — how much of the total each one
 * accounts for.
 *
 * Showing the per-account spending is the point. A combined figure that looks too
 * high is impossible to argue with until you can see which account it came from;
 * a business account paying business costs can easily double a personal total, and
 * that is not a fault, it is two different questions added together.
 *
 * Both controls live here rather than one here and one in settings. Being told a
 * number is wrong and having the control that fixes it on another page is how a
 * feature ends up looking broken when it is merely hidden.
 */
export default function AccountStrip({
  transactions,
  labels,
  onToggleInternal,
  onChangeKind,
  year,
}: {
  transactions: BankTransaction[];
  labels: AccountLabel[];
  onToggleInternal: (account: string, internalOnly: boolean) => void;
  onChangeKind: (account: string, kind: AccountKind) => void;
  year: number;
}) {
  const { t } = useT();

  const accounts = useMemo(() => {
    const seen = new Map<
      string,
      { count: number; spending: number; latestBalance: number | null; date: string }
    >();

    for (const transaction of transactions) {
      const key = normaliseAccount(transaction.account);
      if (!key || !transaction.date.startsWith(String(year))) continue;

      const current = seen.get(key) ?? { count: 0, spending: 0, latestBalance: null, date: '' };
      current.count += 1;
      if (isSpending(transaction)) current.spending += Math.abs(transaction.amount);
      if (transaction.balance !== null && transaction.date >= current.date) {
        current.latestBalance = transaction.balance;
        current.date = transaction.date;
      }
      seen.set(key, current);
    }

    return [...seen.entries()].sort((a, b) => b[1].spending - a[1].spending);
  }, [transactions, year]);

  const order = accounts.map(([account]) => account);

  // One account is just "your bank" — nothing to distinguish, nothing to explain.
  if (accounts.length < 2) return null;

  const total = accounts.reduce((sum, [, stats]) => sum + stats.spending, 0);

  return (
    <section className="card p-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        {t('acs.title', { count: accounts.length })}
        <InfoMark text={t('acs.info')} />
      </h2>

      <div className="mt-3 space-y-3">
        {accounts.map(([account, stats]) => {
          const label = labelFor(labels, account);

          return (
            <div
              key={account}
              className="grid grid-cols-[auto_1fr] items-start gap-3 border-b border-[var(--line)] pb-3 last:border-0 last:pb-0 sm:grid-cols-[auto_1fr_auto]"
            >
              <span
                className="mt-1.5 inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: accountColour(order, account) }}
                aria-hidden
              />

              <div className="min-w-0">
                <div className="truncate text-sm font-medium">
                  {label.name.trim() || account}
                </div>
                <div className="text-xs faint">
                  {label.name.trim() ? `${account} · ` : ''}
                  {t('acs.rows', { count: stats.count })}
                  {stats.latestBalance !== null
                    ? ` · ${t('acs.balance', { amount: formatCurrency(stats.latestBalance) })}`
                    : ''}
                </div>

                {/* The share of the combined total this account is responsible for. */}
                <div className="mt-1 text-xs">
                  <span className="muted">{t('acs.spends')}</span>{' '}
                  <span className="tabular-nums">{formatCurrency(stats.spending)}</span>
                  {total > 0 && (
                    <span className="faint"> · {((stats.spending / total) * 100).toFixed(0)}%</span>
                  )}
                </div>
              </div>

              <div className="col-span-2 flex flex-wrap items-center gap-3 sm:col-span-1 sm:justify-end">
                <select
                  className="field field-inline text-xs"
                  value={label.kind}
                  onChange={(event) => onChangeKind(account, event.target.value as AccountKind)}
                  aria-label={t('acc.kind')}
                >
                  <option value="personal" style={{ color: 'var(--ink)', background: 'var(--surface)' }}>
                    {t('acc.personal')}
                  </option>
                  <option value="business" style={{ color: 'var(--ink)', background: 'var(--surface)' }}>
                    {t('acc.business')}
                  </option>
                </select>

                <label className="flex cursor-pointer items-center gap-2 whitespace-nowrap text-xs muted">
                  <input
                    type="checkbox"
                    role="switch"
                    className="switch"
                    checked={label.internalOnly !== false}
                    onChange={(event) => onToggleInternal(account, event.target.checked)}
                  />
                  {t('acs.transfersOnly')}
                </label>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
