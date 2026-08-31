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

function Icon({ name }: { name: 'load' | 'print' | 'edit' | 'delete' | 'download' }) {
  const paths: Record<string, string> = {
    load: 'M4 8l6 5 6-5M10 13V3',
    print: 'M6 7V3h8v4M6 14H4V8h12v6h-2M6 12h8v5H6z',
    edit: 'M3 15.5V17h1.5l8-8L11 7.5l-8 8zM13 6l1-1 1.5 1.5-1 1L13 6z',
    delete: 'M4 6h12M8 6V4h4v2M6 6l1 10h6l1-10',
    download: 'M10 3v9m0 0l-3.5-3.5M10 12l3.5-3.5M4 15.5h12',
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
  onDownloadMany,
}: {
  invoices: StoredInvoice[];
  onLoad: (invoice: StoredInvoice) => void;
  onPrint: (invoice: StoredInvoice) => void;
  onEdit: (invoice: StoredInvoice) => void;
  onDelete: (invoice: StoredInvoice) => void;
  onTogglePaid: (invoice: StoredInvoice) => void;
  onDownloadMany: (invoices: StoredInvoice[]) => void;
}) {
  const { t } = useT();
  const [selected, setSelected] = useState<Set<number>>(new Set());
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
    net: sumEuros(sorted.map(getInvoiceNetAmount)),
    vat: sumEuros(sorted.map((invoice) => invoice.vatAmount)),
    total: sumEuros(sorted.map((invoice) => invoice.totalAmount)),
  }), [sorted]);

  // Only invoices that can produce a PDF are selectable.
  const printable = useMemo(() => sorted.filter(isInvoiceRecord), [sorted]);
  const selectedInvoices = useMemo(
    () => printable.filter((invoice) => selected.has(invoice.id)),
    [printable, selected]
  );
  const allSelected = printable.length > 0 && selectedInvoices.length === printable.length;

  const toggleOne = (id: number) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(printable.map((invoice) => invoice.id)));
  };

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

  const downloadLabel =
    selectedInvoices.length === 0
      ? t('inv.downloadNone')
      : selectedInvoices.length === 1
        ? t('inv.downloadSelected', { count: 1 })
        : t('inv.downloadSelectedPlural', { count: selectedInvoices.length });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <button
          className={selectedInvoices.length > 0 ? 'btn btn-primary' : 'btn'}
          disabled={selectedInvoices.length === 0}
          title={downloadLabel}
          onClick={() => onDownloadMany(selectedInvoices)}
        >
          <Icon name="download" />
          {downloadLabel}
        </button>

        {selectedInvoices.length > 0 && (
          <span className="text-sm muted">
            {t('inv.selectedCount', { count: selectedInvoices.length })}
          </span>
        )}
      </div>

      <div className="card overflow-x-auto">
      <table className="data-table min-w-[900px]">
        <thead>
          <tr>
            <th className="w-9">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleAll}
                aria-label={t('inv.selectAll')}
              />
            </th>
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
              <tr key={invoice.id} className={selected.has(invoice.id) ? 'row-selected' : ''}>
                <td>
                  <input
                    type="checkbox"
                    checked={selected.has(invoice.id)}
                    disabled={!modern}
                    onChange={() => toggleOne(invoice.id)}
                    aria-label={t('inv.selectRow')}
                  />
                </td>
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
          <tr className="totals-row">
            <td colSpan={4} className="text-sm font-semibold uppercase tracking-wide">
              {t('total.label')}
            </td>
            <td className="text-right text-base font-semibold tabular-nums">{formatCurrency(totals.net)}</td>
            <td className="text-right text-base font-semibold tabular-nums">{formatCurrency(totals.vat)}</td>
            <td className="text-right text-base font-semibold tabular-nums">{formatCurrency(totals.total)}</td>
            <td colSpan={2} />
          </tr>
        </tfoot>
      </table>
      </div>
    </div>
  );
}
