'use client';

import { ChangeEvent, useMemo, useState } from 'react';
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

const VAT_OPTIONS = [
  { label: '21%', value: '21' },
  { label: '9%', value: '9' },
  { label: '0%', value: '0' },
  { label: 'Custom', value: 'custom' },
];

function getTodayString() {
  return new Date().toISOString().split('T')[0];
}

function getMinDateString() {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 1);
  return d.toISOString().split('T')[0];
}

export default function ExpensesPage() {
  const [expenses, setExpenses] = useLocalStorageState<Expense[]>('expenses', []);
  const [date, setDate] = useState('');
  const [supplier, setSupplier] = useState('');
  const [category, setCategory] = useState('');
  const [amountExVat, setAmountExVat] = useState('');
  const [vatSelection, setVatSelection] = useState('21');
  const [customVatRate, setCustomVatRate] = useState('');
  const [receiptName, setReceiptName] = useState('');
  const [receiptDataUrl, setReceiptDataUrl] = useState('');
  const [error, setError] = useState('');

  const today = getTodayString();
  const minDate = getMinDateString();

  const effectiveVatRate = useMemo(() => {
    if (vatSelection === 'custom') {
      return Number(customVatRate) || 0;
    }
    return Number(vatSelection);
  }, [vatSelection, customVatRate]);

  const calculatedVatAmount = useMemo(() => {
    const exVat = Number(amountExVat) || 0;
    return exVat * (effectiveVatRate / 100);
  }, [amountExVat, effectiveVatRate]);

  const calculatedTotal = useMemo(() => {
    const exVat = Number(amountExVat) || 0;
    return exVat + calculatedVatAmount;
  }, [amountExVat, calculatedVatAmount]);

  const handleReceiptUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setReceiptName(file.name);

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setReceiptDataUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const addExpense = () => {
    setError('');

    if (!date || !supplier.trim() || !amountExVat) {
      setError('Please fill in date, supplier and amount.');
      return;
    }

    if (date < minDate || date > today) {
      setError('Date must be within the last 1 year and not in the future.');
      return;
    }

    const exVat = Number(amountExVat);

    if (Number.isNaN(exVat) || exVat < 0) {
      setError('Amount ex VAT must be a valid number.');
      return;
    }

    if (
      vatSelection === 'custom' &&
      (customVatRate === '' || Number(customVatRate) < 0)
    ) {
      setError('Please enter a valid custom VAT %.');
      return;
    }

    const vatAmount = exVat * (effectiveVatRate / 100);

    const newExpense: Expense = {
      id: Date.now(),
      date,
      supplier: supplier.trim(),
      category: category.trim(),
      amountExVat: exVat,
      vatRate: effectiveVatRate,
      vatAmount,
      totalAmount: exVat + vatAmount,
      receiptName,
      receiptDataUrl,
    };

    const updatedExpenses = [...expenses, newExpense];
    setExpenses(updatedExpenses);

    setDate('');
    setSupplier('');
    setCategory('');
    setAmountExVat('');
    setVatSelection('21');
    setCustomVatRate('');
    setReceiptName('');
    setReceiptDataUrl('');
  };

  return (
    <main className="space-y-6">
      <Link
        href="/"
        className="inline-block rounded-full border border-white/10 px-4 py-2 text-sm hover:bg-white/10"
      >
        ← Back
      </Link>

      <div>
        <h1 className="text-3xl font-semibold">Expenses</h1>
        <p className="mt-2 text-sm text-white/60">
          Allowed date range: {minDate} to {today}
        </p>
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <div className="grid max-w-xl gap-3">
          <input
            className="rounded-2xl border border-white/10 bg-white/5 p-3 text-white placeholder-white/40 outline-none"
            type="date"
            min={minDate}
            max={today}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />

          <input
            className="rounded-2xl border border-white/10 bg-white/5 p-3 text-white placeholder-white/40 outline-none"
            placeholder="Supplier"
            value={supplier}
            onChange={(e) => setSupplier(e.target.value)}
          />

          <input
            className="rounded-2xl border border-white/10 bg-white/5 p-3 text-white placeholder-white/40 outline-none"
            placeholder="Category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          />

          <input
            className="rounded-2xl border border-white/10 bg-white/5 p-3 text-white placeholder-white/40 outline-none"
            type="number"
            step="0.01"
            min="0"
            placeholder="Amount ex VAT"
            value={amountExVat}
            onChange={(e) => setAmountExVat(e.target.value)}
          />

          <select
            className="rounded-2xl border border-white/10 bg-white/5 p-3 text-white outline-none"
            value={vatSelection}
            onChange={(e) => setVatSelection(e.target.value)}
          >
            {VAT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value} className="text-black">
                VAT {option.label}
              </option>
            ))}
          </select>

          {vatSelection === 'custom' && (
            <input
              className="rounded-2xl border border-white/10 bg-white/5 p-3 text-white placeholder-white/40 outline-none"
              type="number"
              step="0.01"
              min="0"
              placeholder="Custom VAT %"
              value={customVatRate}
              onChange={(e) => setCustomVatRate(e.target.value)}
            />
          )}

          <input
            className="rounded-2xl border border-white/10 bg-white/5 p-3 text-white file:mr-4 file:rounded-full file:border-0 file:bg-cyan-400 file:px-4 file:py-2 file:text-sm file:font-medium file:text-black"
            type="file"
            accept=".pdf,image/*"
            onChange={handleReceiptUpload}
          />

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/80">
            <div>VAT rate: {effectiveVatRate}%</div>
            <div>VAT amount: €{calculatedVatAmount.toFixed(2)}</div>
            <div>Total: €{calculatedTotal.toFixed(2)}</div>
            <div>Receipt: {receiptName || '-'}</div>
          </div>

          {error && (
            <div className="rounded-2xl border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-200">
              {error}
            </div>
          )}

          <button
            onClick={addExpense}
            className="rounded-2xl bg-cyan-400 px-4 py-3 font-medium text-black hover:opacity-90"
          >
            Add Expense
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {expenses.map((expense) => (
          <div
            key={expense.id}
            className="rounded-3xl border border-white/10 bg-white/5 p-6"
          >
            <div className="mb-2 text-lg font-semibold">{expense.supplier}</div>
            <div className="text-sm text-white/60">{expense.date}</div>
            <div className="mt-3 space-y-1 text-sm text-white/80">
              <div>Category: {expense.category || '-'}</div>
              <div>Ex VAT: €{expense.amountExVat.toFixed(2)}</div>
              <div>VAT rate: {expense.vatRate}%</div>
              <div>VAT: €{expense.vatAmount.toFixed(2)}</div>
              <div>Total: €{expense.totalAmount.toFixed(2)}</div>
              <div>Receipt: {expense.receiptName || '-'}</div>
            </div>

            {expense.receiptDataUrl && (
              <a
                href={expense.receiptDataUrl}
                download={expense.receiptName || 'receipt'}
                className="mt-4 inline-block text-cyan-300 underline"
              >
                Download receipt
              </a>
            )}
          </div>
        ))}
      </div>
    </main>
  );
}
