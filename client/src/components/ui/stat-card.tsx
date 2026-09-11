import type { LucideIcon } from 'lucide-react';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * StatCard — a single metric with an optional trend delta and icon. Purpose-
 * built so a dashboard doesn't hand-roll a different KPI card each time (and so
 * the delta is colored by meaning, not decoration).
 *
 * Only reach for a row of these when the app's core object really is money /
 * metrics over time. A stat strip bolted onto a records or content app is the
 * generic-SaaS tell.
 *
 * Props:
 *   label   metric name ("Revenue")
 *   value   the formatted value ("$148,300") — format upstream
 *   delta   optional change label ("+12.4%"); trend colors the arrow + text
 *   trend   'up' | 'down' | 'flat' — semantic direction (up isn't always good;
 *           pass explicitly so "churn +2%" can read as bad if you want)
 *   icon    optional lucide icon in the corner
 *   hint    small caption under the value ("vs last month")
 */
export function StatCard({
  label,
  value,
  delta,
  trend = 'flat',
  icon: Icon,
  hint,
  className,
}: {
  label: string;
  value: React.ReactNode;
  delta?: string;
  trend?: 'up' | 'down' | 'flat';
  icon?: LucideIcon;
  hint?: string;
  className?: string;
}) {
  const trendColor =
    trend === 'up'
      ? 'text-emerald-600 dark:text-emerald-400'
      : trend === 'down'
        ? 'text-rose-600 dark:text-rose-400'
        : 'text-muted-foreground';
  const TrendIcon = trend === 'up' ? ArrowUpRight : trend === 'down' ? ArrowDownRight : null;
  const deltaPill =
    trend === 'up'
      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
      : trend === 'down'
        ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
        : 'bg-muted text-muted-foreground';

  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-xl border border-border bg-card p-5 text-card-foreground shadow-xs transition-shadow duration-200 ease-out hover:shadow-md',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="text-sm font-medium text-muted-foreground">{label}</div>
        {Icon ? (
          // Icon sits in a brand-tinted chip, not a faint grey glyph in the void.
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="h-[18px] w-[18px]" />
          </span>
        ) : null}
      </div>
      <div className="mt-3 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
        <div className="font-heading text-3xl font-semibold leading-none tracking-tight tabular-nums">
          {value}
        </div>
        {delta ? (
          // Delta as a coloured pill reads at a glance; the arrow reinforces the
          // direction. `trend` is semantic, so "churn +2%" can still read red.
          <span
            className={cn(
              'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-semibold tabular-nums',
              deltaPill,
            )}
          >
            {TrendIcon ? <TrendIcon className="h-3 w-3" /> : null}
            {delta}
          </span>
        ) : null}
      </div>
      {hint ? <div className="mt-1.5 text-xs text-muted-foreground">{hint}</div> : null}
    </div>
  );
}
