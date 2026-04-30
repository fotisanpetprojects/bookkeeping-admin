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
