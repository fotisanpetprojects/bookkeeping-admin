/**
 * Aggregations behind the finance overview.
 *
 * Everything here is derived from imported transactions and holds to one rule:
 * a figure is either measured or clearly marked as a projection. Transfers are
 * excluded from spending throughout — moving money between your own accounts or
 * repaying a card is not a cost, and counting it would inflate every total on
 * the page.
 */

import { BankTransaction } from '@/lib/bank';
import { CATEGORIES, CategoryId } from '@/lib/categories';

/** Categories that describe movement rather than consumption. */
const NOT_SPENDING: CategoryId[] = ['transfers', 'investments', 'income'];

const FIXED = new Set(CATEGORIES.filter((category) => category.fixed).map((c) => c.id));

export function isSpending(transaction: BankTransaction) {
  return transaction.amount < 0 && !NOT_SPENDING.includes(transaction.category);
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

export type FinanceSummary = {
  year: number;
  months: MonthPoint[];
  categories: CategoryTotal[];
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
};

function isLeapYear(year: number) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function daysBetween(from: string, to: string) {
  const ms = Date.parse(`${to}T00:00:00`) - Date.parse(`${from}T00:00:00`);
  return Math.max(0, Math.round(ms / 86400000));
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
  const moneyIn = inYear
    .filter((t) => t.amount > 0 && t.category !== 'transfers')
    .reduce((sum, t) => sum + t.amount, 0);

  const totals = new Map<CategoryId, { total: number; count: number }>();
  for (const transaction of spendingTransactions) {
    const current = totals.get(transaction.category) ?? { total: 0, count: 0 };
    current.total += Math.abs(transaction.amount);
    current.count += 1;
    totals.set(transaction.category, current);
  }

  const categories: CategoryTotal[] = [...totals.entries()]
    .map(([category, value]) => ({
      category,
      total: value.total,
      count: value.count,
      fixed: FIXED.has(category),
      share: spending > 0 ? value.total / spending : 0,
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

  const withBalance = inYear.filter((t) => t.balance !== null);
  const latestBalance = withBalance.length > 0
    ? withBalance.reduce((latest, t) => (t.date >= latest.date ? t : latest), withBalance[0]).balance
    : null;

  return {
    year,
    months,
    categories,
    moneyIn,
    spending,
    net: moneyIn - spending,
    fixedSpend: categories.filter((c) => c.fixed).reduce((sum, c) => sum + c.total, 0),
    discretionarySpend: categories.filter((c) => !c.fixed).reduce((sum, c) => sum + c.total, 0),
    unknownSpend: totals.get('unknown')?.total ?? 0,
    unknownCount: totals.get('unknown')?.count ?? 0,
    monthsWithData,
    daysCovered,
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
