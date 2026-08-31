'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { jsPDF } from 'jspdf';
import InvoiceTable from '@/app/components/InvoiceTable';
import { useT } from '@/lib/i18n';
import { describeStorageError, useLocalStorageState } from '@/lib/local-storage';
import {
  BusinessProfile,
  ClientProfile,
  EMPTY_BUSINESS_PROFILE,
  InvoiceRecord,
  SavedBusinessProfile,
  StoredInvoice,
  VAT_OPTIONS,
  addDays,
  formatCurrency,
  formatDate,
  getMaxFutureDateString,
  getMinDateString,
  getTodayString,
  isBusinessProfileComplete,
  isInvoicePaid,
  isInvoiceRecord,
  roundCents,
  toBusinessProfile,
} from '@/lib/billing';

type InvoicePreviewData = Omit<InvoiceRecord, 'id' | 'clientProfile'> & {
  clientProfile: ClientProfile | null;
};

function matchesBusinessProfile(
  savedProfile: SavedBusinessProfile,
  profileToMatch: BusinessProfile
) {
  return (
    savedProfile.businessName === profileToMatch.businessName &&
    savedProfile.contactName === profileToMatch.contactName &&
    savedProfile.streetAddress === profileToMatch.streetAddress &&
    savedProfile.postalCodeCity === profileToMatch.postalCodeCity &&
    savedProfile.kvkNumber === profileToMatch.kvkNumber &&
    savedProfile.vatNumber === profileToMatch.vatNumber &&
    savedProfile.iban === profileToMatch.iban &&
    savedProfile.bankName === profileToMatch.bankName &&
    savedProfile.paymentTermsDays === profileToMatch.paymentTermsDays
  );
}

function getImageFormatFromDataUrl(dataUrl: string) {
  if (dataUrl.startsWith('data:image/png')) {
    return 'PNG';
  }

  return 'JPEG';
}

function resolveInvoiceForDisplay(
  invoice: InvoiceRecord,
  businessProfiles: SavedBusinessProfile[]
) {
  const matchingBusinessProfile = businessProfiles.find((profile) => {
    return matchesBusinessProfile(profile, invoice.fromProfile);
  });

  if (!matchingBusinessProfile) {
    return invoice;
  }

  return {
    ...invoice,
    fromProfile: {
      ...invoice.fromProfile,
      letterheadDataUrl:
        matchingBusinessProfile.letterheadDataUrl || invoice.fromProfile.letterheadDataUrl || '',
    },
  };
}

