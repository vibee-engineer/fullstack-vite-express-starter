import type { LucideIcon } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

/**
 * StatCard — one number in a KPI row.
 *
 * Dashboards should open with the two-to-four numbers that answer "how am I
 * doing", then go into detail. A measured build opened straight with a 30-day
 * line chart and no summary numbers at all, which reads as a report rather than
 * a dashboard.
 *
 * `tabular-nums` on the value is not cosmetic: proportional digits change width
 * as the value changes, so a number that re-renders (a live count, a percentage
 * ticking up) visibly jitters and a column of them fails to align. Vercel's
 * Geist docs call for tabular figures "when conveying numbers"; use them for
 * every metric, table numeral, currency and timer. Never for prose.
 *
 * `delta` is the change versus the previous period. Pass the sign in the string
 * ("+12%", "-3"); `trend` only decides the colour, so a metric where down is
 * good (error rate, churn) can pass trend="up" for a negative delta.
 */
export function StatCard({
  label,
  value,
  delta,
  trend = 'flat',
  hint,
  icon: Icon,
  className,
}: {
  label: string;
  value: string | number;
  /** e.g. "+12%" — include the sign. */
  delta?: string;
  /** Colour only: 'up' reads positive, 'down' negative, 'flat' muted. */
  trend?: 'up' | 'down' | 'flat';
  /** Small clarifier under the value, e.g. "last 30 days". */
  hint?: string;
  icon?: LucideIcon;
  className?: string;
}) {
  return (
    <Card className={cn('gap-0 py-4', className)}>
      <CardContent className="px-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm text-muted-foreground">{label}</span>
          {Icon ? <Icon aria-hidden className="size-4 shrink-0 text-muted-foreground" /> : null}
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-2xl font-semibold tabular-nums tracking-tight">{value}</span>
          {delta ? (
            <span
              className={cn(
                'text-xs font-medium tabular-nums',
                trend === 'up' && 'text-emerald-600 dark:text-emerald-400',
                trend === 'down' && 'text-destructive',
                trend === 'flat' && 'text-muted-foreground',
              )}
            >
              {delta}
            </span>
          ) : null}
        </div>
        {hint ? <div className="mt-1 text-xs text-muted-foreground">{hint}</div> : null}
      </CardContent>
    </Card>
  );
}
