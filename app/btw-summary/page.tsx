'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useLocalStorageState } from '@/lib/local-storage';
import {
  StoredInvoice,
  formatCurrency,
  getInvoiceDate,
  getInvoiceNetAmount,
  getQuarter,
  isUsableBookkeepingDate,
  sumEuros,
} from '@/lib/billing';

type Expense = {
  id: number;
  date: string;
  supplier: string;
  category: string;
  amountExVat: number;
  vatRate: number;
  vatAmount: number;
  totalAmount: number;
  receiptName: string;
  receiptDataUrl?: string;
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
    year,
    quarter,
    revenue: [],
    outputVat: [],
    expenses: [],
    inputVat: [],
    invoiceCount: 0,
    expenseCount: 0,
  };
}

function isValidDate(dateString: string) {
  return isUsableBookkeepingDate(dateString);
}

export default function BtwSummaryPage() {
  const [expenses] = useLocalStorageState<Expense[]>('expenses', []);
  const [invoices] = useLocalStorageState<StoredInvoice[]>('invoices', []);
  const [selectedQuarter, setSelectedQuarter] = useState('all');

  const { summaries, undatedInvoices, undatedExpenses } = useMemo(() => {
    const buckets = new Map<string, Bucket>();
    let undatedInvoiceCount = 0;
    let undatedExpenseCount = 0;

    const bucketFor = (dateString: string) => {
      const date = new Date(dateString);
      const year = date.getFullYear();
      const quarter = getQuarter(dateString);
      const key = `${year}-Q${quarter}`;

      if (!buckets.has(key)) {
        buckets.set(key, createBucket(year, quarter));
      }

      return buckets.get(key)!;
    };

    for (const invoice of invoices) {
      const dateString = getInvoiceDate(invoice);

      if (!isValidDate(dateString)) {
        undatedInvoiceCount += 1;
        continue;
      }

      const bucket = bucketFor(dateString);
      bucket.revenue.push(getInvoiceNetAmount(invoice));
      bucket.outputVat.push(invoice.vatAmount);
      bucket.invoiceCount += 1;
    }

    for (const expense of expenses) {
      if (!isValidDate(expense.date)) {
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
          key,
          year: bucket.year,
          quarter: bucket.quarter,
          revenueExVat: sumEuros(bucket.revenue),
          outputVat,
          expensesExVat: sumEuros(bucket.expenses),
          inputVat,
          netVat: sumEuros([outputVat, -inputVat]),
          invoiceCount: bucket.invoiceCount,
          expenseCount: bucket.expenseCount,
        };
      })
      .sort((a, b) => {
        if (a.year !== b.year) return b.year - a.year;
        return b.quarter - a.quarter;
      });

    return {
      summaries: result,
      undatedInvoices: undatedInvoiceCount,
      undatedExpenses: undatedExpenseCount,
    };
  }, [expenses, invoices]);

  const visibleSummaries = useMemo(() => {
    if (selectedQuarter === 'all') {
      return summaries;
    }

    return summaries.filter((summary) => summary.key === selectedQuarter);
  }, [selectedQuarter, summaries]);

  const totals = useMemo(() => {
    const outputVat = sumEuros(visibleSummaries.map((summary) => summary.outputVat));
    const inputVat = sumEuros(visibleSummaries.map((summary) => summary.inputVat));

    return {
      revenueExVat: sumEuros(visibleSummaries.map((summary) => summary.revenueExVat)),
      outputVat,
      expensesExVat: sumEuros(visibleSummaries.map((summary) => summary.expensesExVat)),
      inputVat,
      netVat: sumEuros([outputVat, -inputVat]),
    };
  }, [visibleSummaries]);

  const netLabel = totals.netVat >= 0 ? 'BTW to pay' : 'BTW to reclaim';

  return (
    <main className="space-y-6">
      <Link
        href="/"
        className="inline-block rounded-full border border-white/10 px-4 py-2 text-sm hover:bg-white/10"
      >
        ← Back
      </Link>

      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold">BTW Summary</h1>
          <p className="mt-2 text-sm text-white/60">
            VAT charged on invoices minus deductible VAT on expenses, per quarter.
          </p>
        </div>

        <label className="text-sm text-white/60">
          <span className="mb-2 block">Quarter</span>
          <select
            className="rounded-2xl border border-white/10 bg-white/5 p-3 text-white outline-none"
            value={selectedQuarter}
            onChange={(event) => setSelectedQuarter(event.target.value)}
          >
            <option value="all" className="text-black">
              All quarters
            </option>
            {summaries.map((summary) => (
              <option key={summary.key} value={summary.key} className="text-black">
                {summary.year} Q{summary.quarter}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="rounded-3xl border border-cyan-400/30 bg-cyan-400/10 p-6">
        <div className="text-sm uppercase tracking-[0.14em] text-cyan-200">{netLabel}</div>
        <div className="mt-2 text-4xl font-semibold">
          {formatCurrency(Math.abs(totals.netVat))}
        </div>
        <div className="mt-3 text-sm text-white/70">
          {formatCurrency(totals.outputVat)} charged on invoices −{' '}
          {formatCurrency(totals.inputVat)} deductible on expenses
          {selectedQuarter === 'all' ? ' (all quarters combined)' : ''}
        </div>
      </div>

      {selectedQuarter === 'all' && summaries.length > 1 && (
        <div className="rounded-3xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-100">
          You file BTW per quarter. Pick a single quarter above to get the figure for one
          return.
        </div>
      )}

      {(undatedInvoices > 0 || undatedExpenses > 0) && (
        <div className="rounded-3xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-100">
          Excluded from these totals because of a missing, invalid or implausible date
          (for example a mistyped year):{' '}
          {undatedInvoices > 0 && `${undatedInvoices} invoice(s)`}
          {undatedInvoices > 0 && undatedExpenses > 0 && ', '}
          {undatedExpenses > 0 && `${undatedExpenses} expense(s)`}. Fix the dates so they
          are counted.
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="text-sm text-white/50">Revenue ex VAT</div>
          <div className="mt-2 text-2xl font-semibold">
            {formatCurrency(totals.revenueExVat)}
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="text-sm text-white/50">VAT charged (output)</div>
          <div className="mt-2 text-2xl font-semibold">{formatCurrency(totals.outputVat)}</div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="text-sm text-white/50">Expenses ex VAT</div>
          <div className="mt-2 text-2xl font-semibold">
            {formatCurrency(totals.expensesExVat)}
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="text-sm text-white/50">VAT deductible (input)</div>
          <div className="mt-2 text-2xl font-semibold">{formatCurrency(totals.inputVat)}</div>
        </div>
      </div>

      <div className="space-y-4">
        {visibleSummaries.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-white/70">
            No invoices or expenses yet.
          </div>
        ) : (
          visibleSummaries.map((summary) => (
            <div
              key={summary.key}
              className="rounded-3xl border border-white/10 bg-white/5 p-6"
            >
              <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-xl font-semibold">
                  {summary.year} Q{summary.quarter}
                </h2>
                <div className="text-sm text-white/50">
                  {summary.invoiceCount} invoice(s) · {summary.expenseCount} expense(s)
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-4">
                <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
                  <div className="text-sm text-white/50">Revenue ex VAT</div>
                  <div className="mt-2 text-xl font-semibold">
                    {formatCurrency(summary.revenueExVat)}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
                  <div className="text-sm text-white/50">VAT charged</div>
                  <div className="mt-2 text-xl font-semibold">
                    {formatCurrency(summary.outputVat)}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
                  <div className="text-sm text-white/50">Expenses ex VAT</div>
                  <div className="mt-2 text-xl font-semibold">
                    {formatCurrency(summary.expensesExVat)}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
                  <div className="text-sm text-white/50">VAT deductible</div>
                  <div className="mt-2 text-xl font-semibold">
                    {formatCurrency(summary.inputVat)}
                  </div>
                </div>
              </div>

              <div className="mt-3 rounded-2xl border border-white/10 bg-black/25 p-4">
                <div className="text-sm text-white/50">
                  {summary.netVat >= 0 ? 'BTW to pay' : 'BTW to reclaim'}
                </div>
                <div className="mt-2 text-2xl font-semibold">
                  {formatCurrency(Math.abs(summary.netVat))}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <p className="text-xs text-white/40">
        Figures are based on invoice and expense dates as entered. Reverse-charge, KOR and
        intra-EU supplies are not modelled — check those cases against your own situation
        before filing.
      </p>
    </main>
  );
}
