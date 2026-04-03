'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
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
        className="inline-block rounded-full border border-white/10 px-4 py-2 text-sm hover:bg-white/10"
      >
        ← Back
      </Link>

      <div>
        <h1 className="text-3xl font-semibold">Invoices</h1>
        <p className="mt-2 text-sm text-white/60">
          Build invoices from saved profiles and generate VAT totals from hours and rate.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
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

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="space-y-6">
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
                    onChange={(e) => setSelectedBusinessId(e.target.value)}
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
                  onChange={(e) => setSelectedClientId(e.target.value)}
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
                  onChange={(e) => setInvoiceNumber(e.target.value)}
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
                  onChange={(e) => setInvoiceDate(e.target.value)}
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
                  onChange={(e) => setPeriodLabel(e.target.value)}
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
                  onChange={(e) => setPaymentTermsDays(e.target.value)}
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
                  placeholder="Consultancy services for FedEx project"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
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
                    onChange={(e) => setHours(e.target.value)}
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
                    onChange={(e) => setRate(e.target.value)}
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm text-white/70">BTW / VAT</span>
                  <select
                    className="w-full rounded-2xl border border-white/10 bg-white/5 p-3 text-white outline-none"
                    value={vatSelection}
                    onChange={(e) => setVatSelection(e.target.value)}
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
                    onChange={(e) => setCustomVatRate(e.target.value)}
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

        <div className="space-y-6">
          <div className="overflow-hidden rounded-[2rem] border border-[#d8d0c0] bg-[#f6efe1] text-slate-900 shadow-[0_30px_80px_rgba(0,0,0,0.25)]">
            <div className="border-b border-[#d8d0c0] px-6 py-5">
              <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Invoice Preview</div>
              <div className="mt-2 text-3xl font-semibold">INVOICE</div>
            </div>

            <div className="grid gap-8 px-6 py-6 md:grid-cols-2">
              <div>
                <div className="mb-3 text-xs uppercase tracking-[0.18em] text-slate-500">From</div>
                <div className="space-y-1 text-sm text-slate-800">
                  <div className="text-lg font-semibold">
                    {businessProfile.businessName || 'Your business name'}
                  </div>
                  <div>{businessProfile.contactName || 'Contact name'}</div>
                  <div>{businessProfile.streetAddress || 'Street and number'}</div>
                  <div>{businessProfile.postalCodeCity || 'Postal code and city'}</div>
                  <div>KvK: {businessProfile.kvkNumber || '—'}</div>
                  <div>BTW: {businessProfile.vatNumber || '—'}</div>
                  <div>IBAN: {businessProfile.iban || '—'}</div>
                </div>
              </div>

              <div>
                <div className="mb-3 text-xs uppercase tracking-[0.18em] text-slate-500">To</div>
                {selectedClientProfile ? (
                  <div className="space-y-1 text-sm text-slate-800">
                    <div className="text-lg font-semibold">{selectedClientProfile.companyName}</div>
                    {selectedClientProfile.attentionName && (
                      <div>{selectedClientProfile.attentionName}</div>
                    )}
                    <div>{selectedClientProfile.streetAddress}</div>
                    <div>{selectedClientProfile.postalCodeCity}</div>
                    <div>KvK: {selectedClientProfile.kvkNumber || '—'}</div>
                    <div>BTW: {selectedClientProfile.vatNumber || '—'}</div>
                  </div>
                ) : (
                  <div className="text-sm text-slate-500">
                    Select a saved client profile to fill this section.
                  </div>
                )}
              </div>
            </div>

            <div className="grid gap-6 border-y border-[#d8d0c0] px-6 py-5 md:grid-cols-2">
              <div className="space-y-2 text-sm text-slate-800">
                <div>Invoice Date: {formatDate(invoiceDate)}</div>
                <div>Invoice Number: {invoiceNumber || '—'}</div>
                <div>Period: {periodLabel || '—'}</div>
              </div>
              <div className="space-y-2 text-sm text-slate-800">
                <div>Payment Terms: {resolvedPaymentTermsDays} days</div>
                <div>Due Date: {formatDate(dueDate)}</div>
                <div>Bank: {businessProfile.bankName || '—'} – {businessProfile.iban || '—'}</div>
              </div>
            </div>

            <div className="px-6 py-6">
              <div className="grid grid-cols-[1.5fr_0.45fr_0.55fr_0.7fr] gap-3 text-xs uppercase tracking-[0.14em] text-slate-500">
                <div>Description</div>
                <div>Hours</div>
                <div>Rate (EUR)</div>
                <div>Amount (EUR)</div>
              </div>
              <div className="mt-3 grid grid-cols-[1.5fr_0.45fr_0.55fr_0.7fr] gap-3 text-sm text-slate-800">
                <div>{description || 'Consultancy services for project work'}</div>
                <div>{hours || '0'}</div>
                <div>{rate ? formatCurrency(Number(rate)) : formatCurrency(0)}</div>
                <div>{formatCurrency(subtotal)}</div>
              </div>

              <div className="mt-8 space-y-3 border-t border-[#d8d0c0] pt-4 text-sm text-slate-800">
                <div className="flex items-center justify-between">
                  <span>Subtotal (excl. BTW)</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>BTW {effectiveVatRate}%</span>
                  <span>{formatCurrency(calculatedVatAmount)}</span>
                </div>
                <div className="flex items-center justify-between text-base font-semibold">
                  <span>Total (incl. BTW)</span>
                  <span>{formatCurrency(calculatedTotal)}</span>
                </div>
              </div>

              <div className="mt-8 border-t border-[#d8d0c0] pt-4 text-sm text-slate-700">
                Payment Terms: {resolvedPaymentTermsDays} days
                <br />
                Bank: {businessProfile.bankName || '—'} – IBAN {businessProfile.iban || '—'} – {businessProfile.businessName || 'Your business'}
              </div>
            </div>
          </div>

          {!isBusinessProfileComplete(businessProfile) && (
            <div className="rounded-3xl border border-amber-300/20 bg-amber-300/10 p-5 text-sm text-amber-100">
              Your business profile is not complete yet. Add your invoice details on the Profiles page before saving invoices.
            </div>
          )}

          {clientProfiles.length === 0 && (
            <div className="rounded-3xl border border-amber-300/20 bg-amber-300/10 p-5 text-sm text-amber-100">
              No client profiles saved yet. Add one on the Profiles page so the invoice To section can be filled automatically.
            </div>
          )}
        </div>
      </section>

      <div className="space-y-3">
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
      </div>
    </main>
  );
}
