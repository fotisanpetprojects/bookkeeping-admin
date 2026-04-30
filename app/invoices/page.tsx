'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { jsPDF } from 'jspdf';
import { useLocalStorageState } from '@/lib/local-storage';
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
  getMinDateString,
  getTodayString,
  isBusinessProfileComplete,
  isInvoiceRecord,
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
  const [error, setError] = useState('');

  const today = getTodayString();
  const minDate = getMinDateString();
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
    return parsedHours * parsedRate;
  }, [hours, rate]);

  const calculatedVatAmount = useMemo(() => {
    return subtotal * (effectiveVatRate / 100);
  }, [subtotal, effectiveVatRate]);

  const calculatedTotal = useMemo(() => {
    return subtotal + calculatedVatAmount;
  }, [subtotal, calculatedVatAmount]);

  const dueDate = useMemo(() => {
    if (!invoiceDate) {
      return '';
    }

    return addDays(invoiceDate, Number(resolvedPaymentTermsDays) || 30);
  }, [invoiceDate, resolvedPaymentTermsDays]);

  const totals = useMemo(() => {
    return storedInvoices.reduce(
      (summary, invoice) => {
        summary.exVat += isInvoiceRecord(invoice) ? invoice.subtotal : invoice.amountExVat;
        summary.vat += invoice.vatAmount;
        summary.total += invoice.totalAmount;
        return summary;
      },
      { exVat: 0, vat: 0, total: 0 }
    );
  }, [storedInvoices]);

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

  const printSavedInvoice = (invoice: InvoiceRecord) => {
    loadSavedInvoice(invoice, { shouldScroll: false });
    downloadInvoicePdf(resolveInvoiceForDisplay(invoice, businessProfiles));
    setError('');
  };

  const addInvoice = () => {
    setError('');

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

    if (invoiceDate < minDate || invoiceDate > today) {
      setError('Invoice date must be within the last 1 year and not in the future.');
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

    const newInvoice: InvoiceRecord = {
      id: Date.now(),
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

    const updatedInvoices = [newInvoice, ...storedInvoices];
    setStoredInvoices(updatedInvoices);
    setLoadedInvoiceId(newInvoice.id);

    setInvoiceNumber('');
    setInvoiceDate('');
    setPeriodLabel('');
    setHours('');
    setRate('');
  };

  return (
    <main className="space-y-6">
      <Link
        href="/"
        className="no-print inline-block rounded-full border border-white/10 px-4 py-2 text-sm hover:bg-white/10"
      >
        ← Back
      </Link>

      <div className="no-print">
        <h1 className="text-3xl font-semibold">Invoices</h1>
        <p className="mt-2 text-sm text-white/60">
          Build invoices from saved profiles and generate VAT totals from hours and rate.
        </p>
      </div>

      <div className="no-print grid gap-4 md:grid-cols-3">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="text-sm text-white/50">Invoiced ex VAT</div>
          <div className="mt-2 text-3xl font-semibold">{formatCurrency(totals.exVat)}</div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="text-sm text-white/50">VAT to collect</div>
          <div className="mt-2 text-3xl font-semibold">{formatCurrency(totals.vat)}</div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="text-sm text-white/50">Total incl VAT</div>
          <div className="mt-2 text-3xl font-semibold">{formatCurrency(totals.total)}</div>
        </div>
      </div>

      <section className="invoice-layout grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="no-print space-y-6">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold">Profiles</h2>
                <p className="mt-2 text-sm text-white/60">
                  Select a saved business profile and a saved client profile.
                </p>
              </div>
              <Link
                href="/clients"
                className="rounded-full border border-white/10 px-4 py-2 text-sm hover:bg-white/10"
              >
                Edit profiles
              </Link>
            </div>

            <div className="grid gap-4">
              {businessProfiles.length > 0 && (
                <label className="space-y-2">
                  <span className="text-sm text-white/70">Business profile</span>
                  <select
                    className="w-full rounded-2xl border border-white/10 bg-white/5 p-3 text-white outline-none"
                    value={resolvedBusinessProfileId}
                    onChange={(e) => {
                      switchToDraftPreview();
                      setSelectedBusinessId(e.target.value);
                    }}
                  >
                    {businessProfiles.map((profile) => (
                      <option key={profile.id} value={profile.id} className="text-black">
                        {profile.businessName}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <div className="rounded-[2rem] border border-white/10 bg-black/20 p-4 text-sm text-white/75">
                <div className="mb-2 text-xs uppercase tracking-[0.18em] text-white/45">From</div>
                <div className="font-medium text-white">
                  {businessProfile.businessName || 'Your business profile is missing'}
                </div>
                <div className="mt-2">{businessProfile.contactName || 'Add your business details in Profiles.'}</div>
                {businessProfile.streetAddress && <div>{businessProfile.streetAddress}</div>}
                {businessProfile.postalCodeCity && <div>{businessProfile.postalCodeCity}</div>}
              </div>

              <label className="space-y-2">
                <span className="text-sm text-white/70">Client profile</span>
                <select
                  className="w-full rounded-2xl border border-white/10 bg-white/5 p-3 text-white outline-none"
                  value={selectedClientId}
                  onChange={(e) => {
                    switchToDraftPreview();
                    setSelectedClientId(e.target.value);
                  }}
                >
                  <option value="" className="text-black">
                    Select a saved client profile
                  </option>
                  {clientProfiles.map((profile) => (
                    <option key={profile.id} value={profile.id} className="text-black">
                      {profile.companyName}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-2xl font-semibold">Invoice Details</h2>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm text-white/70">Invoice number</span>
                <input
                  className="w-full rounded-2xl border border-white/10 bg-white/5 p-3 text-white placeholder-white/35 outline-none"
                  placeholder="202603-01"
                  value={invoiceNumber}
                  onChange={(e) => {
                    switchToDraftPreview();
                    setInvoiceNumber(e.target.value);
                  }}
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm text-white/70">Invoice date</span>
                <input
                  className="w-full rounded-2xl border border-white/10 bg-white/5 p-3 text-white outline-none"
                  type="date"
                  min={minDate}
                  max={today}
                  value={invoiceDate}
                  onChange={(e) => {
                    switchToDraftPreview();
                    setInvoiceDate(e.target.value);
                  }}
                />
                <p className="text-xs text-white/45">
                  This is the date printed on the invoice document.
                </p>
              </label>

              <label className="space-y-2">
                <span className="text-sm text-white/70">Service period</span>
                <input
                  className="w-full rounded-2xl border border-white/10 bg-white/5 p-3 text-white placeholder-white/35 outline-none"
                  placeholder="March 2026"
                  value={periodLabel}
                  onChange={(e) => {
                    switchToDraftPreview();
                    setPeriodLabel(e.target.value);
                  }}
                />
                <p className="text-xs text-white/45">
                  Example: “March 2026” or “Q1 2026”.
                </p>
              </label>

              <label className="space-y-2 md:max-w-[14rem]">
                <span className="text-sm text-white/70">Payment terms (days)</span>
                <input
                  className="w-full rounded-2xl border border-white/10 bg-white/5 p-3 text-white placeholder-white/35 outline-none"
                  type="number"
                  min="1"
                  value={resolvedPaymentTermsDays}
                  onChange={(e) => {
                    switchToDraftPreview();
                    setPaymentTermsDays(e.target.value);
                  }}
                />
                <p className="text-xs text-white/45">
                  Due date will be calculated automatically.
                </p>
              </label>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-2xl font-semibold">Work and VAT</h2>
            <div className="mt-5 grid gap-4">
              <label className="space-y-2">
                <span className="text-sm text-white/70">Description</span>
                <textarea
                  className="min-h-28 w-full rounded-2xl border border-white/10 bg-white/5 p-3 text-white placeholder-white/35 outline-none"
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
                  <span className="text-sm text-white/70">Hours</span>
                  <input
                    className="w-full rounded-2xl border border-white/10 bg-white/5 p-3 text-white placeholder-white/35 outline-none"
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
                  <span className="text-sm text-white/70">Rate (EUR)</span>
                  <input
                    className="w-full rounded-2xl border border-white/10 bg-white/5 p-3 text-white placeholder-white/35 outline-none"
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
                  <span className="text-sm text-white/70">BTW / VAT</span>
                  <select
                    className="w-full rounded-2xl border border-white/10 bg-white/5 p-3 text-white outline-none"
                    value={vatSelection}
                    onChange={(e) => {
                      switchToDraftPreview();
                      setVatSelection(e.target.value);
                    }}
                  >
                    {VAT_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value} className="text-black">
                        VAT {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {vatSelection === 'custom' && (
                <label className="max-w-[14rem] space-y-2">
                  <span className="text-sm text-white/70">Custom VAT %</span>
                  <input
                    className="w-full rounded-2xl border border-white/10 bg-white/5 p-3 text-white placeholder-white/35 outline-none"
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
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="text-sm text-white/50">Subtotal</div>
                  <div className="mt-2 text-2xl font-semibold">{formatCurrency(subtotal)}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="text-sm text-white/50">VAT {effectiveVatRate}%</div>
                  <div className="mt-2 text-2xl font-semibold">{formatCurrency(calculatedVatAmount)}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="text-sm text-white/50">Total incl. VAT</div>
                  <div className="mt-2 text-2xl font-semibold">{formatCurrency(calculatedTotal)}</div>
                </div>
              </div>
            </div>

            {error && (
              <div className="mt-5 rounded-2xl border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-200">
                {error}
              </div>
            )}

            <button
              onClick={addInvoice}
              className="mt-5 rounded-2xl bg-cyan-400 px-4 py-3 font-medium text-black hover:opacity-90"
            >
              Save invoice
            </button>
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
                    Select a saved client profile to fill this section.
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
            <div className="no-print rounded-3xl border border-amber-300/20 bg-amber-300/10 p-5 text-sm text-amber-100">
              Your business profile is not complete yet. Add your invoice details on the Profiles page before saving invoices.
            </div>
          )}

          {clientProfiles.length === 0 && (
            <div className="no-print rounded-3xl border border-amber-300/20 bg-amber-300/10 p-5 text-sm text-amber-100">
              No client profiles saved yet. Add one on the Profiles page so the invoice To section can be filled automatically.
            </div>
          )}
        </div>
      </section>

      <section className="no-print space-y-3">
        <div>
          <h2 className="text-2xl font-semibold">Saved invoices</h2>
          <p className="mt-2 text-sm text-white/60">
            Load a saved invoice into the preview or download a clean one-page PDF from the Print button.
          </p>
        </div>

        {storedInvoices.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-white/70">
            No invoices yet.
          </div>
        ) : (
          storedInvoices.map((invoice) => {
            if (isInvoiceRecord(invoice)) {
              return (
                <div
                  key={invoice.id}
                  className="rounded-3xl border border-white/10 bg-white/5 p-6"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="text-lg font-semibold">{invoice.invoiceNumber}</div>
                      <div className="mt-1 text-sm text-white/60">
                        {invoice.clientProfile.companyName} · {invoice.periodLabel}
                      </div>
                    </div>

                    <div className="text-sm text-white/60">
                      <div>Invoice date: {formatDate(invoice.invoiceDate)}</div>
                      <div>Due date: {formatDate(invoice.dueDate)}</div>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-4">
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                      <div className="text-xs uppercase tracking-[0.14em] text-white/45">Hours</div>
                      <div className="mt-2 text-xl font-semibold">{invoice.hours}</div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                      <div className="text-xs uppercase tracking-[0.14em] text-white/45">Rate</div>
                      <div className="mt-2 text-xl font-semibold">{formatCurrency(invoice.rate)}</div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                      <div className="text-xs uppercase tracking-[0.14em] text-white/45">VAT</div>
                      <div className="mt-2 text-xl font-semibold">{formatCurrency(invoice.vatAmount)}</div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                      <div className="text-xs uppercase tracking-[0.14em] text-white/45">Total</div>
                      <div className="mt-2 text-xl font-semibold">{formatCurrency(invoice.totalAmount)}</div>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      onClick={() => loadSavedInvoice(invoice)}
                      className="rounded-full border border-white/10 px-4 py-2 text-sm hover:bg-white/10"
                    >
                      Load
                    </button>
                    <button
                      onClick={() => printSavedInvoice(invoice)}
                      className="rounded-full bg-cyan-400 px-4 py-2 text-sm font-medium text-black hover:opacity-90"
                    >
                      Print
                    </button>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={invoice.id}
                className="rounded-3xl border border-white/10 bg-white/5 p-6"
              >
                <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="text-lg font-semibold">{invoice.invoiceNumber}</div>
                    <div className="text-sm text-white/60">{invoice.client}</div>
                  </div>

                  <div className="text-sm text-white/60">
                    <div>Issued: {formatDate(invoice.issueDate)}</div>
                    <div>Due: {formatDate(invoice.dueDate)}</div>
                  </div>
                </div>

                <div className="mt-4 space-y-1 text-sm text-white/80">
                  <div>Description: {invoice.description}</div>
                  <div>Ex VAT: {formatCurrency(invoice.amountExVat)}</div>
                  <div>VAT rate: {invoice.vatRate}%</div>
                  <div>VAT: {formatCurrency(invoice.vatAmount)}</div>
                  <div>Total: {formatCurrency(invoice.totalAmount)}</div>
                </div>
              </div>
            );
          })
        )}
      </section>
    </main>
  );
}
