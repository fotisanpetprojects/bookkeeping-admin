'use client';

import { useState } from 'react';
import { formatCurrency } from '@/lib/billing';
import { useT } from '@/lib/i18n';

/**
 * Categorical slots, dark-mode steps, validated against this app's card surface
 * (#161d31) with scripts/validate_palette.js: all four pass the lightness band,
 * chroma floor, adjacent CVD separation (worst dE 8.4) and 3:1 contrast.
 * The donut order below is deliberate — it keeps yellow and orange non-adjacent.
 */
export const SERIES = {
  blue: 'var(--series-1)',
  aqua: 'var(--series-2)',
  orange: 'var(--series-3)',
} as const;

const AXIS = 'var(--ink-3)';
const GRID = 'var(--grid)';
const SURFACE = 'var(--chart-surface)';

type Tip = { x: number; y: number; title: string; value: string; sub?: string } | null;

function Tooltip({ tip }: { tip: Tip }) {
  if (!tip) return null;

  return (
    <div
      className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full card px-3 py-2 text-xs"
      style={{ left: tip.x, top: tip.y - 10 }}
    >
      <div className="font-medium">{tip.title}</div>
      <div className="mt-0.5 muted">{tip.value}</div>
      {tip.sub && <div className="faint">{tip.sub}</div>}
    </div>
  );
}

/* ---------------------------------------------------------------- donut --- */

export type DonutSlice = { label: string; value: number; color: string };

function arcPath(cx: number, cy: number, rOuter: number, rInner: number, a0: number, a1: number) {
  const p = (r: number, a: number) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  const large = a1 - a0 > Math.PI ? 1 : 0;
  const [x0, y0] = p(rOuter, a0);
  const [x1, y1] = p(rOuter, a1);
  const [x2, y2] = p(rInner, a1);
  const [x3, y3] = p(rInner, a0);

  return `M${x0} ${y0} A${rOuter} ${rOuter} 0 ${large} 1 ${x1} ${y1} L${x2} ${y2} A${rInner} ${rInner} 0 ${large} 0 ${x3} ${y3} Z`;
}

export function Donut({ slices, centerLabel, centerValue }: {
  slices: DonutSlice[];
  centerLabel: string;
  centerValue: string;
}) {
  const [tip, setTip] = useState<Tip>(null);
  const { t } = useT();
  const positive = slices.filter((slice) => slice.value > 0);
  const total = positive.reduce((sum, slice) => sum + slice.value, 0);

  if (total <= 0) {
    return (
      <div className="flex h-[220px] items-center justify-center text-sm faint">
        {t('chart.nothingYear')}
      </div>
    );
  }

  const size = 220;
  const cx = size / 2;
  const cy = size / 2;
  const gap = 0.02; // ~2px surface gap between segments

  // Angles are resolved before render so nothing is mutated while drawing.
  const segments = positive.reduce<
    { slice: DonutSlice; a0: number; a1: number; mid: number; gapUsed: number }[]
  >((acc, slice) => {
    const previous = acc[acc.length - 1];
    const start = previous ? previous.a1 + previous.gapUsed / 2 : -Math.PI / 2;
    const sweep = (slice.value / total) * Math.PI * 2;
    // A fixed separator would swallow a very small slice whole and read as a gap
    // in the ring, so it never takes more than a quarter of the slice itself.
    const gapUsed = Math.min(gap, sweep * 0.25);
    const a0 = start + gapUsed / 2;
    const a1 = start + sweep - gapUsed / 2;

    acc.push({ slice, a0, a1, mid: (a0 + a1) / 2, gapUsed });
    return acc;
  }, []);

  return (
    <div className="relative">
      <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center">
        <svg
          width={size}
          height={size}
          className="shrink-0"
          role="img"
          aria-label={`${centerLabel}: ${centerValue}`}
        >
          {segments.map(({ slice, a0, a1, mid }) => (
            <path
              key={slice.label}
              d={arcPath(cx, cy, 100, 66, a0, a1)}
              fill={slice.color}
              stroke={SURFACE}
              strokeWidth={2}
              onMouseEnter={() =>
                setTip({
                  x: cx + 78 * Math.cos(mid),
                  y: cy + 78 * Math.sin(mid),
                  title: slice.label,
                  value: formatCurrency(slice.value),
                  sub: `${((slice.value / total) * 100).toFixed(1)}% of revenue`,
                })
              }
              onMouseLeave={() => setTip(null)}
            />
          ))}
          <text x={cx} y={cy - 6} textAnchor="middle" style={{ fill: "var(--ink-3)", fontSize: 11 }}>
            {centerLabel}
          </text>
          <text
            x={cx}
            y={cy + 15}
            textAnchor="middle"
            style={{ fill: "var(--ink)", fontSize: centerValue.length > 10 ? 14 : 17, fontWeight: 600 }}
          >
            {centerValue}
          </text>
        </svg>

        <ul className="w-full space-y-2 text-sm">
          {slices.map((slice) => (
            <li key={slice.label} className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 muted">
                <span className="h-3 w-3 shrink-0 rounded-sm" style={{ background: slice.color }} />
                {slice.label}
              </span>
              <span className="tabular-nums">{formatCurrency(slice.value)}</span>
            </li>
          ))}
        </ul>
      </div>
      <Tooltip tip={tip} />
    </div>
  );
}

