'use client';

import { ChangeEvent, useMemo, useRef, useState } from 'react';
import { useLocalStorageState } from '@/lib/local-storage';
import { StringKey, useT } from '@/lib/i18n';
import { formatCurrency } from '@/lib/billing';
import { BankTransaction, mergeTransactions, parseBankCsv } from '@/lib/bank';
import { CATEGORIES, CATEGORY_IDS, CategoryId } from '@/lib/categories';

const FIXED_CATEGORIES = new Set(
  CATEGORIES.filter((category) => category.fixed).map((category) => category.id)
);
import {
  ACCOUNT_LABELS_KEY,
  AccountLabel,
  displayAccount,
  internalAccounts,
  kindOf,
  labelFor,
  transactionsForKind,
} from '@/lib/accounts';
import { normaliseAccount } from '@/lib/bank';
import AccountStrip from '@/app/components/AccountStrip';
import InfoMark from '@/app/components/InfoMark';
import {
  availableAccounts,
  availableYears,
  markInternalTransfers,
  merchantKey,
  summarise,
  unknownByMerchant,
} from '@/lib/finance';
import { CategoryBar, CategoryBars, ProjectionChart } from '@/app/components/charts';
import TransactionDrawer from '@/app/components/TransactionDrawer';
import ConfirmDelete from '@/app/components/ConfirmDelete';
import { isSpending } from '@/lib/finance';

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Enough to work through in one sitting; the rest is behind the arrow. */
const SHOWN_UNKNOWNS = 8;