function downloadInvoicePdf(invoice: InvoiceRecord) {
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 16;
  const contentWidth = pageWidth - margin * 2;
  const labelColor = [71, 85, 105] as const;
  const textColor = [30, 41, 59] as const;
  const leftColumnWidth = (contentWidth - 14) / 2;
  const rightColumnX = margin + leftColumnWidth + 14;
  const logoSize = 28;
  let y = 18;

  const drawLabel = (text: string, x: number, labelY: number) => {
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(...labelColor);
    pdf.text(text, x, labelY);
  };

  const drawValueLines = (
    lines: string[],
    x: number,
    startY: number,
    width: number,
    boldFirstLine = false
  ) => {
    let currentY = startY;

    lines.forEach((line, index) => {
      const splitLines = pdf.splitTextToSize(line || ' ', width);
      pdf.setFont('helvetica', boldFirstLine && index === 0 ? 'bold' : 'normal');
      pdf.setFontSize(boldFirstLine && index === 0 ? 15 : 11.5);
      pdf.setTextColor(...textColor);
      pdf.text(splitLines, x, currentY);
      currentY += splitLines.length * (boldFirstLine && index === 0 ? 6 : 5.3);
    });

    return currentY;
  };

  if (invoice.fromProfile.letterheadDataUrl) {
    try {
      pdf.addImage(
        invoice.fromProfile.letterheadDataUrl,
        getImageFormatFromDataUrl(invoice.fromProfile.letterheadDataUrl),
        margin,
        y,
        logoSize,
        logoSize,
      );
    } catch {
      // Ignore image rendering failures and continue with the rest of the invoice.
    }
  }

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(25);
  pdf.setTextColor(15, 23, 42);
  pdf.text('INVOICE', pageWidth - margin, y + 12, { align: 'right' });
  y += logoSize + 10;

  drawLabel('From', margin, y);
  drawLabel('To', rightColumnX, y);
  y += 5;

  const fromBottomY = drawValueLines(
    [
      invoice.fromProfile.businessName || 'Your business name',
      invoice.fromProfile.contactName || 'Contact name',
      invoice.fromProfile.streetAddress || 'Street and number',
      invoice.fromProfile.postalCodeCity || 'Postal code and city',
      `KvK: ${invoice.fromProfile.kvkNumber || '—'}`,
      `BTW: ${invoice.fromProfile.vatNumber || '—'}`,
      `IBAN: ${invoice.fromProfile.iban || '—'}`,
    ],
    margin,
    y,
    leftColumnWidth,
    true
  );

  const toBottomY = drawValueLines(
    [
      invoice.clientProfile.companyName,
      ...(invoice.clientProfile.attentionName ? [invoice.clientProfile.attentionName] : []),
      invoice.clientProfile.streetAddress,
      invoice.clientProfile.postalCodeCity,
      `KvK: ${invoice.clientProfile.kvkNumber || '—'}`,
      `BTW: ${invoice.clientProfile.vatNumber || '—'}`,
    ],
    rightColumnX,
    y,
    leftColumnWidth,
    true
  );

  y = Math.max(fromBottomY, toBottomY) + 8;

  const metaLeftBottomY = drawValueLines(
    [
      `Invoice Date: ${formatDate(invoice.invoiceDate)}`,
      `Invoice Number: ${invoice.invoiceNumber || '—'}`,
      `Period: ${invoice.periodLabel || '—'}`,
    ],
    margin,
    y,
    leftColumnWidth
  );

  const metaRightBottomY = drawValueLines(
    [
      `Payment Terms: ${invoice.paymentTermsDays} days`,
      `Due Date: ${formatDate(invoice.dueDate)}`,
      `Bank: ${invoice.fromProfile.bankName || '—'} – ${invoice.fromProfile.iban || '—'}`,
    ],
    rightColumnX,
    y,
    leftColumnWidth
  );

  y = Math.max(metaLeftBottomY, metaRightBottomY) + 10;

  const descWidth = 88;
  const hoursWidth = 18;
  const rateWidth = 28;
  const descX = margin;
  const hoursX = descX + descWidth + 4;
  const rateX = hoursX + hoursWidth + 4;
  const amountX = rateX + rateWidth + 4;

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.setTextColor(...labelColor);
  pdf.text('Description', descX, y);
  pdf.text('Hours', hoursX, y);
  pdf.text('Rate (EUR)', rateX, y);
  pdf.text('Amount (EUR)', amountX, y);
  y += 6;

  const descriptionLines = pdf.splitTextToSize(
    invoice.description || 'Consultancy services for project work',
    descWidth
  );
  const cappedDescriptionLines = descriptionLines.slice(0, 5);

  if (descriptionLines.length > 5) {
    cappedDescriptionLines[4] = `${cappedDescriptionLines[4]}...`;
  }

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(11.5);
  pdf.setTextColor(...textColor);
  pdf.text(cappedDescriptionLines, descX, y);
  pdf.text(String(invoice.hours || 0), hoursX, y);
  pdf.text(formatCurrency(invoice.rate), rateX, y);
  pdf.text(formatCurrency(invoice.subtotal), amountX, y);

  y += Math.max(cappedDescriptionLines.length * 5.3, 8) + 12;

  const totalsX = pageWidth - margin - 76;
  const totalsValueX = pageWidth - margin;
  const drawTotalRow = (label: string, value: string, isFinal = false) => {
    pdf.setFont('helvetica', isFinal ? 'bold' : 'normal');
    pdf.setFontSize(isFinal ? 12.5 : 11.5);
    pdf.setTextColor(...textColor);
    pdf.text(label, totalsX, y);
    pdf.text(value, totalsValueX, y, { align: 'right' });
    y += isFinal ? 7 : 6;
  };

  drawTotalRow('Subtotal (excl. BTW)', formatCurrency(invoice.subtotal));
  drawTotalRow(`BTW ${invoice.vatRate}%`, formatCurrency(invoice.vatAmount));
  drawTotalRow('Total (incl. BTW)', formatCurrency(invoice.totalAmount), true);

  y += 6;

  const paymentLines = pdf.splitTextToSize(
    `Payment Terms: ${invoice.paymentTermsDays} days\nBank: ${invoice.fromProfile.bankName || '—'} – IBAN ${invoice.fromProfile.iban || '—'} – ${invoice.fromProfile.businessName || 'Your business'}`,
    contentWidth
  );
  const cappedPaymentLines = paymentLines.slice(0, 3);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(11);
  pdf.setTextColor(...textColor);
  pdf.text(cappedPaymentLines, margin, Math.min(y, pageHeight - 24));

  pdf.save(`${invoice.invoiceNumber || 'invoice'}.pdf`);
}

