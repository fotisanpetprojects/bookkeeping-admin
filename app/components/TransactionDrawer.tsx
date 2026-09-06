'use client';

import { useEffect, useMemo, useState } from 'react';
import { formatCurrency, formatDate } from '@/lib/billing';
import { BankTransaction } from '@/lib/bank';
import { useT } from '@/lib/i18n';

const PAGE_SIZE = 10;

/**
 * Slides in from the right with the transactions behind a figure. A category can
 * hold hundreds of rows, so it pages rather than rendering the lot.
 */
export default function TransactionDrawer({
  title,
  subtitle,
  transactions,
  onClose,
}: {
  title: string;
  subtitle?: string;
  transactions: BankTransaction[];
  onClose: () => void;
}) {
  const { t } = useT();
  const [page, setPage] = useState(0);

  // Escape closes, and the page behind must not scroll under the drawer.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  const sorted = useMemo(
    () => [...transactions].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)),
    [transactions]
  );

  const pages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const current = Math.min(page, pages - 1);
  const rows = sorted.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE);
  const total = sorted.reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0);

  return (
    <div className="drawer-root" role="dialog" aria-modal="true" aria-label={title}>
      <button className="drawer-scrim" aria-label={t('common.close')} onClick={onClose} />

      <aside className="drawer-panel">
        <header className="flex items-start justify-between gap-4 border-b border-[var(--line)] p-5">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold">{title}</h2>
            <p className="mt-1 text-sm muted">
              {subtitle ? `${subtitle} · ` : ''}
              {sorted.length} {t('fin.transactions')} · {formatCurrency(total)}
            </p>
          </div>
          <button className="btn btn-icon" onClick={onClose} aria-label={t('common.close')}>
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
              <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-5">
          {rows.length === 0 ? (
            <p className="muted">{t('chart.nothingYear')}</p>
          ) : (
            <ul className="space-y-3">
              {rows.map((transaction) => (
                <li
                  key={transaction.id}
                  className="flex items-start justify-between gap-3 border-b border-[var(--line)] pb-3 last:border-0"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium" title={transaction.description}>
                      {transaction.description}
                    </div>
                    <div className="mt-0.5 text-xs faint">
                      {formatDate(transaction.date)}
                      {transaction.method ? ` · ${transaction.method}` : ''}
                      {transaction.manualCategory ? ` · ${t('fin.setByHand')}` : ''}
                    </div>
                  </div>
                  <div className="whitespace-nowrap text-sm tabular-nums">
                    {formatCurrency(Math.abs(transaction.amount))}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {pages > 1 && (
          <footer className="flex items-center justify-between gap-3 border-t border-[var(--line)] p-4">
            <button className="btn" disabled={current === 0} onClick={() => setPage(current - 1)}>
              {t('common.previous')}
            </button>
            <span className="text-sm muted">
              {t('common.pageOf', { page: current + 1, pages })}
            </span>
            <button
              className="btn"
              disabled={current >= pages - 1}
              onClick={() => setPage(current + 1)}
            >
              {t('common.next')}
            </button>
          </footer>
        )}
      </aside>
    </div>
  );
}
