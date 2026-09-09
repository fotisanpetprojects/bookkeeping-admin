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
  /**
   * Whether transfers involving this account count as moving your own money.
   *
   * Undefined means yes: an imported account is yours, so by default a payment
   * between it and another of yours is not income or spending. Setting it to false
   * opts out, and the transfers are counted like anyone else's.
   *
   * It has to be a real switch rather than a hint, because otherwise turning it off
   * appears to do nothing — detection would simply carry on regardless, which is
   * exactly how it behaved before.
   */
  internalOnly?: boolean;
};

export const ACCOUNT_LABELS_KEY = 'account-labels';

/**
 * Dot colours, one per account. These are name tags rather than a scale — nothing
 * is being measured — so they only have to stay apart from each other and stay
 * legible on both surfaces. Ten is well past the point where colour alone can carry
 * meaning, which is why the name always sits beside the dot.
 */
export const ACCOUNT_COLOURS = [
  '#2a78d6', '#1baf7a', '#eb6834', '#8b5cf6', '#d6a02a',
  '#0ea5b7', '#e0559a', '#5b7cc4', '#7a9c3d', '#b4553d',
];

export function accountColour(accounts: string[], account: string) {
  const index = accounts.findIndex((entry) => normaliseAccount(entry) === normaliseAccount(account));
  return ACCOUNT_COLOURS[(index < 0 ? 0 : index) % ACCOUNT_COLOURS.length];
}

export function labelFor(labels: AccountLabel[], account: string): AccountLabel {
  const key = normaliseAccount(account);
  const found = labels.find((label) => normaliseAccount(label.account) === key);

  return found ?? { account: key, name: '', kind: 'personal' };
}

/**
 * The accounts whose transfers count as moving your own money: every imported one
 * except those switched off, plus any declared by hand.
 */
export function internalAccounts(labels: AccountLabel[], imported: string[]) {
  const optedOut = new Set(
    labels
      .filter((label) => label.internalOnly === false)
      .map((label) => normaliseAccount(label.account))
  );

  const declared = labels
    .filter((label) => label.internalOnly === true)
    .map((label) => normaliseAccount(label.account));

  const included = imported
    .map(normaliseAccount)
    .filter((account) => account && !optedOut.has(account));

  return new Set([...included, ...declared]);
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
