'use client';

import { ChangeEvent, useMemo, useRef, useState } from 'react';
import { useLocalStorageState } from '@/lib/local-storage';
import { StringKey, useT } from '@/lib/i18n';
import { formatCurrency } from '@/lib/billing';
import { BankTransaction, mergeTransactions, parseBankCsv } from '@/lib/bank';
import { CATEGORY_IDS, CategoryId } from '@/lib/categories';
import {
  availableAccounts,
  availableYears,
  markInternalTransfers,
  merchantKey,
  summarise,
  unknownByMerchant,
} from '@/lib/finance';
import { CategoryBars, ProjectionChart } from '@/app/components/charts';

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function Stat({ label, value, sub, tone }: {
  label: string;
  value: string;
  sub?: string;
  tone?: 'good' | 'bad';
}) {
  const color = tone === 'good' ? 'var(--good)' : tone === 'bad' ? 'var(--bad)' : 'var(--ink)';

  return (
    <div className="card p-5">
      <div className="text-sm muted">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums" style={{ color }}>
        {value}
      </div>
      {sub && <div className="mt-1 text-xs faint">{sub}</div>}
    </div>
  );
}

export default function FinancePage() {
  const { t } = useT();
  const [transactions, setTransactions] = useLocalStorageState<BankTransaction[]>(
    'bank-transactions',
    []
  );
  const [year, setYear] = useState<number | null>(null);
  const [account, setAccount] = useState('all');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [bulkCategory, setBulkCategory] = useState<CategoryId | ''>('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const years = useMemo(() => availableYears(transactions), [transactions]);
  const accounts = useMemo(() => availableAccounts(transactions), [transactions]);
  const activeYear = year ?? years[0] ?? new Date().getFullYear();

  const scoped = useMemo(() => {
    const marked = markInternalTransfers(transactions);
    return account === 'all' ? marked : marked.filter((t) => t.account === account);
  }, [transactions, account]);

  const summary = useMemo(() => summarise(scoped, activeYear), [scoped, activeYear]);
  const unknowns = useMemo(() => unknownByMerchant(scoped, activeYear), [scoped, activeYear]);

  const categoryLabel = (id: CategoryId) => t(`cat.${id}` as StringKey);

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError('');
    setNotice('');

    try {
      const parsed = parseBankCsv(await file.text());
      const { merged, added, duplicates } = mergeTransactions(transactions, parsed.transactions);

      setTransactions(merged);
      setYear(Number(parsed.to.slice(0, 4)));
      setNotice(
        t('fin.imported', {
          added,
          duplicates,
          from: parsed.from,
          to: parsed.to,
        })
      );
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : 'Could not read that file.');
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  /** Applies a category to every transaction from one merchant, and remembers it. */
  const assignMerchant = (key: string, category: CategoryId) => {
    setTransactions(
      transactions.map((transaction) =>
        merchantKey(transaction.description) === key
          ? { ...transaction, category, manualCategory: true }
          : transaction
      )
    );
  };

  const togglePicked = (key: string) => {
    setPicked((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const applyBulk = () => {
    if (!bulkCategory || picked.size === 0) return;

    setTransactions(
      transactions.map((transaction) =>
        picked.has(merchantKey(transaction.description)) && transaction.category === 'unknown'
          ? { ...transaction, category: bulkCategory, manualCategory: true }
          : transaction
      )
    );
    setPicked(new Set());
    setBulkCategory('');
  };

  const clearAll = () => {
    if (!window.confirm(t('fin.clearConfirm'))) return;
    setTransactions([]);
    setNotice('');
  };

  const hasData = transactions.length > 0;

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">{t('fin.title')}</h1>
          <p className="mt-2 max-w-2xl muted">{t('fin.subtitle')}</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {accounts.length > 1 && (
            <select
              className="field field-inline"
              value={account}
              onChange={(event) => setAccount(event.target.value)}
            >
              <option value="all" style={{ color: 'var(--ink)', background: 'var(--surface)' }}>
                {t('fin.allAccounts', { count: accounts.length })}
              </option>
              {accounts.map((option) => (
                <option key={option} value={option} style={{ color: 'var(--ink)', background: 'var(--surface)' }}>
                  {option}
                </option>
              ))}
            </select>
          )}

        {years.length > 0 && (
          <select
            className="field field-inline"
            value={activeYear}
            onChange={(event) => setYear(Number(event.target.value))}
          >
            {years.map((option) => (
              <option key={option} value={option} style={{ color: 'var(--ink)', background: 'var(--surface)' }}>
                {option}
              </option>
            ))}
          </select>
        )}
        </div>
      </header>

      <section className="card p-6">
        <h2 className="text-lg font-semibold">{t('fin.import')}</h2>
        <p className="mt-1 max-w-2xl text-sm muted">{t('fin.importHint')}</p>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={handleFile}
            className="field max-w-md file:mr-3 file:rounded-[7px] file:border-0 file:bg-[var(--surface-sunken)] file:px-3 file:py-1.5 file:text-sm file:font-medium"
          />
        </div>

        {error && <div className="mt-4 panel p-3 text-sm text-[var(--bad)]">{error}</div>}
        {notice && !error && (
          <div className="mt-4 panel p-3 text-sm text-[var(--good)]">{notice}</div>
        )}
      </section>

      {!hasData ? (
        <section className="card p-10 text-center muted">{t('fin.noData')}</section>
      ) : (
        <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Stat label={t('fin.moneyIn')} value={formatCurrency(summary.moneyIn)} tone="good" />
            <Stat
              label={t('fin.spending')}
              value={formatCurrency(summary.spending)}
              sub={t('fin.perMonth', { amount: formatCurrency(summary.averageMonthlySpend) })}
            />
            <Stat
              label={t('fin.net')}
              value={formatCurrency(summary.net)}
              tone={summary.net < 0 ? 'bad' : 'good'}
            />
            <Stat
              label={t('fin.balance')}
              value={summary.latestBalance === null ? '—' : formatCurrency(summary.latestBalance)}
            />
          </section>

          <section className="grid gap-4 md:grid-cols-2">
            <Stat
              label={t('fin.fixed')}
              value={formatCurrency(summary.fixedSpend)}
              sub={t('fin.perMonth', {
                amount: formatCurrency(summary.monthsWithData ? summary.fixedSpend / summary.monthsWithData : 0),
              })}
            />
            <Stat
              label={t('fin.flexible')}
              value={formatCurrency(summary.discretionarySpend)}
              sub={t('fin.perMonth', {
                amount: formatCurrency(
                  summary.monthsWithData ? summary.discretionarySpend / summary.monthsWithData : 0
                ),
              })}
            />
          </section>

          <section className="card p-6">
            <h2 className="text-lg font-semibold">{t('fin.projection')}</h2>
            <p className="mt-1 text-sm muted">
              {t('fin.coverage', { days: summary.daysCovered, year: activeYear })}
            </p>

            <div className="mt-5">
              <ProjectionChart
                months={MONTH_LABELS}
                actualThrough={summary.monthsWithData - 1}
                series={[
                  {
                    label: t('fin.cumIn'),
                    color: 'var(--series-1)',
                    values: summary.months.map((month, index) =>
                      index < summary.monthsWithData
                        ? month.cumulativeIn
                        : (summary.projectedIn / 365) * ((index + 1) / 12) * 365
                    ),
                  },
                  {
                    label: t('fin.cumSpending'),
                    color: 'var(--series-3)',
                    values: summary.months.map((month, index) =>
                      index < summary.monthsWithData
                        ? month.cumulativeSpending
                        : (summary.projectedSpending / 12) * (index + 1)
                    ),
                  },
                ]}
              />
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <Stat label={t('fin.projectedIn')} value={formatCurrency(summary.projectedIn)} />
              <Stat
                label={t('fin.projectedSpending')}
                value={formatCurrency(summary.projectedSpending)}
              />
              <Stat
                label={t('fin.projectedNet')}
                value={formatCurrency(summary.projectedNet)}
                tone={summary.projectedNet < 0 ? 'bad' : 'good'}
              />
            </div>
          </section>

          <section className="card p-6">
            <h2 className="text-lg font-semibold">{t('fin.breakdown')}</h2>
            <p className="mt-1 max-w-3xl text-sm muted">{t('fin.breakdownHint')}</p>

            {summary.unknownCount > 0 && (
              <div className="mt-4 panel p-3 text-sm text-[var(--warn)]">
                {t('fin.unknownWarning', {
                  amount: formatCurrency(summary.unknownSpend),
                  count: summary.unknownCount,
                })}
              </div>
            )}

            <div className="mt-5">
              <CategoryBars
                fixedLabel={t('fin.fixed')}
                flexibleLabel={t('fin.flexible')}
                bars={summary.categories.map((category) => ({
                  label: categoryLabel(category.category),
                  value: category.total,
                  share: category.share,
                  count: category.count,
                  fixed: category.fixed,
                }))}
              />
            </div>
          </section>

          <section className="card p-6">
            <h2 className="text-lg font-semibold">{t('fin.tidy')}</h2>
            <p className="mt-1 max-w-3xl text-sm muted">{t('fin.tidyHint')}</p>

            {unknowns.length > 0 && (
              <div className="mt-4 flex flex-wrap items-center gap-3 panel p-3">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={picked.size === unknowns.slice(0, 25).length && picked.size > 0}
                    onChange={() =>
                      setPicked(
                        picked.size === unknowns.slice(0, 25).length
                          ? new Set()
                          : new Set(unknowns.slice(0, 25).map((group) => group.key))
                      )
                    }
                  />
                  {t('fin.selectAllUnknown')}
                </label>

                <select
                  className="field field-inline text-sm"
                  value={bulkCategory}
                  onChange={(event) => setBulkCategory(event.target.value as CategoryId)}
                >
                  <option value="" style={{ color: 'var(--ink)', background: 'var(--surface)' }}>
                    {t('fin.chooseCategory')}…
                  </option>
                  {CATEGORY_IDS.filter((id) => id !== 'unknown').map((id) => (
                    <option key={id} value={id} style={{ color: 'var(--ink)', background: 'var(--surface)' }}>
                      {categoryLabel(id)}
                    </option>
                  ))}
                </select>

                <button
                  className={picked.size > 0 && bulkCategory ? 'btn btn-primary' : 'btn'}
                  disabled={picked.size === 0 || !bulkCategory}
                  onClick={applyBulk}
                >
                  {t('fin.applyTo')}
                </button>

                {picked.size > 0 && (
                  <>
                    <span className="text-sm muted">{t('fin.selected', { count: picked.size })}</span>
                    <button className="btn" onClick={() => setPicked(new Set())}>
                      {t('fin.clearSelection')}
                    </button>
                  </>
                )}
              </div>
            )}

            {unknowns.length === 0 ? (
              <p className="mt-5 text-sm" style={{ color: 'var(--good)' }}>
                {t('fin.tidyDone')}
              </p>
            ) : (
              <div className="mt-5 space-y-2">
                {unknowns.slice(0, 25).map((group) => (
                  <div
                    key={group.key}
                    className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-3 border-b border-[var(--line)] pb-2 last:border-0"
                  >
                    <input
                      type="checkbox"
                      checked={picked.has(group.key)}
                      onChange={() => togglePicked(group.key)}
                      aria-label={group.label}
                    />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium" title={group.label}>
                        {group.label}
                      </div>
                      <div className="text-xs faint">
                        {group.count} {t('fin.transactions')}
                      </div>
                    </div>

                    <div className="whitespace-nowrap text-sm tabular-nums">
                      {formatCurrency(group.total)}
                    </div>

                    <select
                      className="field field-inline text-sm"
                      defaultValue=""
                      onChange={(event) => {
                        if (event.target.value) {
                          assignMerchant(group.key, event.target.value as CategoryId);
                        }
                      }}
                    >
                      <option value="" style={{ color: 'var(--ink)', background: 'var(--surface)' }}>
                        {t('fin.assign')}…
                      </option>
                      {CATEGORY_IDS.filter((id) => id !== 'unknown').map((id) => (
                        <option key={id} value={id} style={{ color: 'var(--ink)', background: 'var(--surface)' }}>
                          {categoryLabel(id)}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="flex justify-end">
            <button className="btn btn-danger" onClick={clearAll}>
              {t('fin.clearAll')}
            </button>
          </section>
        </>
      )}
    </div>
  );
}
