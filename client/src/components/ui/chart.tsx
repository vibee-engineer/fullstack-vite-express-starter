import { useEffect, useId, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { cn } from '@/lib/utils';

/**
 * Chart — the premium time-series primitive so a dashboard never hand-rolls a
 * bare, flat recharts line again. What separates a funded product's chart from a
 * jsfiddle: a gradient AREA fill (not a naked line), a monotone curve that can't
 * overshoot/fabricate values, horizontal-only dashed gridlines, stripped axis
 * chrome, compact-currency axis labels ($22.8k, not 22800), a custom tooltip
 * with a vertical crosshair, and colors read from the app's own CSS tokens so it
 * is theme-aware with zero hardcoded hex.
 *
 * Refs: Tremor AreaChart (gradient stops 5%/95%), D3 curve reference (monotone
 * never overshoots; natural/basis/catmullRom do), Datawrapper (never dual-axis).
 *
 * Adapt it per app — restyle, add a second series, swap the accent — but keep
 * the floor: gradient fill, safe curve, tokenized colors, a real hover layer.
 */

// ---------------------------------------------------------------------------
// Theme-aware token resolution. tokens.css holds bare HSL triplets (e.g.
// `--chart-1: 240 80% 60%`), so we resolve them to `hsl(...)` strings at runtime
// and re-read whenever the theme flips (.dark class, data-theme, or the system
// preference) — recharts takes color strings on SVG attributes, not var().
// ---------------------------------------------------------------------------
const TOKEN_KEYS = [
  '--chart-1',
  '--chart-2',
  '--chart-3',
  '--chart-4',
  '--chart-5',
  '--border',
  '--muted-foreground',
  '--foreground',
  '--popover',
  '--card',
] as const;

type TokenKey = (typeof TOKEN_KEYS)[number];
type ResolvedTokens = Record<TokenKey, string>;

function readTokens(): ResolvedTokens {
  const out = {} as ResolvedTokens;
  if (typeof window === 'undefined') {
    // SSR / test fallback — a neutral, legible default so nothing throws.
    for (const k of TOKEN_KEYS) out[k] = k === '--foreground' ? '#0f172a' : '#94a3b8';
    return out;
  }
  const cs = getComputedStyle(document.documentElement);
  for (const k of TOKEN_KEYS) {
    const raw = cs.getPropertyValue(k).trim();
    out[k] = raw ? `hsl(${raw})` : 'currentColor';
  }
  return out;
}

/** Resolved theme colors that update on theme change. */
export function useChartTokens(): ResolvedTokens {
  const [tokens, setTokens] = useState<ResolvedTokens>(readTokens);
  useEffect(() => {
    const update = () => setTokens(readTokens());
    update();
    const mo = new MutationObserver(update);
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'style', 'data-theme'],
    });
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', update);
    return () => {
      mo.disconnect();
      mq.removeEventListener('change', update);
    };
  }, []);
  return tokens;
}

// ---------------------------------------------------------------------------
// Formatters — export so callers format axes/tooltips consistently. Pinned to
// en-US so compaction is the funded-SaaS K/M/B ($22.8K, $1.2M) on every runtime,
// not the viewer-locale surprise ($12.0L in en-IN). Pass `locale` to localise.
// ---------------------------------------------------------------------------
export function formatCompactCurrency(n: number, currency = 'USD', locale = 'en-US'): string {
  return new Intl.NumberFormat(locale, {
    notation: 'compact',
    style: 'currency',
    currency,
    maximumFractionDigits: 1,
  }).format(n);
}

