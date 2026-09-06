/**
 * Aggregations behind the finance overview.
 *
 * Everything here is derived from imported transactions and holds to one rule:
 * a figure is either measured or clearly marked as a projection. Transfers are
 * excluded from spending throughout — moving money between your own accounts or
 * repaying a card is not a cost, and counting it would inflate every total on
 * the page.
 */

import { type BankTransaction, normaliseAccount } from './bank.ts';
import { CATEGORIES, type CategoryId } from './categories.ts';

/** Categories that describe movement rather than consumption. */
const NOT_SPENDING: CategoryId[] = ['transfers', 'investments', 'income'];

const FIXED = new Set(CATEGORIES.filter((category) => category.fixed).map((c) => c.id));

export function isSpending(transaction: BankTransaction) {
  return transaction.amount < 0 && !NOT_SPENDING.includes(transaction.category);
}

/**
 * Finds merchants you pay on a regular cadence for a steady amount — a gym, a
 * phone plan, an insurer.
 *
 * Whether a cost is fixed is a property of the payment pattern, not of the
 * category it happens to sit in. A gym filed under "sports & hobbies" is still a
 * monthly commitment, and reading that off the data is both more accurate and
 * more honest than hard-coding which categories count as fixed.
 *
 * The deciding signal is how the money leaves, not how regular it looks. A direct
 * debit is a standing arrangement someone else collects on; a card payment is a
 * decision you make each time. A barber visited monthly for the same price would
 * otherwise read as a commitment, when in truth you could simply stop going.
 *
 * On top of that the test is about cadence, not amount: does this merchant collect
 * in most months across the span it has been active? Amount is deliberately not
 * checked, because subscriptions raise their prices and metered bills like energy
 * vary every month — a gym going from 29.99 to 37.99 mid-year is still a gym
 * membership.
 */
const PULL_PAYMENT_CODES = new Set([
  'IC', // SEPA direct debit — the collector decides when
  'DV', // bank's own charges
  'VZ', // standing batch payment
]);

export function detectRecurring(transactions: BankTransaction[]) {
  const byMerchant = new Map<string, BankTransaction[]>();

  for (const transaction of transactions) {
    if (transaction.amount >= 0) continue;
    if (!PULL_PAYMENT_CODES.has(transaction.code)) continue;
    const key = merchantKey(transaction.description);
    byMerchant.set(key, [...(byMerchant.get(key) ?? []), transaction]);
  }

  const recurring = new Set<string>();

  for (const [key, group] of byMerchant) {
    if (group.length < 3) continue;

    const months = [...new Set(group.map((t) => t.date.slice(0, 7)))].sort();
    if (months.length < 3) continue;

    // How many months it could have collected in, from first charge to last.
    const [firstYear, firstMonth] = months[0].split('-').map(Number);
    const [lastYear, lastMonth] = months[months.length - 1].split('-').map(Number);
    const span = (lastYear - firstYear) * 12 + (lastMonth - firstMonth) + 1;

    // Present in most months of its own active span — that is a standing arrangement.
    if (months.length / span >= 0.6) {
      recurring.add(key);
    }
  }

  return recurring;
}

/** A cost is fixed if its category says so, or if the payments look like a subscription. */
export function isFixedCommitment(transaction: BankTransaction, recurring: Set<string>) {
  return FIXED.has(transaction.category) || recurring.has(merchantKey(transaction.description));
}

export type MonthPoint = {
  month: string;
  moneyIn: number;
  spending: number;
  cumulativeIn: number;
  cumulativeSpending: number;
  actual: boolean;
};

export type CategoryTotal = {
  category: CategoryId;
  total: number;
  count: number;
  fixed: boolean;
  share: number;
};

export type IncomeSource = {
  key: string;
  label: string;
  total: number;
  count: number;
  share: number;
};

export type FinanceSummary = {
  year: number;
  months: MonthPoint[];
  categories: CategoryTotal[];
  incomeSources: IncomeSource[];
  moneyIn: number;
  spending: number;
  net: number;
  fixedSpend: number;
  discretionarySpend: number;
  unknownSpend: number;
  unknownCount: number;
  monthsWithData: number;
  /** Days of the year the import actually covers — the projection's basis. */
  daysCovered: number;
  /** Straight-line to 31 December from the monthly average so far. */
  projectedSpending: number;
  projectedIn: number;
  projectedNet: number;
  averageMonthlySpend: number;
  latestBalance: number | null;
  /** Money arriving from your own other accounts — shown, never counted as income. */
  internalIn: number;
  internalOut: number;
  internalCount: number;
};

