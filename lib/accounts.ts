'use client';

/**
 * What each imported bank account is for.
 *
 * A business account and a personal one hold the same kind of rows and mean
 * completely different things. Money arriving in the business account is revenue,
 * already invoiced and already taxed as profit; money arriving in the personal one
 * is usually that same revenue being moved across. Adding them together answers no
 * useful question, so the app has to be told which is which.
 *
 * Untagged accounts are treated as personal, so nothing has to be configured before
 * the page works.
 */

import { type BankTransaction, normaliseAccount } from './bank.ts';

export type AccountKind = 'personal' | 'business';

export type AccountLabel = {
  /** Normalised account number, the key everything else joins on. */
  account: string;
  name: string;
  kind: AccountKind;
};

export const ACCOUNT_LABELS_KEY = 'account-labels';

export function labelFor(labels: AccountLabel[], account: string): AccountLabel {
  const key = normaliseAccount(account);
  const found = labels.find((label) => normaliseAccount(label.account) === key);

  return found ?? { account: key, name: '', kind: 'personal' };
}

export function kindOf(labels: AccountLabel[], account: string) {
  return labelFor(labels, account).kind;
}

/** The account's own name if it has one, otherwise the number itself. */
export function displayAccount(labels: AccountLabel[], account: string) {
  const label = labelFor(labels, account);
  return label.name.trim() || account;
}

export function transactionsForKind(
  transactions: BankTransaction[],
  labels: AccountLabel[],
  kind: AccountKind | 'all'
) {
  if (kind === 'all') return transactions;
  return transactions.filter((transaction) => kindOf(labels, transaction.account) === kind);
}
