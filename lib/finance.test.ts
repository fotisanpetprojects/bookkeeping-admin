/**
 * Tests for the money arithmetic. Run with `npm test`.
 *
 * The failure mode these guard against is not a crash — it is a number that looks
 * plausible and is wrong, which is worse, because it gets believed.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import { type BankTransaction, mergeTransactions } from './bank.ts';
import { detectRecurring, isFixedCommitment, markInternalTransfers, summarise } from './finance.ts';

const BUSINESS = 'NL00BUSI0000000001';
const PERSONAL = 'NL00PERS0000000002';

function tx(over: Partial<BankTransaction> & { date: string; amount: number }): BankTransaction {
  return {
    id: `${over.date}-${over.amount}-${over.description ?? ''}-${over.account ?? ''}`,
    description: 'Something',
    balance: null,
    method: '',
    code: 'BA',
    account: PERSONAL,
    counterparty: '',
    category: 'unknown',
    ...over,
  };
}

test('money moved between your own accounts is not income, even days apart', () => {
  const rows = [
    // Real revenue into the business account.
    tx({ date: '2026-01-05', amount: 20_000, account: BUSINESS, counterparty: 'NL99CLIE0000000009', category: 'income', description: 'A client' }),
    // Moved to the personal account — leaves on one day, arrives on the next.
    tx({ date: '2026-01-12', amount: -10_000, account: BUSINESS, counterparty: PERSONAL, code: 'GT' }),
    tx({ date: '2026-01-13', amount: 10_000, account: PERSONAL, counterparty: BUSINESS, code: 'GT', category: 'income' }),
    tx({ date: '2026-01-15', amount: -1_500, account: PERSONAL, counterparty: 'NL22OBVI0000000003', code: 'IC', category: 'housing' }),
  ];

  const naive = summarise(rows, 2026);
  assert.equal(naive.moneyIn, 30_000, 'without detection the transfer inflates income');

  const marked = markInternalTransfers(rows);
  const summary = summarise(marked, 2026);

  assert.equal(summary.moneyIn, 20_000, 'only the client payment is income');
  assert.equal(summary.spending, 1_500, 'the transfer out is not spending either');
  assert.equal(summary.internalIn, 10_000);
  assert.equal(summary.internalOut, 10_000);
  assert.equal(summary.internalCount, 2);
});

test('a single account leaves everything alone', () => {
  // With one account there is no "other account", so nothing may be reclassified.
  const rows = [
    tx({ date: '2026-01-05', amount: 500, category: 'income' }),
    tx({ date: '2026-01-06', amount: -20, category: 'groceries' }),
  ];

  assert.deepEqual(markInternalTransfers(rows), rows);
});

test('a payment to someone else is never an internal transfer', () => {
  const rows = [
    tx({ date: '2026-01-05', amount: -300, account: BUSINESS, counterparty: 'NL77SOME0000000077', code: 'GT' }),
    tx({ date: '2026-01-06', amount: 900, account: PERSONAL, counterparty: 'NL88ELSE0000000088', code: 'GT', category: 'income' }),
  ];

  const marked = markInternalTransfers(rows);
  assert.ok(!marked.some((row) => row.internalTransfer));
});

test('a category set by hand survives internal-transfer detection', () => {
  const rows = [
    tx({ date: '2026-01-12', amount: -10_000, account: BUSINESS, counterparty: PERSONAL, category: 'housing', manualCategory: true }),
    tx({ date: '2026-01-13', amount: 10_000, account: PERSONAL, counterparty: BUSINESS, category: 'income' }),
  ];

  const marked = markInternalTransfers(rows);
  assert.equal(marked[0].category, 'housing', 'a manual choice is not overwritten');
  assert.equal(marked[1].category, 'transfers');
});

test('a direct debit collected most months is a fixed commitment, whatever its category', () => {
  // A gym at 29.99 that becomes 37.99 mid-year: still a subscription.
  const gym = [1, 2, 3, 4, 5, 6].map((month) =>
    tx({
      date: `2026-0${month}-10`,
      amount: month < 4 ? -29.99 : -37.99,
      code: 'IC',
      description: 'Sportcity',
      category: 'sports-hobbies',
    })
  );

  const recurring = detectRecurring(gym);
  assert.ok(isFixedCommitment(gym[0], recurring), 'a monthly direct debit is a commitment');
});

test('a merchant visited often on a card is not a commitment', () => {
  // Same price every month, but you choose it each time.
  const barber = [1, 2, 3, 4, 5].map((month) =>
    tx({ date: `2026-0${month}-10`, amount: -19, code: 'BA', description: 'Barber School', category: 'health' })
  );

  const recurring = detectRecurring(barber);
  assert.ok(!isFixedCommitment(barber[0], recurring), 'a card payment stays discretionary');
});

test('re-importing keeps categories set by hand, and still fills in new fields', () => {
  // The exact situation after an upgrade: rows already filed by hand, imported
  // before the counterparty field existed, and the same statement imported again.
  const alreadyFiled = [
    {
      ...tx({ date: '2026-02-01', amount: -25, description: 'CCV*HET LANGE MES', account: PERSONAL }),
      category: 'eating-out' as const,
      manualCategory: true,
      counterparty: undefined as unknown as string,
    },
  ];

  const freshImport = [
    tx({ date: '2026-02-01', amount: -25, description: 'CCV*HET LANGE MES', account: PERSONAL, counterparty: 'NL33SHOP0000000033' }),
  ];

  const { merged, added } = mergeTransactions(alreadyFiled, freshImport);

  assert.equal(added, 0, 're-importing the same statement adds nothing');
  assert.equal(merged.length, 1);
  assert.equal(merged[0].category, 'eating-out', 'the hand-set category survives');
  assert.equal(merged[0].manualCategory, true);
  assert.equal(merged[0].counterparty, 'NL33SHOP0000000033', 'and the row gains the new field');
});

test('rows imported before accounts existed do not break anything', () => {
  // No account, no counterparty — the shape stored by an earlier version.
  const old = [
    { ...tx({ date: '2026-01-05', amount: -30, category: 'groceries' }), account: undefined as unknown as string, counterparty: undefined as unknown as string },
    { ...tx({ date: '2026-01-06', amount: 900, category: 'income' }), account: undefined as unknown as string, counterparty: undefined as unknown as string },
  ];

  assert.doesNotThrow(() => markInternalTransfers(old));
  const summary = summarise(markInternalTransfers(old), 2026);
  assert.equal(summary.moneyIn, 900);
  assert.equal(summary.spending, 30);
});

test('re-importing over rows stored before accounts existed upgrades them, not duplicates', () => {
  // The pre-account id shape: no account segment at the front.
  const stored: BankTransaction = {
    ...tx({ date: '2026-01-05', amount: -30, description: 'LIDL 507', category: 'groceries' }),
    id: '2026-01-05|-30.00|LIDL 507|100.00',
    account: undefined as unknown as string,
    counterparty: undefined as unknown as string,
    manualCategory: true,
  };

  const reimported: BankTransaction = {
    ...tx({ date: '2026-01-05', amount: -30, description: 'LIDL 507', account: PERSONAL, counterparty: '' }),
    id: `${PERSONAL}|2026-01-05|-30.00|LIDL 507|100.00`,
    category: 'unknown',
  };

  const { merged, added } = mergeTransactions([stored], [reimported]);

  assert.equal(added, 0, 'the same payment must not be added a second time');
  assert.equal(merged.length, 1, 'and must not be stored twice');
  assert.equal(merged[0].account, PERSONAL, 'the row gains its account');
  assert.equal(merged[0].category, 'groceries', 'while keeping the hand-set category');
});

test('an account switched to transfers-only needs no second statement', () => {
  // A savings pot at another bank: never imported, so there is nothing to match
  // against. Saying it is yours is the only signal available.
  const savings = 'NL44SAVE0000000044';
  const rows = [
    tx({ date: '2026-01-10', amount: -2_000, account: PERSONAL, counterparty: savings, code: 'GT' }),
    tx({ date: '2026-01-20', amount: 500, account: PERSONAL, counterparty: savings, code: 'GT', category: 'income' }),
    tx({ date: '2026-01-25', amount: -40, account: PERSONAL, category: 'groceries' }),
  ];

  // Untouched while the app has not been told.
  const untold = summarise(markInternalTransfers(rows), 2026);
  assert.equal(untold.spending, 2_040, 'the transfer out still counts as spending');
  assert.equal(untold.moneyIn, 500, 'and the money back still counts as income');

  const told = summarise(markInternalTransfers(rows, new Set([savings])), 2026);
  assert.equal(told.spending, 40, 'only the groceries are spending');
  assert.equal(told.moneyIn, 0, 'money back from your own savings is not income');
  assert.equal(told.internalOut, 2_000);
  assert.equal(told.internalIn, 500);
});

test('money moved in is listed as a source but claims no share of income', () => {
  const rows = markInternalTransfers([
    tx({ date: '2026-01-05', amount: 4_000, account: PERSONAL, counterparty: 'NL99CLIE0000000009', category: 'income', description: 'A client' }),
    tx({ date: '2026-01-13', amount: 1_000, account: PERSONAL, counterparty: BUSINESS, code: 'GT', category: 'income', description: 'From my company' }),
    tx({ date: '2026-01-12', amount: -1_000, account: BUSINESS, counterparty: PERSONAL, code: 'GT' }),
  ]);

  const summary = summarise(rows, 2026);
  const moved = summary.incomeSources.find((source) => source.internal);
  const earned = summary.incomeSources.find((source) => !source.internal);

  assert.ok(moved, 'the transfer is still listed');
  assert.equal(moved?.total, 1_000);
  assert.equal(moved?.share, 0, 'but claims no share of income');
  assert.equal(earned?.share, 1, 'the real payment is all of it');
  assert.equal(summary.moneyIn, 4_000);

  // Real income sorts above moved money.
  assert.equal(summary.incomeSources[0].internal, false);
});

test('the year is projected on days covered, not months seen', () => {
  // A statement ending on 4 January: one twelfth of a month, not one month.
  const rows = [tx({ date: '2026-01-04', amount: -100, category: 'groceries' })];
  const summary = summarise(rows, 2026);

  assert.equal(summary.daysCovered, 4);
  assert.ok(
    summary.projectedSpending > 8_000,
    `four days at 100 should project far above a month's worth, got ${summary.projectedSpending}`
  );
});
