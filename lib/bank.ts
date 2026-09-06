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

import { type CategoryId, categorise } from './categories.ts';

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
  /** Which of your accounts this belongs to — statements from several can coexist. */
  account: string;
  /**
   * The other side's account number, where the bank gives one. Present on transfers
   * and direct debits, absent on card payments — which is exactly the split that
   * matters, since only a transfer can be one between your own accounts.
   */
  counterparty: string;
  category: CategoryId;
  /** A category the user set by hand is never overwritten by a re-import. */
  manualCategory?: boolean;
  /** Marks a private cost as a deductible business one. */
  business?: boolean;
  /** Money moved between two of your own accounts — excluded from both sides. */
  internalTransfer?: boolean;
};

export type ParseResult = {
  transactions: BankTransaction[];
  /** Lines that could not be read, so a partial import is never silent. */
  skipped: number;
  from: string;
  to: string;
  /** Accounts seen in this file. */
  accounts: string[];
};

/**
 * Column names seen across Dutch bank exports. ING ships English or Dutch headers
 * depending on the account language; Rabobank, ABN AMRO, bunq and Revolut each name
 * the same fields differently. Matching on a list of aliases costs nothing and means
 * a second bank usually just works.
 */
const COLUMNS = {
  date: ['date', 'datum', 'transactiedatum', 'boekingsdatum', 'started date', 'completed date'],
  description: [
    'name / description', 'naam / omschrijving', 'omschrijving', 'omschrijving-1',
    'naam tegenpartij', 'tegenrekening naam', 'description', 'naam',
  ],
  amount: ['amount (eur)', 'bedrag (eur)', 'bedrag', 'amount', 'bedrag eur', 'transactiebedrag'],
  direction: ['debit/credit', 'af bij', 'af/bij', 'debet/credit', 'bij/af'],
  code: ['code', 'mutatiecode', 'type'],
  method: ['transaction type', 'mutatiesoort', 'mededelingen', 'transactietype'],
  balance: ['resulting balance', 'saldo na mutatie', 'saldo', 'balance', 'saldo na trn'],
  account: ['account', 'rekening', 'rekeningnummer', 'iban/bban', 'iban'],
  counterparty: ['counterparty', 'tegenrekening', 'tegenrekening iban', 'iban tegenpartij'],
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

/**
 * Account numbers are compared, not displayed, so spacing and case must not decide
 * whether two references to the same account match.
 */
export function normaliseAccount(value: string | undefined | null) {
  // Transactions imported before the account and counterparty fields existed have
  // neither. They are still perfectly good records, so this has to tolerate their
  // absence rather than take the page down.
  return (value ?? '').replace(/\s+/g, '').toUpperCase();
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
function fingerprint(
  date: string,
  amount: number,
  description: string,
  balance: number | null,
  account: string
) {
  const normalised = description.toUpperCase().replace(/\s+/g, ' ').trim().slice(0, 60);
  // The running balance is what separates two identical purchases on the same day
  // from one purchase imported twice.
  const ledger = balance === null ? '' : balance.toFixed(2);
  return `${account}|${date}|${amount.toFixed(2)}|${normalised}|${ledger}`;
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
    account: findColumn(header, COLUMNS.account),
    counterparty: findColumn(header, COLUMNS.counterparty),
  };

  if (index.date < 0 || index.amount < 0 || index.description < 0) {
    throw new Error(
      `This importer could not find a date, description and amount column. It saw: ${header
        .filter(Boolean)
        .join(', ')}. It is written for Dutch bank exports (ING, Rabobank, ABN AMRO); if your bank names its columns differently, send an example and it can be added.`
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
    const account = (index.account >= 0 ? cells[index.account] ?? '' : '').trim();
    const base = fingerprint(date, amount, description, balance, account);
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
      account: (index.account >= 0 ? cells[index.account] ?? '' : '').trim(),
      counterparty: normaliseAccount(
        index.counterparty >= 0 ? cells[index.counterparty] ?? '' : ''
      ),
      category: categorise(description, code, isCredit),
    });
  }

  if (transactions.length === 0) {
    throw new Error('No transactions could be read from that file.');
  }

  const dates = transactions.map((transaction) => transaction.date).sort();

  const accounts = [...new Set(transactions.map((t) => t.account).filter(Boolean))];

  return { transactions, skipped, from: dates[0], to: dates[dates.length - 1], accounts };
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

    if (current.manualCategory) {
      // Keep the decision, take everything else fresh. Keeping the whole old row
      // would preserve the category but strand it without fields added since it was
      // imported — which is how a re-import silently fails to fix anything.
      byId.set(transaction.id, {
        ...transaction,
        category: current.category,
        manualCategory: true,
        business: current.business,
      });
      continue;
    }

    byId.set(transaction.id, { ...transaction, business: current.business });
  }

  const merged = [...byId.values()].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return { merged, added, duplicates: incoming.length - added };
}
