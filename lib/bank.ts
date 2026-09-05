/**
 * Bank statement import.
 *
 * Parses a CSV export into transactions the app can reason about. Written
 * against ING's export, whose header ships in English or Dutch depending on the
 * account language, so columns are resolved by name in both.
 *
 * Two deliberate choices about what is NOT kept:
 *   - the free-text notification field, because it carries partial card numbers
 *     and adds nothing a category needs
 *   - nothing is uploaded anywhere; parsing happens in the browser and the result
 *     is stored locally, like every other record in this app
 */

import { CategoryId, categorise } from '@/lib/categories';

export type BankTransaction = {
  /** Stable across re-imports of an overlapping period, so nothing is doubled. */
  id: string;
  /** ISO yyyy-mm-dd. */
  date: string;
  description: string;
  /** Signed: negative is money out. */
  amount: number;
  balance: number | null;
  /** The bank's own label, e.g. "Payment terminal". */
  method: string;
  code: string;
  category: CategoryId;
  /** A category the user set by hand is never overwritten by a re-import. */
  manualCategory?: boolean;
  /** Marks a private cost as a deductible business one. */
  business?: boolean;
};

export type ParseResult = {
  transactions: BankTransaction[];
  /** Lines that could not be read, so a partial import is never silent. */
  skipped: number;
  from: string;
  to: string;
};

const COLUMNS = {
  date: ['date', 'datum'],
  description: ['name / description', 'naam / omschrijving', 'omschrijving'],
  amount: ['amount (eur)', 'bedrag (eur)', 'bedrag'],
  direction: ['debit/credit', 'af bij', 'af/bij'],
  code: ['code'],
  method: ['transaction type', 'mutatiesoort', 'mededelingen'],
  balance: ['resulting balance', 'saldo na mutatie'],
};

/** Splits one CSV line on `;` or `,`, honouring quotes and doubled quotes. */
function splitLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let cell = '';
  let quoted = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (quoted) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === delimiter) {
      cells.push(cell);
      cell = '';
    } else {
      cell += char;
    }
  }

  cells.push(cell);
  return cells.map((value) => value.trim());
}

function findColumn(header: string[], names: string[]) {
  return header.findIndex((column) => names.includes(column.toLowerCase().trim()));
}

/** "1.234,56" (Dutch) and "1234.56" (plain) both have to land on the same number. */
function parseAmount(raw: string): number | null {
  const cleaned = raw.replace(/[^0-9,.-]/g, '');
  if (!cleaned) return null;

  const value = cleaned.includes(',')
    ? Number(cleaned.replace(/\./g, '').replace(',', '.'))
    : Number(cleaned);

  return Number.isFinite(value) ? value : null;
}

/** Accepts yyyymmdd, yyyy-mm-dd and dd-mm-yyyy. */
function parseDate(raw: string): string | null {
  const value = raw.trim();

  if (/^\d{8}$/.test(value)) {
    return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  const dutch = value.match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/);
  if (dutch) {
    return `${dutch[3]}-${dutch[2]}-${dutch[1]}`;
  }

  return null;
}

/**
 * A fingerprint of the fields a bank will not change between exports. Re-importing
 * an overlapping range then updates rows instead of duplicating them.
 */
function fingerprint(date: string, amount: number, description: string, balance: number | null) {
  const normalised = description.toUpperCase().replace(/\s+/g, ' ').trim().slice(0, 60);
  // The running balance is what separates two identical purchases on the same day
  // from one purchase imported twice.
  const ledger = balance === null ? '' : balance.toFixed(2);
  return `${date}|${amount.toFixed(2)}|${normalised}|${ledger}`;
}

export function parseBankCsv(text: string): ParseResult {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter((line) => line.trim() !== '');

  if (lines.length < 2) {
    throw new Error('That file has no transactions in it.');
  }

  const delimiter = (lines[0].match(/;/g)?.length ?? 0) >= (lines[0].match(/,/g)?.length ?? 0) ? ';' : ',';
  const header = splitLine(lines[0], delimiter);

  const index = {
    date: findColumn(header, COLUMNS.date),
    description: findColumn(header, COLUMNS.description),
    amount: findColumn(header, COLUMNS.amount),
    direction: findColumn(header, COLUMNS.direction),
    code: findColumn(header, COLUMNS.code),
    method: findColumn(header, COLUMNS.method),
    balance: findColumn(header, COLUMNS.balance),
  };

  if (index.date < 0 || index.amount < 0 || index.description < 0) {
    throw new Error(
      'That CSV has no date, description and amount columns this importer recognises. It is written for a Dutch bank export such as ING.'
    );
  }

  const transactions: BankTransaction[] = [];
  const seen = new Map<string, number>();
  let skipped = 0;

  for (const line of lines.slice(1)) {
    const cells = splitLine(line, delimiter);
    const date = parseDate(cells[index.date] ?? '');
    const magnitude = parseAmount(cells[index.amount] ?? '');

    if (!date || magnitude === null) {
      skipped += 1;
      continue;
    }

    const direction = (cells[index.direction] ?? '').toLowerCase();
    // Some exports carry the sign on the amount instead of in its own column.
    const isCredit = index.direction >= 0
      ? direction.startsWith('credit') || direction.startsWith('bij')
      : magnitude > 0;

    const amount = isCredit ? Math.abs(magnitude) : -Math.abs(magnitude);
    const description = cells[index.description] ?? '';
    const code = (cells[index.code] ?? '').trim().toUpperCase();

    const balance = index.balance >= 0 ? parseAmount(cells[index.balance] ?? '') : null;

    // Two genuinely identical rows in one statement are still two payments. Counting
    // occurrences keeps them apart without making the id depend on row order.
    const base = fingerprint(date, amount, description, balance);
    const occurrence = (seen.get(base) ?? 0) + 1;
    seen.set(base, occurrence);

    transactions.push({
      id: occurrence === 1 ? base : `${base}#${occurrence}`,
      date,
      description,
      amount,
      balance,
      method: index.method >= 0 ? cells[index.method] ?? '' : '',
      code,
      category: categorise(description, code, isCredit),
    });
  }

  if (transactions.length === 0) {
    throw new Error('No transactions could be read from that file.');
  }

  const dates = transactions.map((transaction) => transaction.date).sort();

  return { transactions, skipped, from: dates[0], to: dates[dates.length - 1] };
}

/**
 * Adds new transactions to what is stored. A row already present keeps the
 * category it has, so re-importing never undoes a correction made by hand.
 */
export function mergeTransactions(existing: BankTransaction[], incoming: BankTransaction[]) {
  const byId = new Map(existing.map((transaction) => [transaction.id, transaction]));
  let added = 0;

  for (const transaction of incoming) {
    const current = byId.get(transaction.id);

    if (!current) {
      byId.set(transaction.id, transaction);
      added += 1;
      continue;
    }

    if (!current.manualCategory) {
      byId.set(transaction.id, { ...transaction, business: current.business });
    }
  }

  const merged = [...byId.values()].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return { merged, added, duplicates: incoming.length - added };
}
