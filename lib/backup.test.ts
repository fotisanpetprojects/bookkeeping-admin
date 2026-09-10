/**
 * Tests for reading and merging a backup file. Run with `npm test`.
 *
 * A backup is the only copy of these books outside one browser, so restoring is
 * the moment when everything can be lost at once. Two things have to hold: a file
 * that is not a backup must be refused rather than half-applied, and merging must
 * only ever add — never overwrite, never drop, never duplicate.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import { BACKUP_FORMAT, describeBackup, mergeById, parseBackup } from './backup.ts';

const valid = {
  format: BACKUP_FORMAT,
  version: 1,
  exportedAt: '2026-09-10T10:00:00.000Z',
  data: {
    invoices: [{ id: 1, invoiceNumber: '202601-01' }],
    expenses: [{ id: 9 }],
    'bank-transactions': [{ id: 'a' }],
    'client-profiles': [],
    'business-profiles': [],
  },
};

test('a real backup parses and reports what it holds', () => {
  const parsed = parseBackup(JSON.stringify(valid));
  const counts = describeBackup(parsed.data);

  assert.equal(counts.invoices, 1);
  assert.equal(counts.expenses, 1);
  assert.equal(counts.transactions, 1, 'bank transactions are counted too');
});

test('anything that is not a backup is refused, and says why', () => {
  const cases: [string, RegExp][] = [
    ['not json at all', /not valid JSON/],
    ['"a string"', /does not look like/],
    ['null', /does not look like/],
    [JSON.stringify({ format: 'something-else', data: {} }), /not exported by/],
    [JSON.stringify({ format: BACKUP_FORMAT }), /no data section/],
    [JSON.stringify({ format: BACKUP_FORMAT, data: { invoices: 'nope' } }), /malformed/],
  ];

  for (const [input, expected] of cases) {
    assert.throws(() => parseBackup(input), expected, `should refuse: ${input.slice(0, 30)}`);
  }
});

test('a backup exported by another year of this app still opens', () => {
  // Missing optional fields must not be a reason to refuse someone their own data.
  const sparse = { format: BACKUP_FORMAT, data: { invoices: [{ id: 1 }] } };
  const parsed = parseBackup(JSON.stringify(sparse));

  assert.equal(parsed.version, 1, 'a missing version defaults rather than throwing');
  assert.equal(parsed.exportedAt, '');
  assert.equal(describeBackup(parsed.data).invoices, 1);
});

test('merging adds what is new and keeps what is already here', () => {
  const current = [{ id: 1, note: 'mine' }];
  const incoming = [{ id: 1, note: 'theirs' }, { id: 2, note: 'new' }];

  const merged = mergeById(current, incoming) as { id: number; note: string }[];

  assert.equal(merged.length, 2, 'one addition, no duplicate');
  assert.equal(merged[0].note, 'mine', 'what is already on this device wins');
  assert.equal(merged[1].id, 2);
});

test('an invoice already booked is not added again under a different id', () => {
  // The case this exists for: books entered by hand, then a backup built from the
  // source documents. Same invoices, different internal ids.
  const current = [{ id: 111, invoiceNumber: '202604-01', total: 500 }];
  const incoming = [{ id: 999, invoiceNumber: '202604-01', total: 500 }];

  const merged = mergeById(current, incoming);
  assert.equal(merged.length, 1, 'the invoice number is the real identity');
});

test('invoice numbers match regardless of case and stray spacing', () => {
  const current = [{ id: 1, invoiceNumber: '2026-04-01' }];
  const incoming = [{ id: 2, invoiceNumber: '  2026-04-01  ' }];

  assert.equal(mergeById(current, incoming).length, 1);
});

test('records without an invoice number are matched on identity alone', () => {
  // Expenses and transactions have no such number, and two genuinely different
  // ones must both survive.
  const current = [{ id: 'a', supplier: 'Lidl' }];
  const incoming = [{ id: 'b', supplier: 'Lidl' }];

  assert.equal(mergeById(current, incoming).length, 2, 'different records both kept');
});

test('a duplicate inside the incoming file itself is only added once', () => {
  const incoming = [
    { id: 5, invoiceNumber: '202608-01' },
    { id: 6, invoiceNumber: '202608-01' },
  ];

  assert.equal(mergeById([], incoming).length, 1);
});

test('merging tolerates a missing or malformed side', () => {
  // Never throw while restoring: a key absent from one side is normal.
  assert.deepEqual(mergeById(undefined, [{ id: 1 }]), [{ id: 1 }]);
  assert.deepEqual(mergeById([{ id: 1 }], undefined), [{ id: 1 }]);
  assert.deepEqual(mergeById('nonsense', 'nonsense'), []);
});
