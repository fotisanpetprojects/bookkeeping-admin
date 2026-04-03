'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useLocalStorageState } from '@/lib/local-storage';

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
  expensesExVat: number;
  deductibleVat: number;
  totalInclVat: number;
};

function getQuarter(dateString: string) {
  const month = new Date(dateString).getMonth() + 1;
  if (month <= 3) return 1;
  if (month <= 6) return 2;
  if (month <= 9) return 3;
  return 4;
}

export default function BtwSummaryPage() {
  const [expenses] = useLocalStorageState<Expense[]>('expenses', []);

  const summaries = useMemo(() => {
    const map = new Map<string, QuarterSummary>();

    for (const expense of expenses) {
      const date = new Date(expense.date);
      const year = date.getFullYear();
      const quarter = getQuarter(expense.date);
      const key = `${year}-Q${quarter}`;

      if (!map.has(key)) {
        map.set(key, {
          key,
          year,
          quarter,
          expensesExVat: 0,
          deductibleVat: 0,
          totalInclVat: 0,
        });
      }

      const item = map.get(key)!;
      item.expensesExVat += Number(expense.amountExVat) || 0;
      item.deductibleVat += Number(expense.vatAmount) || 0;
      item.totalInclVat += Number(expense.totalAmount) || 0;
    }

    return Array.from(map.values()).sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      return b.quarter - a.quarter;
    });
  }, [expenses]);

  const totalDeductibleVat = useMemo(() => {
    return expenses.reduce((sum, expense) => sum + (Number(expense.vatAmount) || 0), 0);
  }, [expenses]);

  const totalExpensesExVat = useMemo(() => {
    return expenses.reduce((sum, expense) => sum + (Number(expense.amountExVat) || 0), 0);
  }, [expenses]);

  const totalExpensesInclVat = useMemo(() => {
    return expenses.reduce((sum, expense) => sum + (Number(expense.totalAmount) || 0), 0);
  }, [expenses]);

  return (
    <main className="space-y-6">
      <Link
        href="/"
        className="inline-block rounded-full border border-white/10 px-4 py-2 text-sm hover:bg-white/10"
      >
        ← Back
      </Link>

      <div>
        <h1 className="text-3xl font-semibold">BTW Summary</h1>
        <p className="mt-2 text-sm text-white/60">
          Quarterly overview of expense totals and deductible VAT.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="text-sm text-white/50">Total deductible VAT</div>
          <div className="mt-2 text-3xl font-semibold">
            €{totalDeductibleVat.toFixed(2)}
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="text-sm text-white/50">Expenses ex VAT</div>
          <div className="mt-2 text-3xl font-semibold">
            €{totalExpensesExVat.toFixed(2)}
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="text-sm text-white/50">Expenses incl VAT</div>
          <div className="mt-2 text-3xl font-semibold">
            €{totalExpensesInclVat.toFixed(2)}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {summaries.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-white/70">
            No expenses yet.
          </div>
        ) : (
          summaries.map((summary) => (
            <div
              key={summary.key}
              className="rounded-3xl border border-white/10 bg-white/5 p-6"
            >
              <h2 className="mb-4 text-xl font-semibold">
                {summary.year} Q{summary.quarter}
              </h2>

              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
                  <div className="text-sm text-white/50">Expenses ex VAT</div>
                  <div className="mt-2 text-xl font-semibold">
                    €{summary.expensesExVat.toFixed(2)}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
                  <div className="text-sm text-white/50">Deductible VAT</div>
                  <div className="mt-2 text-xl font-semibold">
                    €{summary.deductibleVat.toFixed(2)}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
                  <div className="text-sm text-white/50">Total incl VAT</div>
                  <div className="mt-2 text-xl font-semibold">
                    €{summary.totalInclVat.toFixed(2)}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </main>
  );
}
