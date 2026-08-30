'use client';

import { roundCents } from '@/lib/billing';

export type TaxBracket = {
  /** Upper bound of the bracket, or null for the top bracket. */
  upTo: number | null;
  /** Percentage rate applied within this bracket. */
  rate: number;
};

export type TaxSettings = {
  zelfstandigenaftrek: number;
  startersaftrek: number;
  mkbVrijstellingPercent: number;
  brackets: TaxBracket[];
  heffingskortingen: number;
  zvwPercent: number;
  zvwMaxBase: number;
};

/**
 * Starting points only. These are editable on the page precisely because rates
 * change every year and the authoritative source is belastingdienst.nl — nothing
 * here should be treated as a filing figure.
 *
 * heffingskortingen defaults to 0 on purpose: tax credits reduce what you owe, so
 * leaving them out overestimates the bill. For a "set aside" number, erring high
 * is the safe direction.
 */
export const DEFAULT_TAX_SETTINGS: TaxSettings = {
  zelfstandigenaftrek: 1200,
  startersaftrek: 0,
  mkbVrijstellingPercent: 12.7,
  brackets: [
    { upTo: 38441, rate: 35.82 },
    { upTo: 76817, rate: 37.48 },
    { upTo: null, rate: 49.5 },
  ],
  heffingskortingen: 0,
  zvwPercent: 5.26,
  zvwMaxBase: 75864,
};

export type TaxBreakdown = {
  revenue: number;
  expenses: number;
  profit: number;
  ondernemersaftrek: number;
  profitAfterAftrek: number;
  mkbVrijstelling: number;
  taxableIncome: number;
  incomeTaxBeforeCredits: number;
  credits: number;
  incomeTax: number;
  zvw: number;
  totalTax: number;
  /** Total tax as a share of profit, for the "what rate am I really paying" line. */
  effectiveRate: number;
};

function taxFromBrackets(income: number, brackets: TaxBracket[]) {
  let remaining = income;
  let previousCeiling = 0;
  let total = 0;

  for (const bracket of brackets) {
    if (remaining <= 0) {
      break;
    }

    const ceiling = bracket.upTo ?? Infinity;
    const span = Math.max(0, ceiling - previousCeiling);
    const taxedHere = Math.min(remaining, span);

    total += taxedHere * (bracket.rate / 100);
    remaining -= taxedHere;
    previousCeiling = ceiling;
  }

  return total;
}

/**
 * Estimate income tax for a Dutch sole trader (ZZP), in the order the
 * Belastingdienst applies it: profit, ondernemersaftrek, MKB-winstvrijstelling,
 * box 1 brackets, tax credits, then the Zvw contribution.
 *
 * Every step is returned so the page can show the arithmetic rather than just a
 * number the reader has to trust.
 */
export function estimateIncomeTax(
  revenue: number,
  expenses: number,
  settings: TaxSettings
): TaxBreakdown {
  const profit = roundCents(revenue - expenses);

  // Ondernemersaftrek cannot create or deepen a loss.
  const requestedAftrek = settings.zelfstandigenaftrek + settings.startersaftrek;
  const ondernemersaftrek = roundCents(Math.min(Math.max(profit, 0), requestedAftrek));
  const profitAfterAftrek = roundCents(Math.max(0, profit - ondernemersaftrek));

  const mkbVrijstelling = roundCents(
    profitAfterAftrek * (settings.mkbVrijstellingPercent / 100)
  );
  const taxableIncome = roundCents(profitAfterAftrek - mkbVrijstelling);

  const incomeTaxBeforeCredits = roundCents(taxFromBrackets(taxableIncome, settings.brackets));
  const credits = roundCents(Math.min(settings.heffingskortingen, incomeTaxBeforeCredits));
  const incomeTax = roundCents(incomeTaxBeforeCredits - credits);

  const zvwBase = Math.min(taxableIncome, settings.zvwMaxBase);
  const zvw = roundCents(Math.max(0, zvwBase) * (settings.zvwPercent / 100));

  const totalTax = roundCents(incomeTax + zvw);

  return {
    revenue: roundCents(revenue),
    expenses: roundCents(expenses),
    profit,
    ondernemersaftrek,
    profitAfterAftrek,
    mkbVrijstelling,
    taxableIncome,
    incomeTaxBeforeCredits,
    credits,
    incomeTax,
    zvw,
    totalTax,
    effectiveRate: profit > 0 ? (totalTax / profit) * 100 : 0,
  };
}

/**
 * Format a Date as an ISO day string using its *local* parts. toISOString() would
 * convert to UTC first, which shifts a local midnight back a day in CET and made
 * the Q3 deadline read 30 October instead of 31 October.
 */
export function toLocalIsoDate(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** The Dutch BTW filing deadline: the last day of the month after the quarter. */
export function getBtwDeadline(year: number, quarter: number) {
  const deadlineMonth = quarter * 3; // 0-indexed month after the quarter ends
  const date = new Date(year, deadlineMonth + 1, 0);
  return date;
}

export function describeDeadline(date: Date, today = new Date()) {
  const msPerDay = 1000 * 60 * 60 * 24;
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const days = Math.round((date.getTime() - startOfToday.getTime()) / msPerDay);

  if (days < 0) {
    return { days, label: `${Math.abs(days)} days overdue`, overdue: true };
  }

  if (days === 0) {
    return { days, label: 'due today', overdue: false };
  }

  return { days, label: `in ${days} days`, overdue: false };
}
