/**
 * Tests for the income tax estimate and the BTW deadlines. Run with `npm test`.
 *
 * These are the figures someone plans around and, at the end of a year, files on.
 * A mistake here does not throw — it produces a believable number that is wrong,
 * and the more confident the page looks the longer it survives.
 *
 * The rates themselves are not asserted: they are editable defaults that will
 * change every year. What is asserted is the shape of the calculation — the order
 * the steps apply in, and what happens at the edges where rules stop.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DEFAULT_TAX_SETTINGS,
  describeDeadline,
  estimateIncomeTax,
  getBtwDeadline,
  toLocalIsoDate,
} from './tax.ts';

const settings = DEFAULT_TAX_SETTINGS;

test('the steps chain in the order the Belastingdienst applies them', () => {
  const result = estimateIncomeTax(100_000, 20_000, settings);

  assert.equal(result.profit, 80_000, 'profit is revenue less expenses');
  assert.equal(
    result.profitAfterAftrek,
    result.profit - result.ondernemersaftrek,
    'the entrepreneur deduction comes off profit'
  );
  assert.equal(
    result.taxableIncome,
    result.profitAfterAftrek - result.mkbVrijstelling,
    'the SME exemption comes off what is left, not off the original profit'
  );
  assert.equal(
    result.incomeTax,
    result.incomeTaxBeforeCredits - result.credits,
    'credits reduce the tax, not the income'
  );
  assert.equal(result.totalTax, result.incomeTax + result.zvw, 'Zvw is added on top');
});

test('a loss is not turned into a deduction', () => {
  // Spending more than you earned must not manufacture a deduction, and there is
  // no tax on a loss.
  const result = estimateIncomeTax(20_000, 50_000, settings);

  assert.equal(result.profit, -30_000);
  assert.equal(result.ondernemersaftrek, 0, 'no deduction is granted against a loss');
  assert.equal(result.taxableIncome, 0);
  assert.equal(result.totalTax, 0);
  assert.equal(result.effectiveRate, 0, 'a rate on a loss would be meaningless');
});

test('the entrepreneur deduction cannot exceed the profit it comes off', () => {
  // Derived from the settings rather than hard-coded, so this keeps testing the
  // rule when next year's rates land.
  const deduction = settings.zelfstandigenaftrek + settings.startersaftrek;
  const result = estimateIncomeTax(deduction / 2, 0, settings);

  assert.ok(result.ondernemersaftrek <= result.profit, 'capped at the profit');
  assert.equal(result.profitAfterAftrek, 0, 'the deduction absorbs a profit smaller than itself');
  assert.equal(result.totalTax, 0, 'and nothing is owed');
});

test('credits cannot pay out more than the tax due', () => {
  // A credit larger than the bill must bring it to zero, never below. The shipped
  // default is zero, so this sets one deliberately to exercise the rule at all.
  const generous = { ...settings, heffingskortingen: 500_000 };
  const result = estimateIncomeTax(30_000, 0, generous);

  assert.equal(result.credits, result.incomeTaxBeforeCredits, 'the credit stops at the bill');
  assert.equal(result.incomeTax, 0, 'never negative — this is not a refund');
  assert.ok(result.zvw > 0, 'the health contribution is unaffected by income tax credits');
});

test('the health contribution stops at its ceiling', () => {
  // Zvw is charged on income up to a maximum. Beyond it the contribution is flat,
  // so doubling the profit must not double this line.
  const atCeiling = estimateIncomeTax(settings.zvwMaxBase * 3, 0, settings);
  const wellAbove = estimateIncomeTax(settings.zvwMaxBase * 6, 0, settings);

  assert.equal(atCeiling.zvw, wellAbove.zvw, 'the same amount either side of the ceiling');
  assert.ok(
    atCeiling.zvw <= settings.zvwMaxBase * (settings.zvwPercent / 100) + 0.01,
    'never more than the ceiling allows'
  );
});

test('more profit always means more tax, never less', () => {
  // Monotonic: no bracket edge should ever make earning more leave you worse off.
  let previousTax = -1;
  let previousTakeHome = -1;

  for (let profit = 0; profit <= 200_000; profit += 5_000) {
    const result = estimateIncomeTax(profit, 0, settings);
    const takeHome = result.profit - result.totalTax;

    assert.ok(result.totalTax >= previousTax, `tax fell going into ${profit}`);
    assert.ok(takeHome >= previousTakeHome, `take-home fell going into ${profit}`);

    previousTax = result.totalTax;
    previousTakeHome = takeHome;
  }
});

test('every figure is rounded to whole cents', () => {
  // Money that renders as 1234.5600000000002 is money nobody trusts.
  const result = estimateIncomeTax(83_333.33, 17_777.77, settings);

  for (const [name, value] of Object.entries(result)) {
    if (name === 'effectiveRate') continue;
    assert.equal(
      Math.round((value as number) * 100),
      Number(((value as number) * 100).toFixed(0)),
      `${name} carries sub-cent precision`
    );
  }
});

test('BTW deadlines fall on the last day of the month after each quarter', () => {
  // Q1 ends 31 March, so the return is due 30 April, and so on round the year.
  const expected = [
    [1, '2026-04-30'],
    [2, '2026-07-31'],
    [3, '2026-10-31'],
    [4, '2027-01-31'],
  ] as const;

  for (const [quarter, iso] of expected) {
    assert.equal(toLocalIsoDate(getBtwDeadline(2026, quarter)), iso, `Q${quarter}`);
  }
});

test('a deadline date is not shifted by the timezone', () => {
  // toISOString() converts to UTC first, which in CET turns a local midnight into
  // the previous day — that is how Q3 once read 30 October instead of 31 October.
  const lastOfOctober = new Date(2026, 9, 31);
  assert.equal(toLocalIsoDate(lastOfOctober), '2026-10-31');
});

test('a deadline describes itself relative to today', () => {
  const today = new Date(2026, 9, 1);

  assert.equal(describeDeadline(new Date(2026, 9, 1), today).days, 0);
  assert.equal(describeDeadline(new Date(2026, 9, 1), today).overdue, false);

  const past = describeDeadline(new Date(2026, 8, 20), today);
  assert.ok(past.overdue, 'a date behind today is overdue');
  assert.ok(past.days < 0);

  const future = describeDeadline(new Date(2026, 9, 31), today);
  assert.equal(future.overdue, false);
  assert.equal(future.days, 30);
});