function Stat({ label, value, sub, tone, onOpen, info }: {
  label: string;
  value: string;
  sub?: string;
  tone?: 'good' | 'bad';
  onOpen?: () => void;
  /** What this figure counts, and what it deliberately leaves out. */
  info?: string;
}) {
  const color = tone === 'good' ? 'var(--good)' : tone === 'bad' ? 'var(--bad)' : 'var(--ink)';

  const body = (
    <>
      <div className="flex items-center gap-2 text-sm muted">
        {label}
        {info && <InfoMark text={info} />}
      </div>
      <div className="mt-1 text-2xl font-semibold tabular-nums" style={{ color }}>
        {value}
      </div>
      {sub && <div className="mt-1 text-xs faint">{sub}</div>}
    </>
  );

  if (!onOpen) {
    return <div className="card p-5">{body}</div>;
  }

  return (
    <button className="card p-5 text-left transition hover:-translate-y-0.5" onClick={onOpen}>
      {body}
    </button>
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
  const [drawer, setDrawer] = useState<
    { title: string; subtitle?: string; filter: (t: BankTransaction) => boolean } | null
  >(null);
  const [showAllUnknown, setShowAllUnknown] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{ ids: string[]; message: string } | null>(null);
  const [skipDeleteConfirm, setSkipDeleteConfirm] = useLocalStorageState(
    'skip-delete-confirm',
    false
  );
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [labels, setLabels] = useLocalStorageState<AccountLabel[]>(ACCOUNT_LABELS_KEY, []);
  const years = useMemo(() => availableYears(transactions), [transactions]);
  const accounts = useMemo(() => availableAccounts(transactions), [transactions]);
  const hasBusiness = useMemo(
    () => accounts.some((account) => kindOf(labels, account) === 'business'),
    [accounts, labels]
  );
  const activeYear = year ?? years[0] ?? new Date().getFullYear();

  /**
   * Internal transfers are worked out across *every* account before any filter is
   * applied. Deciding it after filtering would make a transfer look external simply
   * because the other side had been filtered away.
   */
  const scoped = useMemo(() => {
    const marked = markInternalTransfers(transactions, internalAccounts(labels));

    if (account === 'all') return marked;
    if (account === 'personal' || account === 'business') {
      return transactionsForKind(marked, labels, account);
    }

    return marked.filter((t) => normaliseAccount(t.account) === normaliseAccount(account));
  }, [transactions, account, labels]);

  const summary = useMemo(() => summarise(scoped, activeYear), [scoped, activeYear]);
  const unknowns = useMemo(() => unknownByMerchant(scoped, activeYear), [scoped, activeYear]);
  const shownUnknowns = showAllUnknown ? unknowns : unknowns.slice(0, SHOWN_UNKNOWNS);

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

  const setInternalOnly = (account: string, internalOnly: boolean) => {
    const key = normaliseAccount(account);
    const existing = labels.find((label) => normaliseAccount(label.account) === key);

    setLabels(
      existing
        ? labels.map((label) =>
            normaliseAccount(label.account) === key ? { ...label, internalOnly } : label
          )
        : [...labels, { ...labelFor(labels, key), internalOnly }]
    );
  };

  const deleteIds = (ids: string[]) => {
    const doomed = new Set(ids);
    setTransactions(transactions.filter((transaction) => !doomed.has(transaction.id)));
    setPicked(new Set());
  };

  /** Confirms once, unless the user has said not to ask again. */
  const requestDelete = (ids: string[], message: string) => {
    if (skipDeleteConfirm) {
      deleteIds(ids);
      return;
    }
    setPendingDelete({ ids, message });
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
                {t('fin.allAccountsOption')}
              </option>

              {/* Grouping only helps once an account has been marked business. */}
              {hasBusiness && (
                <>
                  <option value="personal" style={{ color: 'var(--ink)', background: 'var(--surface)' }}>
                    {t('fin.personalOnly')}
                  </option>
                  <option value="business" style={{ color: 'var(--ink)', background: 'var(--surface)' }}>
                    {t('fin.businessOnly')}
                  </option>
                </>
              )}

              {accounts.map((option) => (
                <option key={option} value={option} style={{ color: 'var(--ink)', background: 'var(--surface)' }}>
                  {displayAccount(labels, option)}
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

        {/*
          Importing is something you do a few times a year, so it does not deserve a
          panel at the top of a page you read every week. The real input stays in the
          DOM for the file dialog and is opened by this button.
        */}
        <button
          className="btn btn-icon"
          title={t('fin.import')}
          aria-label={t('fin.import')}
          onClick={() => fileInputRef.current?.click()}
        >
          <svg width="17" height="17" viewBox="0 0 20 20" fill="none" aria-hidden>
            <path
              d="M10 13.5V3.5m0 0L6.5 7M10 3.5L13.5 7M4 14.5v1a1.5 1.5 0 001.5 1.5h9a1.5 1.5 0 001.5-1.5v-1"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        <InfoMark text={t('info.import')} />

        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          onChange={handleFile}
          className="hidden"
        />
        </div>
      </header>

      {error && <div className="panel p-3 text-sm text-[var(--bad)]">{error}</div>}
      {notice && !error && <div className="panel p-3 text-sm text-[var(--good)]">{notice}</div>}

      {!hasData ? (
        <section className="card p-10 text-center muted">{t('fin.noData')}</section>
      ) : (
        <>
          <AccountStrip
            transactions={transactions}
            labels={labels}
            onToggleInternal={setInternalOnly}
            year={activeYear}
          />

          <section className="grid gap-4 md:grid-cols-3">
            <Stat
              label={t('fin.totalOut')}
              info={t('info.totalOut')}
              value={formatCurrency(summary.spending)}
              sub={
                summary.internalCount > 0
                  ? t('fin.internal') + ': ' + formatCurrency(summary.internalIn)
                  : undefined
              }
              onOpen={
                summary.internalCount > 0
                  ? () =>
                      setDrawer({
                        title: t('fin.internal'),
                        subtitle: String(activeYear),
                        filter: (transaction) =>
                          Boolean(transaction.internalTransfer) &&
                          transaction.date.startsWith(String(activeYear)),
                      })
                  : undefined
              }
            />

            <Stat
              label={t('fin.fixed')}
              info={t('info.fixed')}
              value={formatCurrency(summary.fixedSpend)}
              sub={t('fin.perMonth', {
                amount: formatCurrency(
                  summary.monthsWithData ? summary.fixedSpend / summary.monthsWithData : 0
                ),
              })}
              onOpen={() =>
                setDrawer({
                  title: t('fin.fixed'),
                  subtitle: String(activeYear),
                  filter: (transaction) =>
                    isSpending(transaction) &&
                    transaction.date.startsWith(String(activeYear)) &&
                    FIXED_CATEGORIES.has(transaction.category),
                })
              }
            />

            <Stat
              label={t('fin.flexible')}
              info={t('info.flexible')}
              value={formatCurrency(summary.discretionarySpend)}
              sub={t('fin.perMonth', {
                amount: formatCurrency(
                  summary.monthsWithData ? summary.discretionarySpend / summary.monthsWithData : 0
                ),
              })}
              onOpen={() =>
                setDrawer({
                  title: t('fin.flexible'),
                  subtitle: String(activeYear),
                  filter: (transaction) =>
                    isSpending(transaction) &&
                    transaction.date.startsWith(String(activeYear)) &&
                    !FIXED_CATEGORIES.has(transaction.category),
                })
              }
            />
          </section>

          <section className="card p-6">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              {t('fin.projection')}
              <InfoMark text={t('info.projection')} />
            </h2>
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

          </section>

          {/* In and out side by side: the two halves of the same question. */}
          <section className="grid gap-4 xl:grid-cols-2">
            <div className="card p-6">
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                {t('fin.incoming')}
                <InfoMark text={t('info.incoming')} />
              </h2>
              <p className="mt-1 text-sm muted">{t('fin.incomingHint')}</p>

              <div className="mt-5">
                {summary.incomeSources.length === 0 ? (
                  <p className="py-8 text-center text-sm faint">{t('fin.noIncome')}</p>
                ) : (
                  <CategoryBars
                    tone="in"
                    onSelect={(bar: CategoryBar) =>
                      setDrawer({
                        title: bar.label,
                        subtitle: String(activeYear),
                        filter: (transaction) =>
                          transaction.amount > 0 &&
                          transaction.category !== 'transfers' &&
                          transaction.date.startsWith(String(activeYear)) &&
                          merchantKey(transaction.description) === bar.id,
                      })
                    }
                    bars={summary.incomeSources.map((source) => ({
                      id: source.key,
                      label: source.label,
                      value: source.total,
                      share: source.share,
                      count: source.count,
                      fixed: false,
                      internal: source.internal,
                      // Greyed is the whole signal; a percentage of income it has no
                      // share of would just be noise beside it.
                      note: source.internal ? '' : undefined,
                    }))}
                  />
                )}
              </div>
            </div>

            <div className="card p-6">
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                {t('fin.breakdown')}

                {/* A warning block here pushed this panel taller than the one beside
                    it. The caveat still needs saying, so it hides behind a mark. */}
                {summary.unknownCount > 0 && (
                  <span
                    className="warn-mark"
                    tabIndex={0}
                    role="note"
                    aria-label={t('fin.unknownWarning', {
                      amount: formatCurrency(summary.unknownSpend),
                      count: summary.unknownCount,
                    })}
                    data-tip={t('fin.unknownWarning', {
                      amount: formatCurrency(summary.unknownSpend),
                      count: summary.unknownCount,
                    })}
                  >
                    !
                  </span>
                )}
              </h2>
              <p className="mt-1 text-sm muted">{t('fin.breakdownHint')}</p>

              <div className="mt-5">
                <CategoryBars
                  fixedLabel={t('fin.fixed')}
                  flexibleLabel={t('fin.flexible')}
                  onSelect={(bar: CategoryBar) =>
                    setDrawer({
                      title: bar.label,
                      subtitle: String(activeYear),
                      filter: (transaction) =>
                        isSpending(transaction) &&
                        transaction.date.startsWith(String(activeYear)) &&
                        transaction.category === bar.id,
                    })
                  }
                  bars={summary.categories.map((category) => ({
                    id: category.category,
                    label: categoryLabel(category.category),
                    value: category.total,
                    share: category.share,
                    count: category.count,
                    fixed: category.fixed,
                  }))}
                />
              </div>

              <p className="mt-4 text-xs faint">{t('fin.recurringNote')}</p>
            </div>
          </section>

          <section className="card p-6">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              {t('fin.tidy')}
              <InfoMark text={t('info.tidy')} />
            </h2>
            <p className="mt-1 max-w-3xl text-sm muted">{t('fin.tidyHint')}</p>

            {unknowns.length > 0 && (
              <div className="mt-4 flex flex-wrap items-center gap-3 panel p-3">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={picked.size === shownUnknowns.length && picked.size > 0}
                    onChange={() =>
                      setPicked(
                        picked.size === shownUnknowns.length
                          ? new Set()
                          : new Set(shownUnknowns.map((group) => group.key))
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
                {shownUnknowns.map((group) => (
                  <div
                    key={group.key}
                    className="grid grid-cols-[auto_1fr_auto_auto_auto] items-center gap-3 border-b border-[var(--line)] pb-2 last:border-0"
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

                    <button
                      className="btn btn-icon btn-danger"
                      title={t('fin.deleteGroup')}
                      aria-label={t('fin.deleteGroup')}
                      onClick={() =>
                        requestDelete(
                          group.ids,
                          t('fin.deleteConfirm', { count: group.count, name: group.label })
                        )
                      }
                    >
                      <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden>
                        <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {unknowns.length > SHOWN_UNKNOWNS && (
              <button
                className="btn mt-4"
                onClick={() => setShowAllUnknown((value) => !value)}
                aria-expanded={showAllUnknown}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 20 20"
                  fill="none"
                  aria-hidden
                  style={{ transform: showAllUnknown ? 'rotate(180deg)' : undefined }}
                >
                  <path d="M5 8l5 5 5-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {showAllUnknown ? t('fin.showFewer') : t('fin.showAll', { count: unknowns.length })}
              </button>
            )}
          </section>
        </>
      )}

      {drawer && (
        <TransactionDrawer
          title={drawer.title}
          subtitle={drawer.subtitle}
          transactions={scoped.filter(drawer.filter)}
          onClose={() => setDrawer(null)}
          onDelete={(transaction) =>
            requestDelete([transaction.id], t('fin.deleteOneConfirm'))
          }
        />
      )}

      {pendingDelete && (
        <ConfirmDelete
          message={pendingDelete.message}
          onCancel={() => setPendingDelete(null)}
          onConfirm={(remember) => {
            if (remember) setSkipDeleteConfirm(true);
            deleteIds(pendingDelete.ids);
            setPendingDelete(null);
          }}
        />
      )}
    </div>
  );
}