export default function InvoicesPage() {
  const [legacyBusinessProfile] = useLocalStorageState<BusinessProfile>(
    'business-profile',
    EMPTY_BUSINESS_PROFILE
  );
  const [businessProfiles] = useLocalStorageState<SavedBusinessProfile[]>(
    'business-profiles',
    []
  );
  const [clientProfiles] = useLocalStorageState<ClientProfile[]>('client-profiles', []);
  const [storedInvoices, setStoredInvoices] = useLocalStorageState<StoredInvoice[]>('invoices', []);
  const [selectedBusinessId, setSelectedBusinessId] = useState('');
  const [selectedClientId, setSelectedClientId] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState('');
  const [periodLabel, setPeriodLabel] = useState('');
  const [description, setDescription] = useState('Consultancy services');
  const [hours, setHours] = useState('');
  const [rate, setRate] = useState('');
  const [paymentTermsDays, setPaymentTermsDays] = useState('');
  const [vatSelection, setVatSelection] = useState('21');
  const [customVatRate, setCustomVatRate] = useState('');
  const [loadedInvoiceId, setLoadedInvoiceId] = useState<number | null>(null);
  const [editingInvoiceId, setEditingInvoiceId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const { t } = useT();

  const minDate = getMinDateString();
  const maxFutureDate = getMaxFutureDateString();
  const resolvedBusinessProfileId =
    selectedBusinessId || (businessProfiles[0] ? String(businessProfiles[0].id) : '');
  const businessProfile = useMemo<BusinessProfile>(() => {
    const savedBusinessProfile = businessProfiles.find((profile) => {
      return String(profile.id) === resolvedBusinessProfileId;
    });

    if (savedBusinessProfile) {
      return toBusinessProfile(savedBusinessProfile);
    }

    return legacyBusinessProfile;
  }, [businessProfiles, legacyBusinessProfile, resolvedBusinessProfileId]);
  const selectedClientProfile = clientProfiles.find(
    (profile) => String(profile.id) === selectedClientId
  ) ?? null;
  const resolvedPaymentTermsDays = paymentTermsDays || businessProfile.paymentTermsDays || '30';

  const effectiveVatRate = useMemo(() => {
    if (vatSelection === 'custom') {
      return Number(customVatRate) || 0;
    }
    return Number(vatSelection);
  }, [vatSelection, customVatRate]);

  const subtotal = useMemo(() => {
    const parsedHours = Number(hours) || 0;
    const parsedRate = Number(rate) || 0;
    return roundCents(parsedHours * parsedRate);
  }, [hours, rate]);

  const calculatedVatAmount = useMemo(() => {
    return roundCents(subtotal * (effectiveVatRate / 100));
  }, [subtotal, effectiveVatRate]);

  const calculatedTotal = useMemo(() => {
    return roundCents(subtotal + calculatedVatAmount);
  }, [subtotal, calculatedVatAmount]);

  const dueDate = useMemo(() => {
    if (!invoiceDate) {
      return '';
    }

    return addDays(invoiceDate, Number(resolvedPaymentTermsDays) || 30);
  }, [invoiceDate, resolvedPaymentTermsDays]);


  const loadedInvoice = useMemo(() => {
    const invoice =
      storedInvoices.find((storedInvoice): storedInvoice is InvoiceRecord => {
        return storedInvoice.id === loadedInvoiceId && isInvoiceRecord(storedInvoice);
      }) ?? null;

    return invoice ? resolveInvoiceForDisplay(invoice, businessProfiles) : null;
  }, [businessProfiles, loadedInvoiceId, storedInvoices]);

  const previewInvoice = useMemo<InvoicePreviewData>(() => {
    if (loadedInvoice) {
      return loadedInvoice;
    }

    return {
      invoiceNumber,
      invoiceDate,
      dueDate,
      periodLabel,
      description,
      hours: Number(hours) || 0,
      rate: Number(rate) || 0,
      subtotal,
      vatRate: effectiveVatRate,
      vatAmount: calculatedVatAmount,
      totalAmount: calculatedTotal,
      paymentTermsDays: Number(resolvedPaymentTermsDays) || 30,
      fromProfile: businessProfile,
      clientProfile: selectedClientProfile,
    };
  }, [
    businessProfile,
    calculatedTotal,
    calculatedVatAmount,
    description,
    dueDate,
    effectiveVatRate,
    hours,
    invoiceDate,
    invoiceNumber,
    loadedInvoice,
    periodLabel,
    rate,
    resolvedPaymentTermsDays,
    selectedClientProfile,
    subtotal,
  ]);

  const switchToDraftPreview = () => {
    if (loadedInvoiceId !== null) {
      setLoadedInvoiceId(null);
    }
  };

  const loadSavedInvoice = (
    invoice: InvoiceRecord,
    options?: {
      shouldScroll?: boolean;
    }
  ) => {
    const matchingBusinessProfile = businessProfiles.find((profile) => {
      return matchesBusinessProfile(profile, invoice.fromProfile);
    });
    const matchingClientProfile = clientProfiles.find((profile) => {
      return profile.id === invoice.clientProfile.id;
    });
    const matchingVatOption = VAT_OPTIONS.find((option) => {
      return option.value !== 'custom' && Number(option.value) === invoice.vatRate;
    });

    setSelectedBusinessId(matchingBusinessProfile ? String(matchingBusinessProfile.id) : '');
    setSelectedClientId(matchingClientProfile ? String(matchingClientProfile.id) : '');
    setInvoiceNumber(invoice.invoiceNumber);
    setInvoiceDate(invoice.invoiceDate);
    setPeriodLabel(invoice.periodLabel);
    setDescription(invoice.description);
    setHours(String(invoice.hours));
    setRate(String(invoice.rate));
    setPaymentTermsDays(String(invoice.paymentTermsDays));
    setVatSelection(matchingVatOption ? matchingVatOption.value : 'custom');
    setCustomVatRate(matchingVatOption ? '' : String(invoice.vatRate));
    setLoadedInvoiceId(invoice.id);
    setError('');

    if (options?.shouldScroll ?? true) {
      document.getElementById('invoice-preview')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }
  };

  const startEditingInvoice = (invoice: InvoiceRecord) => {
    loadSavedInvoice(invoice, { shouldScroll: false });
    // Editing follows the live draft preview, so the changes are visible as they
    // are typed rather than showing the version still on disk.
    setLoadedInvoiceId(null);
    setEditingInvoiceId(invoice.id);
    setNotice('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEditing = () => {
    setEditingInvoiceId(null);
    setLoadedInvoiceId(null);
    setInvoiceNumber('');
    setInvoiceDate('');
    setPeriodLabel('');
    setHours('');
    setRate('');
    setError('');
    setNotice('');
  };

  const deleteInvoice = (invoice: StoredInvoice) => {
    const confirmed = window.confirm(
      `Delete invoice ${invoice.invoiceNumber} (${formatCurrency(
        invoice.totalAmount
      )})? This cannot be undone.`
    );

    if (!confirmed) {
      return;
    }

    try {
      setStoredInvoices(storedInvoices.filter((item) => item.id !== invoice.id));
      setError('');
      setNotice(`Deleted invoice ${invoice.invoiceNumber}.`);

      if (loadedInvoiceId === invoice.id) {
        setLoadedInvoiceId(null);
      }

      if (editingInvoiceId === invoice.id) {
        cancelEditing();
      }
    } catch (storageError) {
      setNotice('');
      setError(describeStorageError(storageError));
    }
  };

  const togglePaid = (invoice: StoredInvoice) => {
    const nextPaidDate = isInvoicePaid(invoice) ? undefined : getTodayString();

    try {
      setStoredInvoices(
        storedInvoices.map((item) =>
          item.id === invoice.id ? { ...item, paidDate: nextPaidDate } : item
        )
      );
      setError('');
      setNotice(
        nextPaidDate
          ? `Marked invoice ${invoice.invoiceNumber} paid on ${formatDate(nextPaidDate)}.`
          : `Marked invoice ${invoice.invoiceNumber} unpaid.`
      );
    } catch (storageError) {
      setNotice('');
      setError(describeStorageError(storageError));
    }
  };

  /**
   * Save each selected invoice as its own PDF. Browsers throttle simultaneous
   * downloads, so they are spaced out rather than fired in one burst.
   */
  const downloadManyInvoices = async (invoices: StoredInvoice[]) => {
    const records = invoices.filter(isInvoiceRecord);

    if (records.length === 0) {
      return;
    }

    setError('');

    for (const [index, invoice] of records.entries()) {
      downloadInvoicePdf(resolveInvoiceForDisplay(invoice, businessProfiles));
      if (index < records.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 350));
      }
    }

    setNotice(
      records.length === 1
        ? `Downloaded invoice ${records[0].invoiceNumber}.`
        : `Downloaded ${records.length} invoices.`
    );
  };

  const printSavedInvoice = (invoice: InvoiceRecord) => {
    loadSavedInvoice(invoice, { shouldScroll: false });
    downloadInvoicePdf(resolveInvoiceForDisplay(invoice, businessProfiles));
    setError('');
  };

  const saveInvoice = () => {
    setError('');
    setNotice('');

    if (
      !invoiceNumber.trim() ||
      !invoiceDate ||
      !periodLabel.trim() ||
      !description.trim() ||
      !hours ||
      !rate
    ) {
      setError('Please fill in invoice number, invoice date, period, description, hours, and rate.');
      return;
    }

    if (!isBusinessProfileComplete(businessProfile)) {
      setError('Please complete your business profile first.');
      return;
    }

    if (!selectedClientProfile) {
      setError('Please select a saved client profile.');
      return;
    }

    if (invoiceDate < minDate || invoiceDate > maxFutureDate) {
      setError('Invoice date must be within the last 1 year and up to 1 year in the future.');
      return;
    }

    const parsedHours = Number(hours);
    const parsedRate = Number(rate);

    if (Number.isNaN(parsedHours) || parsedHours <= 0) {
      setError('Hours must be greater than 0.');
      return;
    }

    if (Number.isNaN(parsedRate) || parsedRate <= 0) {
      setError('Rate must be greater than 0.');
      return;
    }

    if (
      vatSelection === 'custom' &&
      (customVatRate === '' || Number(customVatRate) < 0)
    ) {
      setError('Please enter a valid custom VAT %.');
      return;
    }

    // Invoice numbers must be unique; a duplicate is an administrative problem,
    // not just a cosmetic one.
    const duplicate = storedInvoices.find((invoice) => {
      return (
        invoice.id !== editingInvoiceId &&
        invoice.invoiceNumber.trim().toLowerCase() === invoiceNumber.trim().toLowerCase()
      );
    });

    if (duplicate) {
      setError(
        `Invoice number ${duplicate.invoiceNumber} is already used. Invoice numbers must be unique.`
      );
      return;
    }

    const newInvoice: InvoiceRecord = {
      id: editingInvoiceId ?? Date.now(),
      invoiceNumber: invoiceNumber.trim(),
      invoiceDate,
      dueDate,
      periodLabel: periodLabel.trim(),
      description: description.trim(),
      hours: parsedHours,
      rate: parsedRate,
      subtotal,
      vatRate: effectiveVatRate,
      vatAmount: calculatedVatAmount,
      totalAmount: calculatedTotal,
      paymentTermsDays: Number(resolvedPaymentTermsDays) || 30,
      fromProfile: { ...businessProfile },
      clientProfile: { ...selectedClientProfile },
    };

    const isUpdate = editingInvoiceId !== null;
    const updatedInvoices = isUpdate
      ? storedInvoices.map((invoice) =>
          invoice.id === editingInvoiceId ? newInvoice : invoice
        )
      : [newInvoice, ...storedInvoices];

    try {
      setStoredInvoices(updatedInvoices);
    } catch (storageError) {
      setError(describeStorageError(storageError));
      return;
    }

    setEditingInvoiceId(null);
    setLoadedInvoiceId(newInvoice.id);
    setNotice(
      isUpdate
        ? `Updated invoice ${newInvoice.invoiceNumber}.`
        : `Saved invoice ${newInvoice.invoiceNumber}.`
    );

    setInvoiceNumber('');
    setInvoiceDate('');
    setPeriodLabel('');
    setHours('');
    setRate('');
  };

  return (
    <main className="space-y-6">

      {editingInvoiceId !== null && (
        <div className="no-print card-accent p-4 text-sm text-[var(--accent)]">
          Editing a saved invoice. Choosing “Update invoice” overwrites it instead of
          creating a new one.
        </div>
      )}

      <div className="no-print">
        <h1 className="text-3xl font-semibold">{t('inv.title')}</h1>
        <p className="mt-2 text-sm muted">
          {t('inv.subtitle')}
        </p>
      </div>

      <section className="invoice-layout grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="no-print space-y-6">
          <div className="card p-6">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold">{t('cl.title')}</h2>
                <p className="mt-2 text-sm muted">
                  {t('inv.selectBoth')}
                </p>
              </div>
              <Link
                href="/clients"
                className="btn"
              >
                {t('inv.editProfiles')}
              </Link>
            </div>

            <div className="grid gap-4">
              {businessProfiles.length > 0 && (
                <label className="space-y-2">
                  <span className="text-sm muted">{t('inv.businessProfile')}</span>
                  <select
                    className="field"
                    value={resolvedBusinessProfileId}
                    onChange={(e) => {
                      switchToDraftPreview();
                      setSelectedBusinessId(e.target.value);
                    }}
                  >
                    {businessProfiles.map((profile) => (
                      <option key={profile.id} value={profile.id} style={{ color: "var(--ink)", background: "var(--surface)" }}>
                        {profile.businessName}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <div className="panel p-4 text-sm muted">
                <div className="mb-2 text-xs uppercase tracking-[0.18em] faint">From</div>
                <div className="font-medium">
                  {businessProfile.businessName || 'Your business profile is missing'}
                </div>
                <div className="mt-2">{businessProfile.contactName || 'Add your business details in Profiles.'}</div>
                {businessProfile.streetAddress && <div>{businessProfile.streetAddress}</div>}
                {businessProfile.postalCodeCity && <div>{businessProfile.postalCodeCity}</div>}
              </div>

              <label className="space-y-2">
                <span className="text-sm muted">{t('inv.to')}</span>
                <select
                  className="field"
                  value={selectedClientId}
                  onChange={(e) => {
                    switchToDraftPreview();
                    setSelectedClientId(e.target.value);
                  }}
                >
                  <option value="" style={{ color: "var(--ink)", background: "var(--surface)" }}>
                    {t('inv.selectClient')}
                  </option>
                  {clientProfiles.map((profile) => (
                    <option key={profile.id} value={profile.id} style={{ color: "var(--ink)", background: "var(--surface)" }}>
                      {profile.companyName}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <div className="card p-6">
            <h2 className="text-2xl font-semibold">{t('inv.details')}</h2>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm muted">{t('inv.number')}</span>
                <input
                  className="field"
                  placeholder="202603-01"
                  value={invoiceNumber}
                  onChange={(e) => {
                    switchToDraftPreview();
                    setInvoiceNumber(e.target.value);
                  }}
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm muted">{t('inv.date')}</span>
                <input
                  className="field"
                  type="date"
                  min={minDate}
                  max={maxFutureDate}
                  value={invoiceDate}
                  onChange={(e) => {
                    switchToDraftPreview();
                    setInvoiceDate(e.target.value);
                  }}
                />
                <p className="text-xs faint">
                  {t('inv.dateHint')}
                </p>
              </label>

              <label className="space-y-2">
                <span className="text-sm muted">{t('inv.period')}</span>
                <input
                  className="field"
                  placeholder="March 2026"
                  value={periodLabel}
                  onChange={(e) => {
                    switchToDraftPreview();
                    setPeriodLabel(e.target.value);
                  }}
                />
                <p className="text-xs faint">
                  Example: “March 2026” or “Q1 2026”.
                </p>
              </label>

              <label className="space-y-2 md:max-w-[14rem]">
                <span className="text-sm muted">{t('inv.terms')}</span>
                <input
                  className="field"
                  type="number"
                  min="1"
                  value={resolvedPaymentTermsDays}
                  onChange={(e) => {
                    switchToDraftPreview();
                    setPaymentTermsDays(e.target.value);
                  }}
                />
                <p className="text-xs faint">
                  {t('inv.dueHint')}
                </p>
              </label>
            </div>
          </div>

          <div className="card p-6">
            <h2 className="text-2xl font-semibold">{t('inv.workAndVat')}</h2>
            <div className="mt-5 grid gap-4">
              <label className="space-y-2">
                <span className="text-sm muted">{t('inv.description')}</span>
                <textarea
                  className="field min-h-28"
                  placeholder="Consultancy services for monthly project support"
                  value={description}
                  onChange={(e) => {
                    switchToDraftPreview();
                    setDescription(e.target.value);
                  }}
                />
              </label>

              <div className="grid gap-4 md:grid-cols-[0.5fr_0.5fr_0.45fr]">
                <label className="space-y-2">
                  <span className="text-sm muted">{t('inv.hours')}</span>
                  <input
                    className="field"
                    type="number"
                    step="0.25"
                    min="0.25"
                    placeholder="182"
                    value={hours}
                    onChange={(e) => {
                      switchToDraftPreview();
                      setHours(e.target.value);
                    }}
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm muted">{t('inv.rate')}</span>
                  <input
                    className="field"
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="105"
                    value={rate}
                    onChange={(e) => {
                      switchToDraftPreview();
                      setRate(e.target.value);
                    }}
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm muted">BTW / VAT</span>
                  <select
                    className="field"
                    value={vatSelection}
                    onChange={(e) => {
                      switchToDraftPreview();
                      setVatSelection(e.target.value);
                    }}
                  >
                    {VAT_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value} style={{ color: "var(--ink)", background: "var(--surface)" }}>
                        VAT {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {vatSelection === 'custom' && (
                <label className="max-w-[14rem] space-y-2">
                  <span className="text-sm muted">{t('inv.customVat')}</span>
                  <input
                    className="field"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="21"
                    value={customVatRate}
                    onChange={(e) => {
                      switchToDraftPreview();
                      setCustomVatRate(e.target.value);
                    }}
                  />
                </label>
              )}

              <div className="grid gap-4 md:grid-cols-3">
                <div className="panel p-4">
                  <div className="text-sm faint">Subtotal</div>
                  <div className="mt-2 text-2xl font-semibold">{formatCurrency(subtotal)}</div>
                </div>
                <div className="panel p-4">
                  <div className="text-sm faint">VAT {effectiveVatRate}%</div>
                  <div className="mt-2 text-2xl font-semibold">{formatCurrency(calculatedVatAmount)}</div>
                </div>
                <div className="panel p-4">
                  <div className="text-sm faint">Total incl. VAT</div>
                  <div className="mt-2 text-2xl font-semibold">{formatCurrency(calculatedTotal)}</div>
                </div>
              </div>
            </div>

            {error && (
              <div className="mt-5 panel p-3 text-sm text-[var(--bad)]">
                {error}
              </div>
            )}

            {notice && !error && (
              <div className="mt-5 panel p-3 text-sm text-[var(--good)]">
                {notice}
              </div>
            )}

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                onClick={saveInvoice}
                className="btn btn-primary"
              >
                {editingInvoiceId !== null ? t('inv.update') : t('inv.save')}
              </button>

              {editingInvoiceId !== null && (
                <button
                  onClick={cancelEditing}
                  className="btn"
                >
                  {t('inv.cancelEdit')}
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="print-shell space-y-6">
          <div
            id="invoice-preview"
            className="invoice-preview-card overflow-hidden rounded-[2rem] bg-white p-8 text-slate-900 shadow-[0_30px_80px_rgba(0,0,0,0.18)]"
          >
            <div className="flex items-start justify-between gap-8">
              <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-[1.5rem] bg-slate-100">
                {previewInvoice.fromProfile.letterheadDataUrl ? (
                  <Image
                    src={previewInvoice.fromProfile.letterheadDataUrl}
                    alt={`${previewInvoice.fromProfile.businessName || 'Business'} logo`}
                    width={112}
                    height={112}
                    className="h-28 w-28 object-contain"
                    unoptimized
                  />
                ) : (
                  <div className="text-sm text-slate-400">Logo</div>
                )}
              </div>

              <div className="pt-3 text-right">
                <div className="text-4xl font-semibold tracking-tight">INVOICE</div>
              </div>
            </div>

            <div className="mt-10 grid gap-10 md:grid-cols-2">
              <div>
                <div className="mb-3 text-xs uppercase tracking-[0.18em] text-slate-500">From</div>
                <div className="space-y-1 text-sm text-slate-800">
                  <div className="text-lg font-semibold">
                    {previewInvoice.fromProfile.businessName || 'Your business name'}
                  </div>
                  <div>{previewInvoice.fromProfile.contactName || 'Contact name'}</div>
                  <div>{previewInvoice.fromProfile.streetAddress || 'Street and number'}</div>
                  <div>{previewInvoice.fromProfile.postalCodeCity || 'Postal code and city'}</div>
                  <div>KvK: {previewInvoice.fromProfile.kvkNumber || '—'}</div>
                  <div>BTW: {previewInvoice.fromProfile.vatNumber || '—'}</div>
                  <div>IBAN: {previewInvoice.fromProfile.iban || '—'}</div>
                </div>
              </div>

              <div>
                <div className="mb-3 text-xs uppercase tracking-[0.18em] text-slate-500">To</div>
                {previewInvoice.clientProfile ? (
                  <div className="space-y-1 text-sm text-slate-800">
                    <div className="text-lg font-semibold">{previewInvoice.clientProfile.companyName}</div>
                    {previewInvoice.clientProfile.attentionName && (
                      <div>{previewInvoice.clientProfile.attentionName}</div>
                    )}
                    <div>{previewInvoice.clientProfile.streetAddress}</div>
                    <div>{previewInvoice.clientProfile.postalCodeCity}</div>
                    <div>KvK: {previewInvoice.clientProfile.kvkNumber || '—'}</div>
                    <div>BTW: {previewInvoice.clientProfile.vatNumber || '—'}</div>
                  </div>
                ) : (
                  <div className="text-sm text-slate-500">
                    {t('inv.fillClient')}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-10 grid gap-6 md:grid-cols-2">
              <div className="space-y-2 text-sm text-slate-800">
                <div>Invoice Date: {formatDate(previewInvoice.invoiceDate)}</div>
                <div>Invoice Number: {previewInvoice.invoiceNumber || '—'}</div>
                <div>Period: {previewInvoice.periodLabel || '—'}</div>
              </div>
              <div className="space-y-2 text-sm text-slate-800">
                <div>Payment Terms: {previewInvoice.paymentTermsDays} days</div>
                <div>Due Date: {formatDate(previewInvoice.dueDate)}</div>
                <div>
                  Bank: {previewInvoice.fromProfile.bankName || '—'} – {previewInvoice.fromProfile.iban || '—'}
                </div>
              </div>
            </div>

            <div className="mt-10">
              <div className="grid grid-cols-[1.5fr_0.45fr_0.55fr_0.7fr] gap-3 text-xs uppercase tracking-[0.14em] text-slate-500">
                <div>Description</div>
                <div>Hours</div>
                <div>Rate (EUR)</div>
                <div>Amount (EUR)</div>
              </div>
              <div className="mt-3 grid grid-cols-[1.5fr_0.45fr_0.55fr_0.7fr] gap-3 text-sm text-slate-800">
                <div>{previewInvoice.description || 'Consultancy services for project work'}</div>
                <div>{previewInvoice.hours || '0'}</div>
                <div>{formatCurrency(previewInvoice.rate)}</div>
                <div>{formatCurrency(previewInvoice.subtotal)}</div>
              </div>

              <div className="mt-10 space-y-3 text-sm text-slate-800">
                <div className="flex items-center justify-between">
                  <span>Subtotal (excl. BTW)</span>
                  <span>{formatCurrency(previewInvoice.subtotal)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>BTW {previewInvoice.vatRate}%</span>
                  <span>{formatCurrency(previewInvoice.vatAmount)}</span>
                </div>
                <div className="flex items-center justify-between text-base font-semibold">
                  <span>Total (incl. BTW)</span>
                  <span>{formatCurrency(previewInvoice.totalAmount)}</span>
                </div>
              </div>

              <div className="mt-10 text-sm leading-6 text-slate-700">
                Payment Terms: {previewInvoice.paymentTermsDays} days
                <br />
                Bank: {previewInvoice.fromProfile.bankName || '—'} – IBAN {previewInvoice.fromProfile.iban || '—'} – {previewInvoice.fromProfile.businessName || 'Your business'}
              </div>
            </div>
          </div>

          {!isBusinessProfileComplete(businessProfile) && (
            <div className="no-print card border-[var(--warn)] bg-[var(--warn-soft)] p-5 text-sm text-[var(--warn)]">
              {t('inv.profileIncomplete')}
            </div>
          )}

          {clientProfiles.length === 0 && (
            <div className="no-print card border-[var(--warn)] bg-[var(--warn-soft)] p-5 text-sm text-[var(--warn)]">{t('inv.noClientProfiles')}</div>
          )}
        </div>
      </section>

      <section className="no-print space-y-3">
        <div>
          <h2 className="text-2xl font-semibold">{t('inv.saved')}</h2>
          <p className="mt-2 text-sm muted">
            {t('inv.savedHint')}
          </p>
        </div>

        <InvoiceTable
          invoices={storedInvoices}
          onLoad={(invoice) => {
            if (isInvoiceRecord(invoice)) loadSavedInvoice(invoice);
          }}
          onPrint={(invoice) => {
            if (isInvoiceRecord(invoice)) printSavedInvoice(invoice);
          }}
          onEdit={(invoice) => {
            if (isInvoiceRecord(invoice)) startEditingInvoice(invoice);
          }}
          onDelete={deleteInvoice}
          onTogglePaid={togglePaid}
          onDownloadMany={downloadManyInvoices}
        />
      </section>
    </main>
  );
}
