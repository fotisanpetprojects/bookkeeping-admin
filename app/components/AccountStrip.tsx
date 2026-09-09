'use client';

import { useMemo } from 'react';
import { useT } from '@/lib/i18n';
import { formatCurrency } from '@/lib/billing';
import { BankTransaction, normaliseAccount } from '@/lib/bank';
import { AccountLabel, accountColour, labelFor } from '@/lib/accounts';
import InfoMark from '@/app/components/InfoMark';

/**
 * One row per imported account, so it is obvious at a glance that more than one
 * statement is in play and which colour stands for which.
 *
 * The switch is the escape hatch for what detection cannot know. Matching the
 * counterparty catches transfers between two accounts you have imported; it cannot
 * catch a savings pot at another bank, because there is no second statement to
 * match against. Saying so here fixes that without importing anything.
 */
export default function AccountStrip({
  transactions,
  labels,
  onToggleInternal,
  year,
}: {
  transactions: BankTransaction[];
  labels: AccountLabel[];
  onToggleInternal: (account: string, internalOnly: boolean) => void;
  year: number;
}) {
  const { t } = useT();

  const accounts = useMemo(() => {
    const seen = new Map<string, { count: number; latestBalance: number | null; date: string }>();

    for (const transaction of transactions) {
      const key = normaliseAccount(transaction.account);
      if (!key || !transaction.date.startsWith(String(year))) continue;

      const current = seen.get(key) ?? { count: 0, latestBalance: null, date: '' };
      current.count += 1;
      if (transaction.balance !== null && transaction.date >= current.date) {
        current.latestBalance = transaction.balance;
        current.date = transaction.date;
      }
      seen.set(key, current);
    }

    return [...seen.entries()].sort((a, b) => b[1].count - a[1].count);
  }, [transactions, year]);

  const order = accounts.map(([account]) => account);

  // One account is just "your bank" — nothing to distinguish, nothing to explain.
  if (accounts.length < 2) return null;

  return (
    <section className="card p-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        {t('acs.title', { count: accounts.length })}
        <InfoMark text={t('acs.info')} />
      </h2>

      <div className="mt-3 space-y-2">
        {accounts.map(([account, stats]) => {
          const label = labelFor(labels, account);

          return (
            <div
              key={account}
              className="grid grid-cols-[auto_1fr_auto] items-center gap-3 border-b border-[var(--line)] pb-2 last:border-0 last:pb-0"
            >
              <span
                className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
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
              </div>

              <label className="flex cursor-pointer items-center gap-2 whitespace-nowrap text-xs muted">
                <input
                  type="checkbox"
                  role="switch"
                  className="switch"
                  checked={Boolean(label.internalOnly)}
                  onChange={(event) => onToggleInternal(account, event.target.checked)}
                />
                {t('acs.transfersOnly')}
              </label>
            </div>
          );
        })}
      </div>
    </section>
  );
}
