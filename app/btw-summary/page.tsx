'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { describeStorageError, useLocalStorageState } from '@/lib/local-storage';
import { quarterMonths, useT } from '@/lib/i18n';
import { describeDeadline, getBtwDeadline, toLocalIsoDate } from '@/lib/tax';
import {
  StoredInvoice,
  formatCurrency,
  formatDate,
  getInvoiceDate,
  getInvoiceNetAmount,
  getQuarter,
  isUsableBookkeepingDate,
  sumEuros,
} from '@/lib/billing';

type Expense = {
  id: number;
  date: string;
  amountExVat: number;
  vatAmount: number;
};

type QuarterSummary = {
  key: string;
  year: number;
  quarter: number;
  revenueExVat: number;
  outputVat: number;
  expensesExVat: number;
  inputVat: number;
  netVat: number;
  invoiceCount: number;
  expenseCount: number;
};

type Bucket = {
  year: number;
  quarter: number;
  revenue: number[];
  outputVat: number[];
  expenses: number[];
  inputVat: number[];
  invoiceCount: number;
  expenseCount: number;
};

function createBucket(year: number, quarter: number): Bucket {
  return {
    year, quarter, revenue: [], outputVat: [], expenses: [], inputVat: [],
    invoiceCount: 0, expenseCount: 0,
  };
}