/* ------------------------------------------------------------ bar chart --- */

export type QuarterBar = { label: string; value: number; sub?: string; sub2?: string };

export function QuarterBars({ bars }: { bars: QuarterBar[] }) {
  const [tip, setTip] = useState<Tip>(null);
  const { t } = useT();

  if (bars.length === 0) {
    return <div className="py-10 text-center text-sm faint">{t('chart.noQuarters')}</div>;
  }

  const width = 560;
  const height = 220;
  const padX = 44;
  const padY = 30;
  const plotW = width - padX - 16;
  const plotH = height - padY * 2;
  const max = Math.max(...bars.map((bar) => Math.abs(bar.value)), 1);
  // A zero line down the middle only earns its space when there are bars below it.
  const hasNegative = bars.some((bar) => bar.value < 0);
  const zeroY = hasNegative ? padY + plotH / 2 : padY + plotH;
  const usableH = hasNegative ? plotH / 2 : plotH;
  const scale = (value: number) => (value / max) * usableH;
  const slot = plotW / bars.length;
  const barW = Math.min(56, slot * 0.55);

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label="Net BTW per quarter">
        <line x1={padX} x2={width - 8} y1={zeroY} y2={zeroY} stroke={AXIS} strokeWidth={1} />
        <text x={8} y={zeroY + 4} style={{ fill: "var(--ink-3)", fontSize: 10 }}>€0</text>

        {bars.map((bar, index) => {
          const h = Math.abs(scale(bar.value));
          const x = padX + slot * index + (slot - barW) / 2;
          const y = bar.value >= 0 ? zeroY - h : zeroY;

          return (
            <g key={bar.label}>
              <rect
                x={x}
                y={y}
                width={barW}
                height={Math.max(h, 2)}
                rx={4}
                fill={SERIES.blue}
                onMouseEnter={() =>
                  setTip({
                    x: x + barW / 2,
                    y: bar.value >= 0 ? y : zeroY,
                    title: bar.label,
                    value: `${bar.value >= 0 ? 'To pay ' : 'To reclaim '}${formatCurrency(Math.abs(bar.value))}`,
                    sub: bar.sub,
                  })
                }
                onMouseLeave={() => setTip(null)}
              />
              <text
                x={x + barW / 2}
                y={bar.value >= 0 ? y - 6 : y + h + 14}
                textAnchor="middle"
                style={{ fill: "var(--ink-2)", fontSize: 11 }}
              >
                {formatCurrency(Math.abs(bar.value))}
              </text>
              <text
                x={x + barW / 2}
                y={bar.sub2 ? height - 16 : height - 4}
                textAnchor="middle"
                style={{ fill: "var(--ink-3)", fontSize: 11 }}
              >
                {bar.label}
              </text>
              {bar.sub2 && (
                <text
                  x={x + barW / 2}
                  y={height - 4}
                  textAnchor="middle"
                  style={{ fill: "var(--ink-3)", opacity: 0.75, fontSize: 9 }}
                >
                  {bar.sub2}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <Tooltip tip={tip} />
    </div>
  );
}

/* ----------------------------------------------------------- line chart --- */

export type LineSeries = { label: string; color: string; values: number[] };

export function ProjectionChart({
  months,
  series,
  actualThrough,
}: {
  months: string[];
  series: LineSeries[];
  /** Index of the last month backed by real data; everything after is projected. */
  actualThrough: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const { t } = useT();

  const width = 720;
  const height = 260;
  const padL = 56;
  const padR = 16;
  const padT = 16;
  const padB = 28;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;
  const max = Math.max(...series.flatMap((s) => s.values), 1);

  const x = (index: number) => padL + (index / Math.max(months.length - 1, 1)) * plotW;
  const y = (value: number) => padT + plotH - (value / max) * plotH;

  const line = (values: number[], from: number, to: number) =>
    values
      .slice(from, to + 1)
      .map((value, offset) => `${offset === 0 ? 'M' : 'L'}${x(from + offset)} ${y(value)}`)
      .join(' ');

  const ticks = [0, 0.5, 1].map((fraction) => max * fraction);

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        role="img"
        aria-label="Cumulative revenue and expenses with projection to year end"
        onMouseLeave={() => setHover(null)}
        onMouseMove={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          const px = ((event.clientX - rect.left) / rect.width) * width;
          const index = Math.round(((px - padL) / plotW) * (months.length - 1));
          setHover(Math.max(0, Math.min(months.length - 1, index)));
        }}
      >
        {ticks.map((tick) => (
          <g key={tick}>
            <line x1={padL} x2={width - padR} y1={y(tick)} y2={y(tick)} stroke={GRID} strokeWidth={1} />
            <text x={padL - 8} y={y(tick) + 4} textAnchor="end" style={{ fill: "var(--ink-3)", fontSize: 10 }}>
              €{Math.round(tick / 1000)}k
            </text>
          </g>
        ))}

        {months.map((month, index) => (
          <text key={month} x={x(index)} y={height - 8} textAnchor="middle" style={{ fill: "var(--ink-3)", fontSize: 10 }}>
            {month}
          </text>
        ))}

        {/* Projected region is visually separated so it never reads as recorded data. */}
        {actualThrough < months.length - 1 && (
          <rect
            x={x(actualThrough)}
            y={padT}
            width={x(months.length - 1) - x(actualThrough)}
            height={plotH}
            fill="var(--surface-sunken)"
          />
        )}

        {series.map((s) => (
          <g key={s.label}>
            <path d={line(s.values, 0, actualThrough)} fill="none" stroke={s.color} strokeWidth={2} />
            {actualThrough < months.length - 1 && (
              <path
                d={line(s.values, actualThrough, months.length - 1)}
                fill="none"
                stroke={s.color}
                strokeWidth={2}
                strokeDasharray="5 4"
              />
            )}
            <circle cx={x(actualThrough)} cy={y(s.values[actualThrough])} r={4.5} fill={s.color} stroke={SURFACE} strokeWidth={2} />
          </g>
        ))}

        {hover !== null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={padT} y2={padT + plotH} stroke="var(--ink-3)" strokeWidth={1} />
            {series.map((s) => (
              <circle key={s.label} cx={x(hover)} cy={y(s.values[hover])} r={5} fill={s.color} stroke={SURFACE} strokeWidth={2} />
            ))}
          </g>
        )}
      </svg>

      {hover !== null && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 card px-3 py-2 text-xs"
          style={{ left: `${(x(hover) / width) * 100}%`, top: 0 }}
        >
          <div className="font-medium">
            {months[hover]} {hover > actualThrough ? `(${t('bd.projected').toLowerCase()})` : ''}
          </div>
          {series.map((s) => (
            <div key={s.label} className="mt-0.5 flex items-center gap-2 muted">
              <span className="h-2 w-2 rounded-sm" style={{ background: s.color }} />
              {s.label}: <span className="tabular-nums">{formatCurrency(s.values[hover])}</span>
            </div>
          ))}
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-4 text-sm muted">
        {series.map((s) => (
          <span key={s.label} className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-sm" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
        <span className="flex items-center gap-2 faint">
          <svg width="22" height="8" aria-hidden>
            <line x1="0" y1="4" x2="22" y2="4" stroke={AXIS} strokeWidth={2} strokeDasharray="5 4" />
          </svg>
          {t('bd.projected')}
        </span>
      </div>
    </div>
  );
}

export type CategoryBar = {
  label: string;
  value: number;
  share: number;
  count: number;
  fixed: boolean;
};

/**
 * A ranked bar list rather than a pie: fourteen categories cannot be told apart
 * by hue, so length carries magnitude and the label carries identity. The only
 * thing colour encodes is the one split that is actually binary — a commitment
 * you cannot easily change this month versus spending you can.
 */
export function CategoryBars({ bars, fixedLabel, flexibleLabel }: {
  bars: CategoryBar[];
  fixedLabel: string;
  flexibleLabel: string;
}) {
  const { t } = useT();

  if (bars.length === 0) {
    return <div className="py-10 text-center text-sm faint">{t('chart.nothingYear')}</div>;
  }

  const max = Math.max(...bars.map((bar) => bar.value), 1);

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-4 text-sm">
        <span className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: 'var(--series-1)' }} />
          {fixedLabel}
        </span>
        <span className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: 'var(--series-2)' }} />
          {flexibleLabel}
        </span>
      </div>

      <div className="space-y-2.5">
        {bars.map((bar) => (
          <div key={bar.label} className="grid grid-cols-[minmax(96px,1.1fr)_3fr_auto] items-center gap-3">
            <div className="truncate text-sm" title={bar.label}>
              {bar.label}
            </div>

            <div className="h-5 rounded-[4px]" style={{ background: 'var(--surface-sunken)' }}>
              <div
                className="h-5 rounded-[4px]"
                style={{
                  width: `${Math.max(1.5, (bar.value / max) * 100)}%`,
                  background: bar.fixed ? 'var(--series-1)' : 'var(--series-2)',
                }}
                title={`${bar.count} transaction(s)`}
              />
            </div>

            <div className="whitespace-nowrap text-right text-sm tabular-nums">
              <span className="font-medium">{formatCurrency(bar.value)}</span>
              <span className="ml-2 faint">{(bar.share * 100).toFixed(1)}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
