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

  return (
    <div className={cn('rounded-lg border border-border bg-card p-5 text-card-foreground', className)}>
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium text-muted-foreground">{label}</div>
        {Icon ? <Icon className="h-4 w-4 text-muted-foreground/70" /> : null}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <div className="text-2xl font-semibold tracking-tight tabular-nums">{value}</div>
        {delta ? (
          <span className={cn('inline-flex items-center gap-0.5 text-xs font-medium', trendColor)}>
            {TrendIcon ? <TrendIcon className="h-3 w-3" /> : null}
            {delta}
          </span>
        ) : null}
      </div>
      {hint ? <div className="mt-1 text-xs text-muted-foreground">{hint}</div> : null}
    </div>
  );
}
