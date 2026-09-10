'use client';

import { ChangeEvent, useMemo, useRef, useState } from 'react';
import { describeStorageError, useLocalStorageState } from '@/lib/local-storage';
import { StringKey, useT } from '@/lib/i18n';
import { formatCurrency } from '@/lib/billing';
import { BankTransaction, mergeTransactions, parseBankCsv } from '@/lib/bank';
import { CATEGORIES, CATEGORY_IDS, CategoryId } from '@/lib/categories';

const FIXED_CATEGORIES = new Set(
  CATEGORIES.filter((category) => category.fixed).map((category) => category.id)
);
import {
  ACCOUNT_LABELS_KEY,
  AccountKind,
  AccountLabel,
  accountColour,
  displayAccount,
  internalAccounts,
  kindOf,
  labelFor,
  transactionsForKind,
} from '@/lib/accounts';
import { normaliseAccount } from '@/lib/bank';
import AccountStrip from '@/app/components/AccountStrip';
import ReconcilePanel from '@/app/components/ReconcilePanel';
import { useConfirm } from '@/app/components/Confirm';
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
import { isSpending } from '@/lib/finance';

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Enough to work through in one sitting; the rest is behind the arrow. */
const SHOWN_UNKNOWNS = 8;

function Stat({ label, value, sub, tone, onOpen, info, dot }: {
  label: string;
  value: string;
  sub?: string;
  tone?: 'good' | 'bad';
  onOpen?: () => void;
  /** What this figure counts, and what it deliberately leaves out. */
  info?: string;
  /** Ties a tile to its account, using the same colour as the strip above. */
  dot?: string;
}) {
  const color = tone === 'good' ? 'var(--good)' : tone === 'bad' ? 'var(--bad)' : 'var(--ink)';

  const body = (
    <>
      <div className="flex items-center gap-2 text-sm muted">
        {dot && (
          <span
            className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ background: dot }}
            aria-hidden
          />
        )}
        <span className="truncate">{label}</span>
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
  const confirm = useConfirm();
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
  const marked = useMemo(
    () => markInternalTransfers(transactions, internalAccounts(labels, accounts)),
    [transactions, labels, accounts]
  );

  const scoped = useMemo(() => {
    if (account === 'all') return marked;
    if (account === 'personal' || account === 'business') {
      return transactionsForKind(marked, labels, account);
    }

    return marked.filter((t) => normaliseAccount(t.account) === normaliseAccount(account));
  }, [marked, account, labels]);

  const summary = useMemo(() => summarise(scoped, activeYear), [scoped, activeYear]);

  /**
   * Spending per account, largest first. This is the split people actually want
   * when more than one statement is loaded: a combined figure adds a business
   * account's costs to a personal one's and answers neither question.
   */
  const perAccount = useMemo(() => {
    const totals = new Map<string, number>();

    for (const transaction of scoped) {
      if (!isSpending(transaction)) continue;
      if (!transaction.date.startsWith(String(activeYear))) continue;

      const key = normaliseAccount(transaction.account);
      if (!key) continue;

      totals.set(key, (totals.get(key) ?? 0) + Math.abs(transaction.amount));
    }

    return [...totals.entries()]
      .map(([account, spending]) => ({ account, spending, kind: kindOf(labels, account) }))
      .sort((a, b) => b.spending - a.spending);
  }, [scoped, activeYear, labels]);
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

      if (!save(merged)) return;
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
      setError(importError instanceof Error ? importError.message : t('msg.fileUnreadable'));
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  /**
   * Every write here goes through one place, so a storage failure is reported the
   * same way wherever it happens. A thousand transactions is a lot to hold in a
   * browser, and a save that quietly fails is worse than one that refuses.
   */
  const save = (next: BankTransaction[]) => {
    try {
      setTransactions(next);
      setError('');
      return true;
    } catch (storageError) {
      setNotice('');
      setError(describeStorageError(storageError));
      return false;
    }
  };

  /** Applies a category to every transaction from one merchant, and remembers it. */
  const assignMerchant = (key: string, category: CategoryId) => {
    save(
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

    if (
      save(
        transactions.map((transaction) =>
          picked.has(merchantKey(transaction.description)) && transaction.category === 'unknown'
            ? { ...transaction, category: bulkCategory, manualCategory: true }
            : transaction
        )
      )
    ) {
      setPicked(new Set());
      setBulkCategory('');
    }
  };

  /** One place to change anything about an account, so the two controls stay in step. */
  const updateAccount = (account: string, patch: Partial<AccountLabel>) => {
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

  const setInternalOnly = (account: string, internalOnly: boolean) =>
    updateAccount(account, { internalOnly });

  const setAccountKind = (account: string, kind: AccountKind) => updateAccount(account, { kind });

  const deleteIds = (ids: string[]) => {
    const doomed = new Set(ids);
    if (save(transactions.filter((transaction) => !doomed.has(transaction.id)))) {
      setPicked(new Set());
    }
  };

  /** Confirms once, unless the user has said not to ask again. */
  const requestDelete = async (ids: string[], message: string) => {
    if (skipDeleteConfirm) {
      deleteIds(ids);
      return;
    }

    const { confirmed, remember } = await confirm({
      message,
      confirmLabel: t('fin.delete'),
      danger: true,
      offerRemember: true,
    });

    if (!confirmed) return;
    if (remember) setSkipDeleteConfirm(true);
    deleteIds(ids);
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
          {/*
            Rows imported before account numbers were recorded cannot be told apart,
            and transfers between them cannot be spotted. Without saying so the page
            just shows one combined figure and looks wrong for no visible reason.
          */}
          {accounts.length === 0 && (
            <section className="panel p-4 text-sm text-[var(--warn)]">
              {t('fin.noAccountNumbers')}
            </section>
          )}

          <AccountStrip
            transactions={marked}
            labels={labels}
            onToggleInternal={setInternalOnly}
            onChangeKind={setAccountKind}
            year={activeYear}
          />

          <ReconcilePanel
            transactions={scoped}
            labels={labels}
            accounts={accounts}
            year={activeYear}
            spending={summary.spending}
            monthsWithData={summary.monthsWithData}
          />

          <section
            className={
              perAccount.length > 1
                ? 'grid gap-4 md:grid-cols-2 xl:grid-cols-3'
                : 'grid gap-4 md:grid-cols-3'
            }
          >
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

            {/*
              With more than one account the useful split is per account, not fixed
              versus flexible: business costs and personal ones answer different
              questions and adding them together answers neither. Fixed and flexible
              are still readable from the colours in the breakdown below.
            */}
            {perAccount.length > 1
              ? perAccount.map((entry) => (
                  <Stat
                    key={entry.account}
                    label={displayAccount(labels, entry.account)}
                    info={t('info.perAccount', {
                      kind: t(entry.kind === 'business' ? 'acc.business' : 'acc.personal'),
                    })}
                    dot={accountColour(accounts, entry.account)}
                    value={formatCurrency(entry.spending)}
                    sub={t('fin.perMonth', {
                      amount: formatCurrency(
                        summary.monthsWithData ? entry.spending / summary.monthsWithData : 0
                      ),
                    })}
                    onOpen={() =>
                      setDrawer({
                        title: displayAccount(labels, entry.account),
                        subtitle: String(activeYear),
                        filter: (transaction) =>
                          isSpending(transaction) &&
                          transaction.date.startsWith(String(activeYear)) &&
                          normaliseAccount(transaction.account) === entry.account,
                      })
                    }
                  />
                ))
              : (
                <>
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
                </>
              )}
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

            </div>
          </section>

          <section className="card p-6">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              {t('fin.tidy')}
              <InfoMark text={t('info.tidy')} />
            </h2>

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
    </div>
  );
}
