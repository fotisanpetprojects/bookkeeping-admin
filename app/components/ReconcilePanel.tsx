'use client';

import { useMemo, useState } from 'react';
import { useT } from '@/lib/i18n';
import { formatCurrency } from '@/lib/billing';
import { BankTransaction } from '@/lib/bank';
import { AccountLabel, accountColour, displayAccount } from '@/lib/accounts';
import { reconcile } from '@/lib/finance';
import InfoMark from '@/app/components/InfoMark';

/**
 * Shows the page's arithmetic against the bank's own running balance.
 *
 * Every category here is a judgement and can be argued with. The balance printed on
 * each statement line is not. If the rows between two balances do not add up to the
 * difference between them, something is counted twice or missed — and no confidence
 * in the categories fixes that.
 *
 * It exists because a monthly average looked wrong and there was no way to check it
 * without taking someone's word.
 */
export default function ReconcilePanel({
  transactions,
  labels,
  accounts,
  year,
  spending,
  monthsWithData,
}: {
  transactions: BankTransaction[];
  labels: AccountLabel[];
  accounts: string[];
  year: number;
  spending: number;
  monthsWithData: number;
}) {
  const { t } = useT();
  const [open, setOpen] = useState(false);

  const checks = useMemo(() => reconcile(transactions, year), [transactions, year]);
  if (checks.length === 0) return null;

  const allBalance = checks.every((check) => check.balances);

  return (
    <section className="card p-5">
      <button
        className="flex w-full items-center justify-between gap-3 text-left"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <span className="flex items-center gap-2 text-sm font-semibold">
          {t('rec.title')}
          <InfoMark text={t('rec.info')} />
        </span>

        <span className="flex items-center gap-3">
          <span
            className="text-sm"
            style={{ color: allBalance ? 'var(--good)' : 'var(--warn)' }}
          >
            {allBalance
              ? t('rec.balances')
              : t('rec.mismatch', {
                  amount: formatCurrency(
                    checks.reduce((sum, check) => sum + Math.abs(check.difference), 0)
                  ),
                })}
          </span>
          <svg
            width="16"
            height="16"
            viewBox="0 0 20 20"
            fill="none"
            aria-hidden
            style={{ transform: open ? 'rotate(180deg)' : undefined }}
          >
            <path d="M5 8l5 5 5-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </button>

      {open && (
        <div className="mt-4 space-y-4">
          {checks.map((check) => (
            <div key={check.account} className="panel p-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ background: accountColour(accounts, check.account) }}
                  aria-hidden
                />
                {displayAccount(labels, check.account)}
              </div>

              <dl className="mt-3 grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
                <Row label={t('rec.opening')} value={formatCurrency(check.openingBalance)} />
                <Row label={t('rec.closing')} value={formatCurrency(check.closingBalance)} />
                <Row label={t('rec.bankSays')} value={formatCurrency(check.bankMovement)} />
                <Row label={t('rec.rowsSay')} value={formatCurrency(check.sumOfRows)} />
              </dl>

              <div className="mt-3 border-t border-[var(--line)] pt-3">
                <dl className="grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
                  <Row label={t('rec.moneyIn')} value={formatCurrency(check.moneyIn)} />
                  <Row label={t('rec.spending')} value={formatCurrency(-check.spending)} />
                  {check.investments !== 0 && (
                    <Row label={t('rec.investments')} value={formatCurrency(check.investments)} />
                  )}
                  {check.transfersOut !== 0 && (
                    <Row label={t('rec.transfersOut')} value={formatCurrency(check.transfersOut)} />
                  )}
                  {check.internal !== 0 && (
                    <Row label={t('rec.internal')} value={formatCurrency(check.internal)} />
                  )}
                </dl>
              </div>
            </div>
          ))}

          <div className="panel p-4">
            <dl className="grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
              <Row
                label={t('rec.perMonth')}
                value={formatCurrency(monthsWithData ? spending / monthsWithData : 0)}
              />
              <Row label="" value={t('rec.months', { count: monthsWithData })} />
            </dl>
          </div>
        </div>
      )}
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="muted">{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}