function isLeapYear(year: number) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function daysBetween(from: string, to: string) {
  const ms = Date.parse(`${to}T00:00:00`) - Date.parse(`${from}T00:00:00`);
  return Math.max(0, Math.round(ms / 86400000));
}

export function availableAccounts(transactions: BankTransaction[]) {
  return [...new Set(transactions.map((t) => t.account).filter(Boolean))].sort();
}

/**
 * A payment from one of your own accounts into another is not income or spending —
 * it is the same money, seen twice.
 *
 * The test is the counterparty account number, not the amount and date. Matching on
 * those was a guess that broke the moment a transfer settled a day later or was sent
 * in two parts; the account number is simply a fact. Banks fill it in on transfers
 * and direct debits and leave it blank on card payments, which is exactly the split
 * that matters here.
 *
 * Without this, an incoming transfer from your own business account counts as income
 * on top of the revenue that funded it, and a year looks far better than it was.
 */
export function markInternalTransfers(transactions: BankTransaction[]) {
  const mine = new Set(transactions.map((t) => normaliseAccount(t.account)).filter(Boolean));
  if (mine.size < 2) return transactions;

  return transactions.map((transaction) => {
    if (transaction.manualCategory) return transaction;
    if (!transaction.counterparty || !mine.has(transaction.counterparty)) return transaction;

    return { ...transaction, category: 'transfers' as CategoryId, internalTransfer: true };
  });
}

export function availableYears(transactions: BankTransaction[]) {
  const years = new Set(transactions.map((t) => Number(t.date.slice(0, 4))));
  return [...years].filter((y) => Number.isFinite(y)).sort((a, b) => b - a);
}

