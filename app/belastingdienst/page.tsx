'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useLocalStorageState } from '@/lib/local-storage';
import {
  StoredInvoice,
  formatCurrency,
  formatDate,
  formatEuroWhole,
  getInvoiceDate,
  getInvoiceNetAmount,
  getQuarter,
  isInvoiceOverdue,
  isInvoicePaid,
  isPlausibleBookkeepingYear,
  isUsableBookkeepingDate,
  sumEuros,
} from '@/lib/billing';
import {
  DEFAULT_TAX_SETTINGS,
  TaxSettings,
  describeDeadline,
  estimateIncomeTax,
  getBtwDeadline,
  toLocalIsoDate,
} from '@/lib/tax';
import { Donut, ProjectionChart, QuarterBars, SERIES } from '@/app/components/charts';
import { downloadJsonFile } from '@/lib/backup';
import { MONTHS_SHORT, quarterMonths, useT } from '@/lib/i18n';

type Expense = {
  id: number;
  date: string;
  supplier: string;
  amountExVat: number;
  vatAmount: number;
  totalAmount: number;
};



function validDate(value: string) {
  return isUsableBookkeepingDate(value);
}

function Stat({ label, value, sub, tone }: {
  label: string;
  value: string;
  sub?: string;
  tone?: 'default' | 'warn';
}) {
  return (
    <div
      className={`rounded-3xl border p-5 ${
        tone === 'warn'
          ? 'border-amber-400/30 bg-amber-400/10'
          : 'border-white/10 bg-white/5'
      }`}
    >
      <div className="text-sm text-white/50">{label}</div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
      {sub && <div className="mt-1 text-xs text-white/50">{sub}</div>}
    </div>
  );
}

