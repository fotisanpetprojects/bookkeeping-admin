'use client';

import { useMemo, useState } from 'react';
import { useT } from '@/lib/i18n';
import {
  StoredInvoice,
  formatCurrency,
  formatDate,
  getInvoiceClientName,
  getInvoiceDate,
  getInvoiceNetAmount,
  isInvoiceOverdue,
  isInvoicePaid,
  isInvoiceRecord,
  sumEuros,
} from '@/lib/billing';

type SortKey = 'invoiceNumber' | 'date' | 'client' | 'net' | 'vat' | 'total' | 'status';
type Direction = 'asc' | 'desc';

function Icon({ name }: { name: 'load' | 'print' | 'edit' | 'delete' }) {
  const paths: Record<string, string> = {
    load: 'M4 8l6 5 6-5M10 13V3',
    print: 'M6 7V3h8v4M6 14H4V8h12v6h-2M6 12h8v5H6z',
    edit: 'M3 15.5V17h1.5l8-8L11 7.5l-8 8zM13 6l1-1 1.5 1.5-1 1L13 6z',
    delete: 'M4 6h12M8 6V4h4v2M6 6l1 10h6l1-10',
  };

  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden focusable="false">
      <path d={paths[name]} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function InvoiceTable({
  invoices,
  onLoad,
  onPrint,
  onEdit,
  onDelete,
  onTogglePaid,
}: {
  invoices: StoredInvoice[];
  onLoad: (invoice: StoredInvoice) => void;
  onPrint: (invoice: StoredInvoice) => void;
  onEdit: (invoice: StoredInvoice) => void;
  onDelete: (invoice: StoredInvoice) => void;
  onTogglePaid: (invoice: StoredInvoice) => void;
}) {
  const { t } = useT();
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [direction, setDirection] = useState<Direction>('desc');

  const sorted = useMemo(() => {
    const value = (invoice: StoredInvoice) => {
      switch (sortKey) {
        case 'invoiceNumber': return invoice.invoiceNumber.toLowerCase();
        case 'client': return getInvoiceClientName(invoice).toLowerCase();
        case 'net': return getInvoiceNetAmount(invoice);
        case 'vat': return invoice.vatAmount;
        case 'total': return invoice.totalAmount;
        case 'status': return isInvoicePaid(invoice) ? 2 : isInvoiceOverdue(invoice) ? 0 : 1;
        default: return getInvoiceDate(invoice);
      }
    };

    return [...invoices].sort((a, b) => {
      const av = value(a);
      const bv = value(b);
      if (av === bv) return 0;
      const order = av > bv ? 1 : -1;
      return direction === 'asc' ? order : -order;
    });
  }, [direction, invoices, sortKey]);

  // Column sums live with the column, as the last row, rather than in tiles above.
  const totals = useMemo(() => ({
    net: sumEuros(invoices.map(getInvoiceNetAmount)),
    vat: sumEuros(invoices.map((invoice) => invoice.vatAmount)),
    total: sumEuros(invoices.map((invoice) => invoice.totalAmount)),
    paid: sumEuros(invoices.filter(isInvoicePaid).map((invoice) => invoice.totalAmount)),
    open: sumEuros(invoices.filter((invoice) => !isInvoicePaid(invoice)).map((invoice) => invoice.totalAmount)),
  }), [invoices]);

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) {
      setDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(key);
    setDirection(key === 'date' || key === 'net' || key === 'vat' || key === 'total' ? 'desc' : 'asc');
  };

  const arrow = (key: SortKey) => (key === sortKey ? (direction === 'asc' ? ' ↑' : ' ↓') : '');

  const columns: { key: SortKey; label: string; align?: string }[] = [
    { key: 'invoiceNumber', label: t('inv.colInvoice') },
    { key: 'date', label: t('inv.colDate') },
    { key: 'client', label: t('inv.colClient') },
    { key: 'net', label: t('inv.colExVat'), align: 'text-right' },
    { key: 'vat', label: t('inv.colVat'), align: 'text-right' },
    { key: 'total', label: t('inv.colTotal'), align: 'text-right' },
    { key: 'status', label: t('inv.colPaid') },
  ];

  if (invoices.length === 0) {
    return <div className="card p-6 muted">{t('inv.none')}</div>;
  }

  return (
    <div className="card overflow-x-auto">
      <table className="data-table min-w-[860px]">
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                className={`sortable ${column.align ?? ''}`}
                onClick={() => toggleSort(column.key)}
                aria-sort={
                  sortKey === column.key ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'
                }
              >
                {column.label}
                {arrow(column.key)}
              </th>
            ))}
            <th className="text-right">{t('inv.colActions')}</th>
          </tr>
        </thead>

        <tbody className="tabular-nums">
          {sorted.map((invoice) => {
            const paid = isInvoicePaid(invoice);
            const overdue = isInvoiceOverdue(invoice);
            const modern = isInvoiceRecord(invoice);

            return (
              <tr key={invoice.id}>
                <td className="font-medium">{invoice.invoiceNumber}</td>
                <td className="whitespace-nowrap">{formatDate(getInvoiceDate(invoice))}</td>
                <td className="max-w-[190px] truncate">{getInvoiceClientName(invoice)}</td>
                <td className="text-right">{formatCurrency(getInvoiceNetAmount(invoice))}</td>
                <td className="text-right">{formatCurrency(invoice.vatAmount)}</td>
                <td className="text-right font-medium">{formatCurrency(invoice.totalAmount)}</td>

                <td>
                  {/* The checkbox is the control; the label carries the date on hover. */}
                  <label
                    className="flex cursor-pointer items-center gap-2 whitespace-nowrap"
                    title={
                      paid
                        ? t('inv.paidOn', { date: formatDate(invoice.paidDate ?? '') })
                        : overdue
                          ? t('inv.wasDue', { date: formatDate(invoice.dueDate) })
                          : t('inv.due', { date: formatDate(invoice.dueDate) })
                    }
                  >
                    <input type="checkbox" checked={paid} onChange={() => onTogglePaid(invoice)} />
                    <span className={`chip ${paid ? 'chip-good' : overdue ? 'chip-bad' : ''}`}>
                      {paid ? t('inv.statusPaid') : overdue ? t('inv.statusOverdue') : t('inv.statusOpen')}
                    </span>
                  </label>
                </td>

                <td>
                  <div className="flex items-center justify-end gap-1.5">
                    {modern && (
                      <>
                        <button className="btn btn-icon" title={t('inv.actLoad')} aria-label={t('inv.actLoad')} onClick={() => onLoad(invoice)}>
                          <Icon name="load" />
                        </button>
                        <button className="btn btn-icon" title={t('inv.actPrint')} aria-label={t('inv.actPrint')} onClick={() => onPrint(invoice)}>
                          <Icon name="print" />
                        </button>
                        <button className="btn btn-icon" title={t('inv.actEdit')} aria-label={t('inv.actEdit')} onClick={() => onEdit(invoice)}>
                          <Icon name="edit" />
                        </button>
                      </>
                    )}
                    <button className="btn btn-icon btn-danger" title={t('inv.actDelete')} aria-label={t('inv.actDelete')} onClick={() => onDelete(invoice)}>
                      <Icon name="delete" />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>

        <tfoot>
          <tr className="border-t-2 border-[var(--line-strong)] font-medium">
            <td colSpan={3}>{invoices.length} {t('inv.count')}</td>
            <td className="text-right tabular-nums">{formatCurrency(totals.net)}</td>
            <td className="text-right tabular-nums">{formatCurrency(totals.vat)}</td>
            <td className="text-right tabular-nums">{formatCurrency(totals.total)}</td>
            <td colSpan={2} className="text-right text-xs font-normal muted">
              {t('inv.paidOpen', { paid: formatCurrency(totals.paid), open: formatCurrency(totals.open) })}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