export function summarise(transactions: BankTransaction[], year: number): FinanceSummary {
  const inYear = transactions.filter((t) => t.date.startsWith(String(year)));

  const monthly = Array.from({ length: 12 }, () => ({ moneyIn: 0, spending: 0, seen: false }));

  for (const transaction of inYear) {
    const index = Number(transaction.date.slice(5, 7)) - 1;
    if (index < 0 || index > 11) continue;

    monthly[index].seen = true;

    if (transaction.amount > 0 && transaction.category !== 'transfers') {
      monthly[index].moneyIn += transaction.amount;
    } else if (isSpending(transaction)) {
      monthly[index].spending += Math.abs(transaction.amount);
    }
  }

  const lastMonthWithData = monthly.reduce((last, month, index) => (month.seen ? index : last), -1);

  let cumulativeIn = 0;
  let cumulativeSpending = 0;
  const months: MonthPoint[] = monthly.map((month, index) => {
    const actual = index <= lastMonthWithData;
    if (actual) {
      cumulativeIn += month.moneyIn;
      cumulativeSpending += month.spending;
    }
    return {
      month: new Date(year, index, 1).toISOString().slice(0, 7),
      moneyIn: month.moneyIn,
      spending: month.spending,
      cumulativeIn,
      cumulativeSpending,
      actual,
    };
  });

  const spendingTransactions = inYear.filter(isSpending);
  const spending = spendingTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);

  const incomeTransactions = inYear.filter((t) => t.amount > 0 && t.category !== 'transfers');
  const moneyIn = incomeTransactions.reduce((sum, t) => sum + t.amount, 0);

  // Recurrence is measured over everything imported, not just this year, so a
  // subscription is still recognised in January.
  const recurring = detectRecurring(transactions);

  const totals = new Map<CategoryId, { total: number; count: number; fixedAmount: number }>();
  for (const transaction of spendingTransactions) {
    const current = totals.get(transaction.category) ?? { total: 0, count: 0, fixedAmount: 0 };
    const amount = Math.abs(transaction.amount);
    current.total += amount;
    current.count += 1;
    if (isFixedCommitment(transaction, recurring)) {
      current.fixedAmount += amount;
    }
    totals.set(transaction.category, current);
  }

  const categories: CategoryTotal[] = [...totals.entries()]
    .map(([category, value]) => ({
      category,
      total: value.total,
      count: value.count,
      // A category counts as fixed when most of its money is recurring, so a gym
      // filed under sports still reads as a commitment.
      fixed: value.fixedAmount / value.total >= 0.5,
      share: spending > 0 ? value.total / spending : 0,
    }))
    .sort((a, b) => b.total - a.total);

  // Where the money comes from, grouped by payer.
  const sources = new Map<string, { label: string; total: number; count: number }>();
  for (const transaction of incomeTransactions) {
    const key = merchantKey(transaction.description);
    const current = sources.get(key) ?? { label: transaction.description, total: 0, count: 0 };
    current.total += transaction.amount;
    current.count += 1;
    sources.set(key, current);
  }

  const incomeSources: IncomeSource[] = [...sources.entries()]
    .map(([key, value]) => ({
      key,
      label: value.label,
      total: value.total,
      count: value.count,
      share: moneyIn > 0 ? value.total / moneyIn : 0,
    }))
    .sort((a, b) => b.total - a.total);

  const monthsWithData = lastMonthWithData + 1;

  // Project on days actually covered, not months seen. A statement ending on the
  // 4th would otherwise count September as a whole month of low spending and
  // drag the whole year's forecast down with it.
  const dates = inYear.map((t) => t.date).sort();
  const daysCovered = dates.length > 0 ? daysBetween(`${year}-01-01`, dates[dates.length - 1]) + 1 : 0;
  const daysInYear = isLeapYear(year) ? 366 : 365;
  const scale = daysCovered > 0 ? daysInYear / daysCovered : 0;

  const averageMonthlySpend = daysCovered > 0 ? (spending / daysCovered) * (daysInYear / 12) : 0;

  const projectedSpending = spending * scale;
  const projectedIn = moneyIn * scale;

  // Each account has its own running balance; summing the latest of each gives the
  // total holding. Mixing two ledgers into one "latest" would be meaningless.
  const perAccount = new Map<string, BankTransaction>();
  for (const transaction of inYear) {
    if (transaction.balance === null) continue;
    const current = perAccount.get(transaction.account);
    if (!current || transaction.date >= current.date) {
      perAccount.set(transaction.account, transaction);
    }
  }
  const latestBalance = perAccount.size > 0
    ? [...perAccount.values()].reduce((sum, t) => sum + (t.balance ?? 0), 0)
    : null;

  return {
    year,
    months,
    categories,
    incomeSources,
    moneyIn,
    spending,
    net: moneyIn - spending,
    // Summed per transaction rather than per category, so a recurring charge counts
    // as fixed even when the rest of its category is not.
    fixedSpend: spendingTransactions
      .filter((t) => isFixedCommitment(t, recurring))
      .reduce((sum, t) => sum + Math.abs(t.amount), 0),
    discretionarySpend: spendingTransactions
      .filter((t) => !isFixedCommitment(t, recurring))
      .reduce((sum, t) => sum + Math.abs(t.amount), 0),
    unknownSpend: totals.get('unknown')?.total ?? 0,
    unknownCount: totals.get('unknown')?.count ?? 0,
    monthsWithData,
    daysCovered,
    internalIn: inYear
      .filter((t) => t.internalTransfer && t.amount > 0)
      .reduce((sum, t) => sum + t.amount, 0),
    internalOut: inYear
      .filter((t) => t.internalTransfer && t.amount < 0)
      .reduce((sum, t) => sum + Math.abs(t.amount), 0),
    internalCount: inYear.filter((t) => t.internalTransfer).length,
    projectedSpending,
    projectedIn,
    projectedNet: projectedIn - projectedSpending,
    averageMonthlySpend,
    latestBalance,
  };
}

/**
 * Groups uncategorised rows by merchant, so one decision can settle many
 * transactions instead of the user working through them line by line.
 */
export function unknownByMerchant(transactions: BankTransaction[], year: number) {
  const groups = new Map<string, { key: string; label: string; count: number; total: number; ids: string[] }>();

  for (const transaction of transactions) {
    if (transaction.category !== 'unknown' || !transaction.date.startsWith(String(year))) continue;

    const key = merchantKey(transaction.description);
    const group = groups.get(key) ?? { key, label: transaction.description, count: 0, total: 0, ids: [] };
    group.count += 1;
    group.total += Math.abs(transaction.amount);
    group.ids.push(transaction.id);
    groups.set(key, group);
  }

  return [...groups.values()].sort((a, b) => b.total - a.total);
}

/** Collapses the noise banks add around a merchant name so repeats group together. */
export function merchantKey(description: string) {
  return description
    .toUpperCase()
    .replace(/^(CCV\*|ZTL\*|SUMUP ?\*|IZ\*|MSP\*|BCK\*|ZETTLE\*|PAYPAL ?\*)/, '')
    .replace(/\s+(NLD|GRC|AMSTERDAM|ROTTERDAM|UTRECHT|DEN HAAG)\b/g, ' ')
    .replace(/\s+\d{2,}$/, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 26);
}