export default function BelastingdienstPage() {
  const [invoices] = useLocalStorageState<StoredInvoice[]>('invoices', []);
  const [expenses] = useLocalStorageState<Expense[]>('expenses', []);
  const [settings, setSettings] = useLocalStorageState<TaxSettings>(
    'tax-settings',
    DEFAULT_TAX_SETTINGS
  );

  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [showAssumptions, setShowAssumptions] = useState(false);
  const [showTable, setShowTable] = useState(false);
  const [settingsError, setSettingsError] = useState('');
  const { t, language } = useT();
  const MONTHS = MONTHS_SHORT[language];

  const years = useMemo(() => {
    // Always offer last year, this year and next year, so a year can be selected
    // before any data exists for it.
    const found = new Set<number>([currentYear - 1, currentYear, currentYear + 1]);

    // A typo in a date can otherwise put a year like 3000 in the dropdown.
    const plausible = (year: number) => isPlausibleBookkeepingYear(year, currentYear);

    for (const invoice of invoices) {
      const date = getInvoiceDate(invoice);
      if (validDate(date)) {
        const year = new Date(date).getFullYear();
        if (plausible(year)) found.add(year);
      }
    }
    for (const expense of expenses) {
      if (validDate(expense.date)) {
        const year = new Date(expense.date).getFullYear();
        if (plausible(year)) found.add(year);
      }
    }

    return Array.from(found).sort((a, b) => b - a);
  }, [currentYear, expenses, invoices]);

  const data = useMemo(() => {
    const yearInvoices = invoices.filter((invoice) => {
      const date = getInvoiceDate(invoice);
      return validDate(date) && new Date(date).getFullYear() === year;
    });
    const yearExpenses = expenses.filter(
      (expense) => validDate(expense.date) && new Date(expense.date).getFullYear() === year
    );

    const revenueExVat = sumEuros(yearInvoices.map(getInvoiceNetAmount));
    const expensesExVat = sumEuros(yearExpenses.map((expense) => expense.amountExVat));
    const outputVat = sumEuros(yearInvoices.map((invoice) => invoice.vatAmount));
    const inputVat = sumEuros(yearExpenses.map((expense) => expense.vatAmount));

    const unpaid = yearInvoices.filter((invoice) => !isInvoicePaid(invoice));
    const overdue = unpaid.filter((invoice) => isInvoiceOverdue(invoice));

    const quarters = [1, 2, 3, 4].map((quarter) => {
      const qInvoices = yearInvoices.filter((invoice) => getQuarter(getInvoiceDate(invoice)) === quarter);
      const qExpenses = yearExpenses.filter((expense) => getQuarter(expense.date) === quarter);
      const out = sumEuros(qInvoices.map((invoice) => invoice.vatAmount));
      const inp = sumEuros(qExpenses.map((expense) => expense.vatAmount));

      return {
        quarter,
        outputVat: out,
        inputVat: inp,
        net: sumEuros([out, -inp]),
        count: qInvoices.length + qExpenses.length,
      };
    });

    // Cumulative monthly totals, with the remainder of the year projected from
    // the average of the months that actually have data.
    const monthlyRevenue = Array(12).fill(0) as number[];
    const monthlyExpenses = Array(12).fill(0) as number[];

    for (const invoice of yearInvoices) {
      monthlyRevenue[new Date(getInvoiceDate(invoice)).getMonth()] += getInvoiceNetAmount(invoice);
    }
    for (const expense of yearExpenses) {
      monthlyExpenses[new Date(expense.date).getMonth()] += expense.amountExVat;
    }

    let lastMonthWithData = year === currentYear ? new Date().getMonth() : 11;

    // An invoice or expense dated later in the year is real data, not a projection,
    // so the actuals must run at least as far as the last month that has any.
    for (let month = 11; month > lastMonthWithData; month -= 1) {
      if (monthlyRevenue[month] > 0 || monthlyExpenses[month] > 0) {
        lastMonthWithData = month;
        break;
      }
    }

    const monthsElapsed = lastMonthWithData + 1;
    const avgRevenue = monthsElapsed > 0 ? revenueExVat / monthsElapsed : 0;
    const avgExpenses = monthsElapsed > 0 ? expensesExVat / monthsElapsed : 0;

    const cumulative = (monthly: number[], average: number) => {
      const out: number[] = [];
      let running = 0;

      for (let month = 0; month < 12; month += 1) {
        running += month <= lastMonthWithData ? monthly[month] : average;
        out.push(Math.round(running * 100) / 100);
      }

      return out;
    };

    const cumulativeRevenue = cumulative(monthlyRevenue, avgRevenue);
    const cumulativeExpenses = cumulative(monthlyExpenses, avgExpenses);

    // Tax accrued month by month, so the chart shows the bill growing rather than
    // only its end state. Same euro scale as the other two series.
    const cumulativeTax = cumulativeRevenue.map((revenue, month) =>
      estimateIncomeTax(revenue, cumulativeExpenses[month], settings).totalTax
    );

    const taxToDate = estimateIncomeTax(revenueExVat, expensesExVat, settings);
    const taxProjected = estimateIncomeTax(
      cumulativeRevenue[11],
      cumulativeExpenses[11],
      settings
    );

    return {
      yearInvoices,
      yearExpenses,
      revenueExVat,
      expensesExVat,
      outputVat,
      inputVat,
      netVat: sumEuros([outputVat, -inputVat]),
      invoicedInclVat: sumEuros(yearInvoices.map((invoice) => invoice.totalAmount)),
      paidTotal: sumEuros(
        yearInvoices.filter(isInvoicePaid).map((invoice) => invoice.totalAmount)
      ),
      outstanding: sumEuros(unpaid.map((invoice) => invoice.totalAmount)),
      overdueTotal: sumEuros(overdue.map((invoice) => invoice.totalAmount)),
      overdueCount: overdue.length,
      unpaidCount: unpaid.length,
      quarters,
      cumulativeRevenue,
      cumulativeExpenses,
      cumulativeTax,
      lastMonthWithData,
      taxToDate,
      taxProjected,
    };
  }, [currentYear, expenses, invoices, settings, year]);

  const setAside = Math.max(0, data.netVat) + data.taxToDate.totalTax;
  const takeHome = Math.max(
    0,
    data.revenueExVat - data.expensesExVat - data.taxToDate.totalTax
  );

  const nextQuarter = data.quarters.find((quarter) => {
    return quarter.count > 0 && getBtwDeadline(year, quarter.quarter) >= new Date();
  }) ?? data.quarters.filter((quarter) => quarter.count > 0).pop();

  const deadline = nextQuarter ? getBtwDeadline(year, nextQuarter.quarter) : null;
  const deadlineInfo = deadline ? describeDeadline(deadline) : null;

  const exportYear = () => {
    downloadJsonFile(`belastingdienst-${year}.json`, {
      format: 'bookkeeping-admin-tax-year',
      version: 1,
      exportedAt: new Date().toISOString(),
      year,
      currency: 'EUR',
      totals: {
        revenueExVat: data.revenueExVat,
        expensesExVat: data.expensesExVat,
        invoicedInclVat: data.invoicedInclVat,
        outputVat: data.outputVat,
        inputVat: data.inputVat,
        netVat: data.netVat,
        paid: data.paidTotal,
        outstanding: data.outstanding,
        overdue: data.overdueTotal,
        overdueCount: data.overdueCount,
        unpaidCount: data.unpaidCount,
        setAside,
      },
      quarters: data.quarters.map((quarter) => ({
        quarter: quarter.quarter,
        outputVat: quarter.outputVat,
        inputVat: quarter.inputVat,
        netVat: quarter.net,
        entries: quarter.count,
        deadline: toLocalIsoDate(getBtwDeadline(year, quarter.quarter)),
      })),
      monthly: MONTHS.map((month, index) => ({
        month,
        monthNumber: index + 1,
        source: index <= data.lastMonthWithData ? 'actual' : 'projected',
        cumulativeRevenueExVat: data.cumulativeRevenue[index],
        cumulativeExpensesExVat: data.cumulativeExpenses[index],
        cumulativeIncomeTaxEstimate: data.cumulativeTax[index],
      })),
      incomeTax: {
        onProfitSoFar: data.taxToDate,
        projectedFullYear: data.taxProjected,
        settings,
      },
      invoices: data.yearInvoices,
      expenses: data.yearExpenses,
      disclaimer:
        'Income tax figures are estimates for planning only, calculated from the editable settings included here. They are not filing figures or tax advice.',
    });
  };

  const updateSetting = (patch: Partial<TaxSettings>) => {
    try {
      setSettings({ ...settings, ...patch });
      setSettingsError('');
    } catch {
      setSettingsError('Could not save these assumptions.');
    }
  };

  return (
    <main className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold">{t('bd.title')}</h1>
          <p className="mt-2 max-w-2xl text-sm text-white/60">
{t('bd.subtitle')}
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <button
            onClick={exportYear}
            className="rounded-full border border-white/10 px-4 py-3 text-sm hover:bg-white/10"
          >
            {t('bd.download', { year })}
          </button>

          <label className="text-sm text-white/60">
          <span className="mb-2 block">{t('common.taxYear')}</span>
          <select
            className="rounded-2xl border border-white/10 bg-white/5 p-3 text-white outline-none"
            value={year}
            onChange={(event) => setYear(Number(event.target.value))}
          >
            {years.map((option) => (
              <option key={option} value={option} className="text-black">
                {option}
              </option>
            ))}
          </select>
          </label>
        </div>
      </div>

      {deadline && deadlineInfo && (
        <div className="rounded-3xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
          {t('bd.nextDeadline')}: Q{nextQuarter?.quarter} {year} — {formatDate(toLocalIsoDate(deadline))} ({deadlineInfo.label})
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Stat
          label={t('bd.invoicedThisYear')}
          value={formatCurrency(data.revenueExVat)}
          sub={`${formatCurrency(data.invoicedInclVat)} incl VAT · ${data.yearInvoices.length} invoice(s)`}
        />
        <Stat
          label={t('bd.outstanding')}
          value={formatCurrency(data.outstanding)}
          sub={`${data.unpaidCount} ${t('common.unpaid')} · ${formatCurrency(data.paidTotal)} ${t('common.paid')}`}
        />
        <Stat
          label={t('bd.overdue')}
          value={formatCurrency(data.overdueTotal)}
          sub={data.overdueCount > 0 ? `${data.overdueCount} invoice(s) past due date` : t('bd.nothingOverdue')}
          tone={data.overdueCount > 0 ? 'warn' : 'default'}
        />
        <Stat
          label={t('bd.netVatYear')}
          value={formatCurrency(Math.abs(data.netVat))}
          sub={data.netVat >= 0 ? t('common.toPay') : t('common.toReclaim')}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-xl font-semibold">{t('bd.revenueSplit')}</h2>
          <p className="mt-1 mb-4 text-sm text-white/60">
            Your {year} invoiced revenue ex VAT, split by what leaves again. BTW is not
            shown here — it is collected for the Belastingdienst, so it was never your
            revenue. It has its own figure above.
          </p>
          {data.taxToDate.profit < 0 ? (
            <div className="rounded-2xl border border-white/10 bg-black/20 p-5 text-sm text-white/70">
              Expenses of {formatCurrency(data.expensesExVat)} exceed revenue of{' '}
              {formatCurrency(data.revenueExVat)}, so {year} is a loss of{' '}
              {formatCurrency(Math.abs(data.taxToDate.profit))}. There is nothing to split
              up, and no income tax is estimated on a loss.
            </div>
          ) : (
            <Donut
              centerLabel={t('common.exVat')}
              centerValue={formatEuroWhole(data.revenueExVat)}
              slices={[
                { label: t('bd.takeHome'), value: takeHome, color: SERIES.blue },
                { label: t('bd.incomeTaxEst'), value: data.taxToDate.totalTax, color: SERIES.orange },
                { label: t('bd.businessExpenses'), value: data.expensesExVat, color: SERIES.aqua },
              ]}
            />
          )}
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-xl font-semibold">{t('bd.netVatPerQuarter')}</h2>
          <p className="mt-1 mb-4 text-sm text-white/60">
            VAT charged minus VAT deductible. Bars below the line are quarters you reclaim.
          </p>
          <QuarterBars
            bars={data.quarters.map((quarter) => ({
              label: `Q${quarter.quarter}`,
              sub2: quarterMonths(quarter.quarter, language),
              value: quarter.net,
              sub: `${formatCurrency(quarter.outputVat)} charged · ${formatCurrency(quarter.inputVat)} deductible`,
            }))}
          />
        </section>
      </div>

      <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">{t('bd.projection')}</h2>
            <p className="mt-1 text-sm text-white/60">
              Cumulative revenue and expenses ex VAT. The dashed part assumes the rest of{' '}
              {year} matches your monthly average so far.
            </p>
          </div>
          <button
            onClick={() => setShowTable((value) => !value)}
            className="rounded-full border border-white/10 px-4 py-2 text-sm hover:bg-white/10"
          >
            {showTable ? t('common.hideTable') : t('common.showTable')}
          </button>
        </div>

        <div className="mt-4">
          <ProjectionChart
            months={MONTHS}
            actualThrough={data.lastMonthWithData}
            series={[
              { label: t('common.exVat'), color: SERIES.blue, values: data.cumulativeRevenue },
              { label: t('bd.incomeTaxEst'), color: SERIES.orange, values: data.cumulativeTax },
              { label: t('vat.expensesExVat'), color: SERIES.aqua, values: data.cumulativeExpenses },
            ]}
          />
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="text-xs uppercase tracking-[0.14em] text-white/45">{t('bd.projectedRevenue')}</div>
            <div className="mt-2 text-xl font-semibold">{formatCurrency(data.cumulativeRevenue[11])}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="text-xs uppercase tracking-[0.14em] text-white/45">{t('bd.projectedProfit')}</div>
            <div className="mt-2 text-xl font-semibold">{formatCurrency(data.taxProjected.profit)}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="text-xs uppercase tracking-[0.14em] text-white/45">{t('bd.projectedTax')}</div>
            <div className="mt-2 text-xl font-semibold">{formatCurrency(data.taxProjected.totalTax)}</div>
          </div>
        </div>

        {showTable && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead className="text-left text-white/50">
                <tr>
                  <th className="py-2">Month</th>
                  <th className="py-2 text-right">Cumulative revenue</th>
                  <th className="py-2 text-right">Cumulative expenses</th>
                  <th className="py-2 text-right">Source</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {MONTHS.map((month, index) => (
                  <tr key={month} className="border-t border-white/10">
                    <td className="py-2">{month}</td>
                    <td className="py-2 text-right">{formatCurrency(data.cumulativeRevenue[index])}</td>
                    <td className="py-2 text-right">{formatCurrency(data.cumulativeExpenses[index])}</td>
                    <td className="py-2 text-right text-white/50">
                      {index <= data.lastMonthWithData ? 'Actual' : 'Projected'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">{t('bd.howBuilt')}</h2>
            <p className="mt-1 max-w-2xl text-sm text-white/60">
              {t('tax.effective')}: {data.taxToDate.effectiveRate.toFixed(1)}%.
            </p>
          </div>
          <button
            onClick={() => setShowAssumptions((value) => !value)}
            className="rounded-full border border-white/10 px-4 py-2 text-sm hover:bg-white/10"
          >
            {showAssumptions ? t('bd.hideAssumptions') : t('bd.editAssumptions')}
          </button>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[420px] text-sm">
            <tbody className="tabular-nums">
              {[
                [t('tax.revenue'), data.taxToDate.revenue],
                [t('tax.expenses'), -data.taxToDate.expenses],
                [t('tax.profit'), data.taxToDate.profit],
                [t('tax.ondernemersaftrek'), -data.taxToDate.ondernemersaftrek],
                [`${t('tax.mkb')} (${settings.mkbVrijstellingPercent}%)`, -data.taxToDate.mkbVrijstelling],
                [t('tax.taxable'), data.taxToDate.taxableIncome],
                [t('tax.box1'), data.taxToDate.incomeTaxBeforeCredits],
                [t('tax.credits'), -data.taxToDate.credits],
                [`${t('tax.zvw')} (${settings.zvwPercent}%)`, data.taxToDate.zvw],
              ].map(([label, value]) => (
                <tr key={label as string} className="border-t border-white/10">
                  <td className="py-2 text-white/70">{label}</td>
                  <td className="py-2 text-right">{formatCurrency(value as number)}</td>
                </tr>
              ))}
              <tr className="border-t border-white/20">
                <td className="py-2 font-medium">{t('tax.total')}</td>
                <td className="py-2 text-right text-lg font-semibold">
                  {formatCurrency(data.taxToDate.totalTax)}
                </td>
              </tr>
              <tr>
                <td colSpan={2} className="pt-2 text-xs text-white/40">
                  {t('tax.basisNote')}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
            <div className="text-xs uppercase tracking-[0.14em] text-white/45">
              {t('bd.onProfitSoFar')}
            </div>
            <div className="mt-2 text-2xl font-semibold">
              {formatCurrency(data.taxToDate.totalTax)}
            </div>
            <div className="mt-1 text-xs text-white/50">
              Profit {formatCurrency(data.taxToDate.profit)} · effective{' '}
              {data.taxToDate.effectiveRate.toFixed(1)}%
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
            <div className="text-xs uppercase tracking-[0.14em] text-white/45">
              {t('bd.projectedFullYear')}
            </div>
            <div className="mt-2 text-2xl font-semibold">
              {formatCurrency(data.taxProjected.totalTax)}
            </div>
            <div className="mt-1 text-xs text-white/50">
              Profit {formatCurrency(data.taxProjected.profit)} · effective{' '}
              {data.taxProjected.effectiveRate.toFixed(1)}%
            </div>
          </div>
        </div>

        {showAssumptions && (
          <div className="mt-5 grid gap-4 border-t border-white/10 pt-5 md:grid-cols-2">
            {([
              [t('tax.zelfstandigenaftrek'), 'zelfstandigenaftrek'],
              [t('tax.startersaftrek'), 'startersaftrek'],
              [t('tax.mkbPercent'), 'mkbVrijstellingPercent'],
              [t('tax.creditsField'), 'heffingskortingen'],
              [t('tax.zvwPercent'), 'zvwPercent'],
              [t('tax.zvwMax'), 'zvwMaxBase'],
            ] as const).map(([label, key]) => (
              <label key={key} className="text-sm text-white/60">
                <span className="mb-2 block">{label}</span>
                <input
                  type="number"
                  step="0.01"
                  value={settings[key]}
                  onChange={(event) => updateSetting({ [key]: Number(event.target.value) || 0 })}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 p-3 text-white outline-none"
                />
              </label>
            ))}

            <div className="md:col-span-2">
              <div className="mb-2 text-sm text-white/60">{t('tax.brackets')}</div>
              <div className="space-y-2">
                {settings.brackets.map((bracket, index) => (
                  <div key={index} className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="text-white/50">
                      {bracket.upTo === null ? 'Above previous bracket' : 'Up to €'}
                    </span>
                    {bracket.upTo !== null && (
                      <input
                        type="number"
                        value={bracket.upTo}
                        onChange={(event) => {
                          const brackets = settings.brackets.map((item, position) =>
                            position === index
                              ? { ...item, upTo: Number(event.target.value) || 0 }
                              : item
                          );
                          updateSetting({ brackets });
                        }}
                        className="w-32 rounded-xl border border-white/10 bg-white/5 p-2 text-white outline-none"
                      />
                    )}
                    <span className="text-white/50">at</span>
                    <input
                      type="number"
                      step="0.01"
                      value={bracket.rate}
                      onChange={(event) => {
                        const brackets = settings.brackets.map((item, position) =>
                          position === index
                            ? { ...item, rate: Number(event.target.value) || 0 }
                            : item
                        );
                        updateSetting({ brackets });
                      }}
                      className="w-24 rounded-xl border border-white/10 bg-white/5 p-2 text-white outline-none"
                    />
                    <span className="text-white/50">%</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="md:col-span-2 flex flex-wrap gap-3">
              <button
                onClick={() => updateSetting(DEFAULT_TAX_SETTINGS)}
                className="rounded-full border border-white/10 px-4 py-2 text-sm hover:bg-white/10"
              >
                {t('tax.reset')}
              </button>
            </div>

            {settingsError && (
              <div className="md:col-span-2 rounded-2xl border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-200">
                {settingsError}
              </div>
            )}
          </div>
        )}

        <p className="mt-5 text-xs text-white/40">{t('tax.disclaimer', { year })}</p>
      </section>

      <Link
        href="/btw-summary"
        className="inline-block rounded-full border border-white/10 px-4 py-2 text-sm hover:bg-white/10"
      >
        See the quarterly BTW detail →
      </Link>
    </main>
  );
}