export function formatCompactNumber(n: number, locale = 'en-US'): string {
  return new Intl.NumberFormat(locale, {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(n);
}

export function formatCurrency(n: number, currency = 'USD', locale = 'en-US'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(n);
}

type ValueFormat = 'currency' | 'number' | 'percent';

function formatterFor(fmt: ValueFormat, compact: boolean, currency = 'USD') {
  return (n: number) => {
    if (n == null || Number.isNaN(n)) return '';
    if (fmt === 'percent') return `${n.toFixed(1)}%`;
    if (fmt === 'currency')
      return compact ? formatCompactCurrency(n, currency) : formatCurrency(n, currency);
    return compact ? formatCompactNumber(n) : new Intl.NumberFormat('en-US').format(n);
  };
}

// ---------------------------------------------------------------------------
// Custom tooltip — value leads (bold, large), label follows (muted). Inserts
// strings via React children (textContent), never innerHTML: labels are data.
// ---------------------------------------------------------------------------
function ChartTooltip({
  active,
  payload,
  label,
  tokens,
  valueFmt,
  xFormat,
}: {
  active?: boolean;
  payload?: Array<{
    value?: number | string | (number | string)[];
    name?: string;
    dataKey?: string | number;
  }>;
  label?: string | number;
  tokens: ResolvedTokens;
  valueFmt: (n: number) => string;
  xFormat?: (v: string | number) => string;
}) {
  if (!active || !payload?.length) return null;
  const heading = xFormat && label != null ? xFormat(label) : String(label ?? '');
  return (
    <div
      style={{
        background: tokens['--popover'],
        border: `1px solid ${tokens['--border']}`,
        borderRadius: 10,
        padding: '9px 12px',
        boxShadow: 'var(--shadow-lg)',
        minWidth: 120,
      }}
    >
      <div style={{ color: tokens['--muted-foreground'], fontSize: 12, marginBottom: 3 }}>
        {heading}
      </div>
      {payload.map((p, i) => (
        <div
          key={i}
          style={{
            color: tokens['--foreground'],
            fontWeight: 600,
            fontSize: 15,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {valueFmt(Number(Array.isArray(p.value) ? p.value[p.value.length - 1] : p.value))}
        </div>
      ))}
    </div>
  );
}

export type ChartDatum = Record<string, string | number | null>;

export function Chart({
  data,
  xKey,
  series,
  type = 'area',
  valueFormat = 'number',
  currency = 'USD',
  xFormat,
  height = 280,
  emptyLabel = 'No data in this range',
  className,
}: {
  data: ChartDatum[];
  /** key on each datum for the x axis (e.g. 'month', 'date') */
  xKey: string;
  /** one or more series keys to plot (first is the primary accent) */
  series: string | string[];
  type?: 'area' | 'line' | 'bar';
  valueFormat?: ValueFormat;
  currency?: string;
  /** format an x tick / tooltip heading (e.g. a date) */
  xFormat?: (v: string | number) => string;
  height?: number;
  emptyLabel?: string;
  className?: string;
}) {
  const tokens = useChartTokens();
  const gradId = useId().replace(/:/g, ''); // unique per instance; ':' is invalid in SVG ids
  const keys = useMemo(() => (Array.isArray(series) ? series : [series]), [series]);
  const accents = [
    tokens['--chart-1'],
    tokens['--chart-2'],
    tokens['--chart-3'],
    tokens['--chart-4'],
    tokens['--chart-5'],
  ];
  const valueFmt = formatterFor(valueFormat, false, currency);
  const axisFmt = formatterFor(valueFormat, true, currency);

  // True empty state — never a bare axis frame; render a calm message at height.
  if (!data?.length) {
    return (
      <div
        className={cn('grid place-items-center text-sm text-muted-foreground', className)}
        style={{ height }}
      >
        {emptyLabel}
      </div>
    );
  }

  const gridProps = {
    vertical: false,
    strokeDasharray: '3 3',
    stroke: tokens['--border'],
  } as const;
  const xAxisProps = {
    dataKey: xKey,
    axisLine: false,
    tickLine: false,
    minTickGap: 32,
    dy: 8,
    tick: { fill: tokens['--muted-foreground'], fontSize: 12 },
    tickFormatter: xFormat as ((v: unknown) => string) | undefined,
  } as const;
  const yAxisProps = {
    axisLine: false,
    tickLine: false,
    width: 52,
    tickCount: 5,
    tick: { fill: tokens['--muted-foreground'], fontSize: 12 },
    tickFormatter: axisFmt as (v: number) => string,
  } as const;
  const tooltip = (
    <Tooltip
      content={(props: { active?: boolean; payload?: unknown; label?: string | number }) => (
        <ChartTooltip
          active={props.active}
          payload={props.payload as never}
          label={props.label}
          tokens={tokens}
          valueFmt={valueFmt}
          xFormat={xFormat}
        />
      )}
      cursor={{ stroke: tokens['--border'], strokeWidth: 1, strokeDasharray: '3 3' }}
    />
  );

  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height={height}>
        {type === 'bar' ? (
          <BarChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid {...gridProps} />
            <XAxis {...xAxisProps} />
            <YAxis {...yAxisProps} />
            {tooltip}
            {keys.map((k, i) => (
              <Bar key={k} dataKey={k} fill={accents[i % accents.length]} radius={[4, 4, 0, 0]} />
            ))}
          </BarChart>
        ) : type === 'line' ? (
          <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid {...gridProps} />
            <XAxis {...xAxisProps} />
            <YAxis {...yAxisProps} />
            {tooltip}
            {keys.map((k, i) => (
              <Line
                key={k}
                type="monotone"
                dataKey={k}
                stroke={accents[i % accents.length]}
                strokeWidth={2}
                dot={false}
                activeDot={{
                  r: 4,
                  fill: accents[i % accents.length],
                  stroke: tokens['--card'],
                  strokeWidth: 2,
                }}
                connectNulls={false}
                isAnimationActive
                animationDuration={600}
              />
            ))}
          </LineChart>
        ) : (
          <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
            <defs>
              {keys.map((k, i) => (
                <linearGradient key={k} id={`${gradId}-${i}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={accents[i % accents.length]} stopOpacity={0.32} />
                  <stop offset="95%" stopColor={accents[i % accents.length]} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid {...gridProps} />
            <XAxis {...xAxisProps} />
            <YAxis {...yAxisProps} />
            {tooltip}
            {keys.map((k, i) => (
              <Area
                key={k}
                type="monotone"
                dataKey={k}
                stroke={accents[i % accents.length]}
                strokeWidth={2}
                fill={`url(#${gradId}-${i})`}
                dot={false}
                activeDot={{
                  r: 4,
                  fill: accents[i % accents.length],
                  stroke: tokens['--card'],
                  strokeWidth: 2,
                }}
                connectNulls={false}
                isAnimationActive
                animationDuration={600}
              />
            ))}
          </AreaChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Sparkline — a tiny axis-less trend line for a KPI card. Same curve + gradient
 * as Chart, no grid/axes/tooltip. Give it >=7 points or omit it (a 2-point spark
 * is noise). `tone` optionally recolors the trend to reinforce a delta's meaning.
 */
export function Sparkline({
  data,
  dataKey = 'value',
  height = 44,
  tone = 'accent',
  className,
}: {
  data: ChartDatum[];
  dataKey?: string;
  height?: number;
  tone?: 'accent' | 'positive' | 'negative';
  className?: string;
}) {
  const tokens = useChartTokens();
  const gradId = useId().replace(/:/g, '');
  if (!data || data.length < 2) return null;
  const color =
    tone === 'positive'
      ? 'hsl(142 71% 45%)'
      : tone === 'negative'
        ? 'hsl(347 77% 50%)'
        : tokens['--chart-1'];
  return (
    <div className={className} style={{ height }}>
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.28} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey={dataKey}
            stroke={color}
            strokeWidth={2}
            fill={`url(#${gradId})`}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
