'use client';

import { ChangeEvent, useMemo, useRef, useState } from 'react';
import { describeStorageError, useLocalStorageState } from '@/lib/local-storage';
import { useT } from '@/lib/i18n';
import {
  formatCurrency,
  getBackfillMinDateString,
  isUsableBookkeepingDate,
  roundCents,
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
  // Previous bookkeeping years must be enterable, not just the last 12 months.
  return getBackfillMinDateString();
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
  const [yearFilter, setYearFilter] = useState('all');
  const { t } = useT();
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

  const years = useMemo(() => {
    const found = new Set<number>();

    for (const expense of expenses) {
      if (isUsableBookkeepingDate(expense.date)) {
        found.add(new Date(expense.date).getFullYear());
      }
    }

    return Array.from(found).sort((a, b) => b - a);
  }, [expenses]);

  const sortedExpenses = useMemo(() => {
    const filtered =
      yearFilter === 'all'
        ? expenses
        : expenses.filter(
            (expense) =>
              isUsableBookkeepingDate(expense.date) &&
              String(new Date(expense.date).getFullYear()) === yearFilter
          );

    return [...filtered].sort((a, b) => b.date.localeCompare(a.date));
  }, [expenses, yearFilter]);

  const shownTotals = useMemo(() => {
    return {
      exVat: sumEuros(sortedExpenses.map((expense) => expense.amountExVat)),
      vat: sumEuros(sortedExpenses.map((expense) => expense.vatAmount)),
      total: sumEuros(sortedExpenses.map((expense) => expense.totalAmount)),
    };
  }, [sortedExpenses]);

  const undatedCount = expenses.filter(
    (expense) => !isUsableBookkeepingDate(expense.date)
  ).length;

  return (
    <main className="space-y-6">

      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold">{t('exp.title')}</h1>
          <p className="mt-2 text-sm muted">
            {t('exp.dateRange', { min: minDate, max: today })}
          </p>
        </div>

        {years.length > 0 && (
          <label className="text-sm muted">
            <span className="mb-2 block">{t('common.year')}</span>
            <select
              className="field"
              value={yearFilter}
              onChange={(event) => setYearFilter(event.target.value)}
            >
              <option value="all" style={{ color: "var(--ink)", background: "var(--surface)" }}>
                {t('common.allYears')}
              </option>
              {years.map((year) => (
                <option key={year} value={String(year)} style={{ color: "var(--ink)", background: "var(--surface)" }}>
                  {year}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {expenses.length > 0 && (
        <div className="grid gap-4 md:grid-cols-3">
          <div className="card p-5">
            <div className="text-sm faint">{t('exp.exVat')}</div>
            <div className="mt-2 text-2xl font-semibold">{formatCurrency(shownTotals.exVat)}</div>
          </div>
          <div className="card p-5">
            <div className="text-sm faint">{t('exp.deductibleVat')}</div>
            <div className="mt-2 text-2xl font-semibold">{formatCurrency(shownTotals.vat)}</div>
          </div>
          <div className="card p-5">
            <div className="text-sm faint">{t('exp.inclVat')}</div>
            <div className="mt-2 text-2xl font-semibold">{formatCurrency(shownTotals.total)}</div>
          </div>
        </div>
      )}

      {undatedCount > 0 && (
        <div className="card p-4 text-sm text-[var(--bad)]">
          {undatedCount} expense(s) have a missing, invalid or implausible date and are
          left out of the year filter and totals. Edit them to fix the date.
        </div>
      )}

      <div className="card p-6">
        {editingId !== null && (
          <div className="mb-4 panel p-3 text-sm text-[var(--accent)]">
            {t('exp.editingNotice')}
          </div>
        )}

        <div className="grid max-w-xl gap-3">
          <input
            className="field"
            type="date"
            min={minDate}
            max={today}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />

          <input
            className="field"
            placeholder={t('exp.supplier')}
            value={supplier}
            onChange={(e) => setSupplier(e.target.value)}
          />

          <input
            className="field"
            placeholder={t('exp.category')}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          />

          <input
            className="field"
            type="number"
            step="0.01"
            min="0"
            placeholder={t('exp.amountExVat')}
            value={amountExVat}
            onChange={(e) => setAmountExVat(e.target.value)}
          />

          <select
            className="field"
            value={vatSelection}
            onChange={(e) => setVatSelection(e.target.value)}
          >
            {VAT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value} style={{ color: "var(--ink)", background: "var(--surface)" }}>
                VAT {option.label}
              </option>
            ))}
          </select>

          {vatSelection === 'custom' && (
            <input
              className="field"
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
            className="field file:mr-3 file:rounded-[7px] file:border-0 file:bg-[var(--accent)] file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-[var(--accent-ink)]"
            type="file"
            accept=".pdf,image/*"
            onChange={handleReceiptUpload}
          />

          <div className="panel p-4 text-sm muted">
            <div>VAT rate: {effectiveVatRate}%</div>
            <div>VAT amount: {formatCurrency(calculatedVatAmount)}</div>
            <div>Total: {formatCurrency(calculatedTotal)}</div>
            <div>Receipt: {receiptName || '-'}</div>
          </div>

          {error && (
            <div className="panel p-3 text-sm text-[var(--bad)]">
              {error}
            </div>
          )}

          {notice && !error && (
            <div className="panel p-3 text-sm text-[var(--good)]">
              {notice}
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <button
              onClick={saveExpense}
              className="btn btn-primary"
            >
              {editingId !== null ? t('exp.saveChanges') : t('exp.addExpense')}
            </button>

            {editingId !== null && (
              <button
                onClick={resetForm}
                className="btn"
              >
                {t('exp.cancelEdit')}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {sortedExpenses.length === 0 && expenses.length > 0 && (
          <div className="card p-6 muted">
            No expenses in {yearFilter}.
          </div>
        )}

        {sortedExpenses.map((expense) => (
          <div
            key={expense.id}
            className="card p-6"
          >
            <div className="mb-2 text-lg font-semibold">{expense.supplier}</div>
            <div className="text-sm muted">{expense.date}</div>
            <div className="mt-3 space-y-1 text-sm muted">
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
                className="btn"
              >
                Edit
              </button>

              <button
                onClick={() => deleteExpense(expense)}
                className="btn btn-danger"
              >
                Delete
              </button>

              {expense.receiptDataUrl && (
                <a
                  href={expense.receiptDataUrl}
                  download={expense.receiptName || 'receipt'}
                  className="text-sm text-[var(--accent)] underline"
                >
                  {t('exp.downloadReceipt')}
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