export default function BtwSummaryPage() {
  const [expenses] = useLocalStorageState<Expense[]>('expenses', []);
  const [invoices] = useLocalStorageState<StoredInvoice[]>('invoices', []);
  // Quarters already declared and paid to the Belastingdienst, keyed "2026-Q1".
  const [settledQuarters, setSettledQuarters] = useLocalStorageState<string[]>('btw-settled', []);
  const [selectedQuarter, setSelectedQuarter] = useState('all');
  const [error, setError] = useState('');
  const { t, language } = useT();

  const toggleSettled = (key: string) => {
    const next = settledQuarters.includes(key)
      ? settledQuarters.filter((item) => item !== key)
      : [...settledQuarters, key];

    try {
      setSettledQuarters(next);
      setError('');
    } catch (storageError) {
      setError(describeStorageError(storageError));
    }
  };

  const { summaries, undatedInvoices, undatedExpenses } = useMemo(() => {
    const buckets = new Map<string, Bucket>();
    let undatedInvoiceCount = 0;
    let undatedExpenseCount = 0;

    const bucketFor = (dateString: string) => {
      const date = new Date(dateString);
      const year = date.getFullYear();
      const quarter = getQuarter(dateString);
      const key = `${year}-Q${quarter}`;

      if (!buckets.has(key)) buckets.set(key, createBucket(year, quarter));
      return buckets.get(key)!;
    };

    for (const invoice of invoices) {
      const dateString = getInvoiceDate(invoice);
      if (!isUsableBookkeepingDate(dateString)) {
        undatedInvoiceCount += 1;
        continue;
      }
      const bucket = bucketFor(dateString);
      bucket.revenue.push(getInvoiceNetAmount(invoice));
      bucket.outputVat.push(invoice.vatAmount);
      bucket.invoiceCount += 1;
    }

    for (const expense of expenses) {
      if (!isUsableBookkeepingDate(expense.date)) {
        undatedExpenseCount += 1;
        continue;
      }
      const bucket = bucketFor(expense.date);
      bucket.expenses.push(expense.amountExVat);
      bucket.inputVat.push(expense.vatAmount);
      bucket.expenseCount += 1;
    }

    const result: QuarterSummary[] = Array.from(buckets.entries())
      .map(([key, bucket]) => {
        const outputVat = sumEuros(bucket.outputVat);
        const inputVat = sumEuros(bucket.inputVat);
        return {
          key, year: bucket.year, quarter: bucket.quarter,
          revenueExVat: sumEuros(bucket.revenue),
          outputVat, expensesExVat: sumEuros(bucket.expenses), inputVat,
          netVat: sumEuros([outputVat, -inputVat]),
          invoiceCount: bucket.invoiceCount, expenseCount: bucket.expenseCount,
        };
      })
      .sort((a, b) => (a.year !== b.year ? b.year - a.year : b.quarter - a.quarter));

    return { summaries: result, undatedInvoices: undatedInvoiceCount, undatedExpenses: undatedExpenseCount };
  }, [expenses, invoices]);

  const visibleSummaries = useMemo(() => {
    if (selectedQuarter === 'all') return summaries;
    return summaries.filter((summary) => summary.key === selectedQuarter);
  }, [selectedQuarter, summaries]);

  const totals = useMemo(() => {
    const outputVat = sumEuros(visibleSummaries.map((s) => s.outputVat));
    const inputVat = sumEuros(visibleSummaries.map((s) => s.inputVat));
    return {
      revenueExVat: sumEuros(visibleSummaries.map((s) => s.revenueExVat)),
      outputVat,
      expensesExVat: sumEuros(visibleSummaries.map((s) => s.expensesExVat)),
      inputVat,
      netVat: sumEuros([outputVat, -inputVat]),
    };
  }, [visibleSummaries]);

  // What is actually still owed: quarters not yet marked filed and paid.
  const outstandingVat = useMemo(() => {
    return sumEuros(
      visibleSummaries
        .filter((summary) => !settledQuarters.includes(summary.key))
        .map((summary) => summary.netVat)
    );
  }, [settledQuarters, visibleSummaries]);

  const netLabel = totals.netVat >= 0 ? t('vat.netToPay') : t('vat.netToReclaim');

  return (
    <main className="space-y-6">
      <Link href="/" className="inline-block rounded-full border border-white/10 px-4 py-2 text-sm hover:bg-white/10">
        {t('common.back')}
      </Link>

      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold">{t('vat.title')}</h1>
          <p className="mt-2 text-sm text-white/60">{t('vat.subtitle')}</p>
        </div>

        <label className="text-sm text-white/60">
          <span className="mb-2 block">{t('common.quarter')}</span>
          <select
            className="rounded-2xl border border-white/10 bg-white/5 p-3 text-white outline-none"
            value={selectedQuarter}
            onChange={(event) => setSelectedQuarter(event.target.value)}
          >
            <option value="all" className="text-black">{t('common.allQuarters')}</option>
            {summaries.map((summary) => (
              <option key={summary.key} value={summary.key} className="text-black">
                {summary.year} Q{summary.quarter} · {quarterMonths(summary.quarter, language)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-3xl border border-cyan-400/30 bg-cyan-400/10 p-6">
          <div className="text-sm uppercase tracking-[0.14em] text-cyan-200">{netLabel}</div>
          <div className="mt-2 text-4xl font-semibold">{formatCurrency(Math.abs(totals.netVat))}</div>
          <div className="mt-3 text-sm text-white/70">
            {formatCurrency(totals.outputVat)} {t('vat.chargedShort')} − {formatCurrency(totals.inputVat)} {t('vat.deductibleShort')}
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="text-sm uppercase tracking-[0.14em] text-white/45">{t('vat.stillToPay')}</div>
          <div className="mt-2 text-4xl font-semibold">{formatCurrency(Math.abs(outstandingVat))}</div>
          <div className="mt-3 text-sm text-white/60">{t('vat.stillToPayHint')}</div>
        </div>
      </div>

      {(undatedInvoices > 0 || undatedExpenses > 0) && (
        <div className="rounded-3xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-100">
          {t('vat.excluded')}{' '}
          {undatedInvoices > 0 && `${undatedInvoices} invoice(s)`}
          {undatedInvoices > 0 && undatedExpenses > 0 && ', '}
          {undatedExpenses > 0 && `${undatedExpenses} expense(s)`}. {t('vat.fixDates')}
        </div>
      )}

      {error && (
        <div className="rounded-3xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-200">{error}</div>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="text-sm text-white/50">{t('common.exVat')}</div>
          <div className="mt-2 text-2xl font-semibold">{formatCurrency(totals.revenueExVat)}</div>
        </div>
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="text-sm text-white/50">{t('vat.charged')}</div>
          <div className="mt-2 text-2xl font-semibold">{formatCurrency(totals.outputVat)}</div>
        </div>
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="text-sm text-white/50">{t('vat.expensesExVat')}</div>
          <div className="mt-2 text-2xl font-semibold">{formatCurrency(totals.expensesExVat)}</div>
        </div>
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="text-sm text-white/50">{t('vat.deductible')}</div>
          <div className="mt-2 text-2xl font-semibold">{formatCurrency(totals.inputVat)}</div>
        </div>
      </div>

      <div className="space-y-4">
        {visibleSummaries.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-white/70">{t('vat.noData')}</div>
        ) : (
          visibleSummaries.map((summary) => {
            const isSettled = settledQuarters.includes(summary.key);
            const deadline = getBtwDeadline(summary.year, summary.quarter);
            const deadlineInfo = describeDeadline(deadline);

            return (
              <div
                key={summary.key}
                className={`rounded-3xl border p-6 ${
                  isSettled ? 'border-emerald-400/25 bg-emerald-400/5' : 'border-white/10 bg-white/5'
                }`}
              >
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-semibold">
                      {summary.year} Q{summary.quarter}
                      <span className="ml-2 text-base font-normal text-white/55">
                        {quarterMonths(summary.quarter, language)}
                      </span>
                    </h2>
                    <div className="mt-1 text-sm text-white/50">
                      {summary.invoiceCount} invoice(s) · {summary.expenseCount} expense(s) ·{' '}
                      {t('vat.deadline')} {formatDate(toLocalIsoDate(deadline))}
                      {!isSettled && summary.netVat !== 0 && ` (${deadlineInfo.label})`}
                    </div>
                  </div>

                  <label className="flex cursor-pointer items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm hover:bg-white/10">
                    <input
                      type="checkbox"
                      checked={isSettled}
                      onChange={() => toggleSettled(summary.key)}
                    />
                    {isSettled ? t('common.settled') : t('vat.markSettled')}
                  </label>
                </div>

                <div className="grid gap-3 md:grid-cols-4">
                  <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
                    <div className="text-sm text-white/50">{t('common.exVat')}</div>
                    <div className="mt-2 text-xl font-semibold">{formatCurrency(summary.revenueExVat)}</div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
                    <div className="text-sm text-white/50">{t('vat.chargedShort')}</div>
                    <div className="mt-2 text-xl font-semibold">{formatCurrency(summary.outputVat)}</div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
                    <div className="text-sm text-white/50">{t('vat.expensesExVat')}</div>
                    <div className="mt-2 text-xl font-semibold">{formatCurrency(summary.expensesExVat)}</div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
                    <div className="text-sm text-white/50">{t('vat.deductibleShort')}</div>
                    <div className="mt-2 text-xl font-semibold">{formatCurrency(summary.inputVat)}</div>
                  </div>
                </div>

                <div className="mt-3 rounded-2xl border border-white/10 bg-black/25 p-4">
                  <div className="text-sm text-white/50">
                    {summary.netVat >= 0 ? t('vat.netToPay') : t('vat.netToReclaim')}
                    {isSettled && ` · ${t('common.settled')}`}
                  </div>
                  <div className={`mt-2 text-2xl font-semibold ${isSettled ? 'text-white/50 line-through' : ''}`}>
                    {formatCurrency(Math.abs(summary.netVat))}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <p className="text-xs text-white/40">{t('vat.disclaimer')}</p>
    </main>
  );
}
