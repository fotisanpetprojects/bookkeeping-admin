'use client';

import { ChangeEvent, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { describeStorageError, useLocalStorageState } from '@/lib/local-storage';
import { formatCurrency, roundCents } from '@/lib/billing';

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

/**
 * Receipts live as base64 inside localStorage, which is capped at roughly 5MB
 * for the whole origin. Keeping single files small is what stops one phone photo
 * from filling the quota and blocking every later save.
 */
const MAX_RECEIPT_BYTES = 1_000_000;

function getTodayString() {
  return new Date().toISOString().split('T')[0];
}

function getMinDateString() {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 1);
  return d.toISOString().split('T')[0];
}

function formatBytes(bytes: number) {
  return `${(bytes / 1_000_000).toFixed(1)}MB`;
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
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    return roundCents(exVat * (effectiveVatRate / 100));
  }, [amountExVat, effectiveVatRate]);

  const calculatedTotal = useMemo(() => {
    const exVat = Number(amountExVat) || 0;
    return roundCents(exVat + calculatedVatAmount);
  }, [amountExVat, calculatedVatAmount]);

  const resetForm = () => {
    setDate('');
    setSupplier('');
    setCategory('');
    setAmountExVat('');
    setVatSelection('21');
    setCustomVatRate('');
    setReceiptName('');
    setReceiptDataUrl('');
    setEditingId(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleReceiptUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError('');

    if (file.size > MAX_RECEIPT_BYTES) {
      setError(
        `That receipt is ${formatBytes(file.size)}. Browser storage only holds about 5MB in total, so please attach a file under ${formatBytes(
          MAX_RECEIPT_BYTES
        )} — a scanned PDF or a resized photo works well.`
      );
      e.target.value = '';
      return;
    }

    setReceiptName(file.name);

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setReceiptDataUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const persist = (nextExpenses: Expense[], successMessage: string) => {
    try {
      setExpenses(nextExpenses);
      setError('');
      setNotice(successMessage);
      return true;
    } catch (storageError) {
      setNotice('');
      setError(describeStorageError(storageError));
      return false;
    }
  };

  const startEditing = (expense: Expense) => {
    const matchingVatOption = VAT_OPTIONS.find((option) => {
      return option.value !== 'custom' && Number(option.value) === expense.vatRate;
    });

    setEditingId(expense.id);
    setDate(expense.date);
    setSupplier(expense.supplier);
    setCategory(expense.category);
    setAmountExVat(String(expense.amountExVat));
    setVatSelection(matchingVatOption ? matchingVatOption.value : 'custom');
    setCustomVatRate(matchingVatOption ? '' : String(expense.vatRate));
    setReceiptName(expense.receiptName || '');
    setReceiptDataUrl(expense.receiptDataUrl || '');
    setError('');
    setNotice('');

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const deleteExpense = (expense: Expense) => {
    const confirmed = window.confirm(
      `Delete the ${formatCurrency(expense.totalAmount)} expense from ${
        expense.supplier
      } on ${expense.date}? This cannot be undone.`
    );

    if (!confirmed) {
      return;
    }

    const removed = persist(
      expenses.filter((item) => item.id !== expense.id),
      `Deleted the expense from ${expense.supplier}.`
    );

    if (removed && editingId === expense.id) {
      resetForm();
    }
  };

  const saveExpense = () => {
    setError('');
    setNotice('');

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

    const vatAmount = roundCents(exVat * (effectiveVatRate / 100));
    const fields = {
      date,
      supplier: supplier.trim(),
      category: category.trim(),
      amountExVat: roundCents(exVat),
      vatRate: effectiveVatRate,
      vatAmount,
      totalAmount: roundCents(exVat + vatAmount),
      receiptName,
      receiptDataUrl,
    };

    if (editingId !== null) {
      const updated = expenses.map((expense) => {
        return expense.id === editingId ? { ...expense, ...fields } : expense;
      });

      if (persist(updated, `Updated the expense from ${fields.supplier}.`)) {
        resetForm();
      }

      return;
    }

    const newExpense: Expense = { id: Date.now(), ...fields };

    if (persist([...expenses, newExpense], `Saved the expense from ${fields.supplier}.`)) {
      resetForm();
    }
  };

  const sortedExpenses = useMemo(() => {
    return [...expenses].sort((a, b) => b.date.localeCompare(a.date));
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
        <h1 className="text-3xl font-semibold">Expenses</h1>
        <p className="mt-2 text-sm text-white/60">
          Allowed date range: {minDate} to {today}
        </p>
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
        {editingId !== null && (
          <div className="mb-4 rounded-2xl border border-cyan-400/30 bg-cyan-400/10 p-3 text-sm text-cyan-100">
            Editing an existing expense. Saving overwrites it.
          </div>
        )}

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
            ref={fileInputRef}
            className="rounded-2xl border border-white/10 bg-white/5 p-3 text-white file:mr-4 file:rounded-full file:border-0 file:bg-cyan-400 file:px-4 file:py-2 file:text-sm file:font-medium file:text-black"
            type="file"
            accept=".pdf,image/*"
            onChange={handleReceiptUpload}
          />

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/80">
            <div>VAT rate: {effectiveVatRate}%</div>
            <div>VAT amount: {formatCurrency(calculatedVatAmount)}</div>
            <div>Total: {formatCurrency(calculatedTotal)}</div>
            <div>Receipt: {receiptName || '-'}</div>
          </div>

          {error && (
            <div className="rounded-2xl border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-200">
              {error}
            </div>
          )}

          {notice && !error && (
            <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-3 text-sm text-emerald-200">
              {notice}
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <button
              onClick={saveExpense}
              className="rounded-2xl bg-cyan-400 px-4 py-3 font-medium text-black hover:opacity-90"
            >
              {editingId !== null ? 'Save changes' : 'Add Expense'}
            </button>

            {editingId !== null && (
              <button
                onClick={resetForm}
                className="rounded-2xl border border-white/10 px-4 py-3 font-medium hover:bg-white/10"
              >
                Cancel edit
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {sortedExpenses.map((expense) => (
          <div
            key={expense.id}
            className="rounded-3xl border border-white/10 bg-white/5 p-6"
          >
            <div className="mb-2 text-lg font-semibold">{expense.supplier}</div>
            <div className="text-sm text-white/60">{expense.date}</div>
            <div className="mt-3 space-y-1 text-sm text-white/80">
              <div>Category: {expense.category || '-'}</div>
              <div>Ex VAT: {formatCurrency(expense.amountExVat)}</div>
              <div>VAT rate: {expense.vatRate}%</div>
              <div>VAT: {formatCurrency(expense.vatAmount)}</div>
              <div>Total: {formatCurrency(expense.totalAmount)}</div>
              <div>Receipt: {expense.receiptName || '-'}</div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                onClick={() => startEditing(expense)}
                className="rounded-full border border-white/10 px-4 py-2 text-sm hover:bg-white/10"
              >
                Edit
              </button>

              <button
                onClick={() => deleteExpense(expense)}
                className="rounded-full border border-red-400/30 px-4 py-2 text-sm text-red-200 hover:bg-red-400/10"
              >
                Delete
              </button>

              {expense.receiptDataUrl && (
                <a
                  href={expense.receiptDataUrl}
                  download={expense.receiptName || 'receipt'}
                  className="text-sm text-cyan-300 underline"
                >
                  Download receipt
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
