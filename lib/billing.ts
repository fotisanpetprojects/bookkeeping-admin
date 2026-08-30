'use client';

export type BusinessProfile = {
  businessName: string;
  contactName: string;
  streetAddress: string;
  postalCodeCity: string;
  kvkNumber: string;
  vatNumber: string;
  iban: string;
  bankName: string;
  paymentTermsDays: string;
  letterheadDataUrl: string;
};

export type SavedBusinessProfile = BusinessProfile & {
  id: number;
};

export type ClientProfile = {
  id: number;
  companyName: string;
  attentionName: string;
  streetAddress: string;
  postalCodeCity: string;
  kvkNumber: string;
  vatNumber: string;
};

export type InvoiceRecord = {
  id: number;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  periodLabel: string;
  description: string;
  hours: number;
  rate: number;
  subtotal: number;
  vatRate: number;
  vatAmount: number;
  totalAmount: number;
  paymentTermsDays: number;
  fromProfile: BusinessProfile;
  clientProfile: ClientProfile;
  /** ISO date the invoice was paid. Absent or empty means still outstanding. */
  paidDate?: string;
};

export type LegacyInvoice = {
  id: number;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  client: string;
  description: string;
  amountExVat: number;
  vatRate: number;
  vatAmount: number;
  totalAmount: number;
  /** ISO date the invoice was paid. Absent or empty means still outstanding. */
  paidDate?: string;
};

export type StoredInvoice = InvoiceRecord | LegacyInvoice;

export const VAT_OPTIONS = [
  { label: '21%', value: '21' },
  { label: '9%', value: '9' },
  { label: '0%', value: '0' },
  { label: 'Custom', value: 'custom' },
];

export const EMPTY_BUSINESS_PROFILE: BusinessProfile = {
  businessName: '',
  contactName: '',
  streetAddress: '',
  postalCodeCity: '',
  kvkNumber: '',
  vatNumber: '',
  iban: '',
  bankName: '',
  paymentTermsDays: '30',
  letterheadDataUrl: '',
};

export function createEmptyClientProfile(): ClientProfile {
  return {
    id: 0,
    companyName: '',
    attentionName: '',
    streetAddress: '',
    postalCodeCity: '',
    kvkNumber: '',
    vatNumber: '',
  };
}

export function toBusinessProfile(profile: SavedBusinessProfile): BusinessProfile {
  return {
    businessName: profile.businessName,
    contactName: profile.contactName,
    streetAddress: profile.streetAddress,
    postalCodeCity: profile.postalCodeCity,
    kvkNumber: profile.kvkNumber,
    vatNumber: profile.vatNumber,
    iban: profile.iban,
    bankName: profile.bankName,
    paymentTermsDays: profile.paymentTermsDays,
    letterheadDataUrl: profile.letterheadDataUrl || '',
  };
}

const euroFormatter = new Intl.NumberFormat('nl-NL', {
  style: 'currency',
  currency: 'EUR',
});

const dateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

export function getTodayString() {
  return new Date().toISOString().split('T')[0];
}

export function getMinDateString() {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 1);
  return d.toISOString().split('T')[0];
}

export function getMaxFutureDateString() {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().split('T')[0];
}

export function addDays(dateString: string, days: number) {
  const d = new Date(dateString);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

export function formatCurrency(value: number) {
  return euroFormatter.format(value);
}

export function formatDate(dateString: string) {
  if (!dateString) {
    return '—';
  }

  return dateFormatter.format(new Date(dateString));
}

export function isBusinessProfileComplete(profile: BusinessProfile) {
  return Boolean(
    profile.businessName.trim() &&
    profile.contactName.trim() &&
    profile.streetAddress.trim() &&
    profile.postalCodeCity.trim() &&
    profile.vatNumber.trim() &&
    profile.iban.trim()
  );
}

export function isClientProfileComplete(profile: ClientProfile) {
  return Boolean(
    profile.companyName.trim() &&
    profile.streetAddress.trim() &&
    profile.postalCodeCity.trim()
  );
}

export function isInvoiceRecord(invoice: StoredInvoice): invoice is InvoiceRecord {
  return 'invoiceDate' in invoice && 'fromProfile' in invoice && 'clientProfile' in invoice;
}

/** Round a euro amount to whole cents, avoiding float dust in stored totals. */
export function roundCents(value: number) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

/**
 * Sum euro amounts in integer cents. Adding floats directly lets rounding error
 * accumulate across many rows, which matters on figures that go onto a filing.
 */
export function sumEuros(values: number[]) {
  const cents = values.reduce((total, value) => {
    return total + Math.round((Number(value) || 0) * 100);
  }, 0);

  return cents / 100;
}

/** Calendar quarter (1-4) for an ISO date string. */
export function getQuarter(dateString: string) {
  const month = new Date(dateString).getMonth() + 1;
  if (month <= 3) return 1;
  if (month <= 6) return 2;
  if (month <= 9) return 3;
  return 4;
}

/** The date an invoice was issued, across both the current and legacy shapes. */
export function getInvoiceDate(invoice: StoredInvoice) {
  return isInvoiceRecord(invoice) ? invoice.invoiceDate : invoice.issueDate;
}

/** The net (ex VAT) amount of an invoice, across both the current and legacy shapes. */
export function getInvoiceNetAmount(invoice: StoredInvoice) {
  return isInvoiceRecord(invoice) ? invoice.subtotal : invoice.amountExVat;
}

/** The client label for an invoice, across both the current and legacy shapes. */
export function getInvoiceClientName(invoice: StoredInvoice) {
  return isInvoiceRecord(invoice) ? invoice.clientProfile.companyName : invoice.client;
}

/** An invoice counts as paid once it carries a payment date. */
export function isInvoicePaid(invoice: StoredInvoice) {
  return Boolean(invoice.paidDate);
}

/**
 * Outstanding invoices past their due date. Invoices with no due date are never
 * treated as overdue, since we cannot know.
 */
export function isInvoiceOverdue(invoice: StoredInvoice, today = getTodayString()) {
  return !isInvoicePaid(invoice) && Boolean(invoice.dueDate) && invoice.dueDate < today;
}

/** Calendar year of an invoice, or NaN when the date is unusable. */
export function getInvoiceYear(invoice: StoredInvoice) {
  const date = new Date(getInvoiceDate(invoice));
  return date.getFullYear();
}

const euroWholeFormatter = new Intl.NumberFormat('nl-NL', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});

/** Euro without cents, for tight spaces like a donut centre or axis tick. */
export function formatEuroWhole(value: number) {
  return euroWholeFormatter.format(value);
}

/**
 * Bookkeeping only ever covers a handful of years around now. A mistyped date
 * (year 3000, year 20) would otherwise create its own quarter and sit in every
 * year picker, so implausible years are reported rather than silently charted.
 */
export function isPlausibleBookkeepingYear(year: number, referenceYear = new Date().getFullYear()) {
  return Number.isFinite(year) && year >= 2000 && year <= referenceYear + 5;
}

/** True when a date string is both parseable and in a plausible bookkeeping year. */
export function isUsableBookkeepingDate(dateString: string) {
  if (!dateString) return false;
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return false;
  return isPlausibleBookkeepingYear(date.getFullYear());
}

/** Earliest date the forms accept: far enough back to backfill previous years. */
export function getBackfillMinDateString() {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 5);
  return d.toISOString().split('T')[0];
}
