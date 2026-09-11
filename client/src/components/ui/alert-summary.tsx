import { useMemo, useState } from 'react';
import { AlertCircle, AlertTriangle, Info } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

/**
 * AlertSummary — the funded-product answer to a wall of stacked alert banners.
 *
 * The failure it replaces: rendering N full-width banners (one per alert), so 3
 * near-identical "trial ends soon" boxes eat the whole above-the-fold before a
 * single metric is visible. Top dashboards (Linear/Vercel/Stripe) instead show
 * ONE compact strip — severity dots + counts + the top message + "View all" —
 * that opens a grouped, de-duplicated notification list on demand. Above the
 * fold belongs to answers (KPIs, the chart), not warnings.
 *
 * Grouping is the key move: alerts with the same `group` collapse into one row
 * with a count ("3 trials ending soon"), never one row per instance. Only a
 * single BLOCKING account-level alert (billing failed, pipeline down) earns a
 * real full-width banner — everything else is a strip row.
 *
 * Ref: NN/g "Indicators, Validations, Notifications" (match intrusiveness to
 * urgency); Linear "How we redesigned the Linear UI"; Vercel Geist materials.
 */

export type AlertLevel = 'critical' | 'warning' | 'info';

export interface AlertItem {
  id: string;
  title: string;
  level: AlertLevel;
  /** alerts sharing a group collapse into one counted row */
  group?: string;
  /** relative, now-anchored time ("2h ago") — never "738 days ago" */
  time?: string;
  href?: string;
  /** a single blocking, account-level alert may render as a full banner */
  blocking?: boolean;
}

const LEVEL_ORDER: Record<AlertLevel, number> = { critical: 0, warning: 1, info: 2 };

const LEVEL_META: Record<
  AlertLevel,
  { dot: string; icon: typeof AlertCircle; banner: string; text: string; label: string }
> = {
  critical: {
    dot: 'bg-rose-500',
    icon: AlertCircle,
    banner: 'border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300',
    text: 'text-rose-600 dark:text-rose-400',
    label: 'Critical',
  },
  warning: {
    dot: 'bg-amber-500',
    icon: AlertTriangle,
    banner: 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300',
    text: 'text-amber-600 dark:text-amber-400',
    label: 'Warning',
  },
  info: {
    dot: 'bg-sky-500',
    icon: Info,
    banner: 'border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300',
    text: 'text-sky-600 dark:text-sky-400',
    label: 'Info',
  },
};

interface Group {
  key: string;
  level: AlertLevel;
  title: string;
  count: number;
  items: AlertItem[];
  time?: string;
  href?: string;
}

function groupAlerts(alerts: AlertItem[]): Group[] {
  const map = new Map<string, Group>();
  for (const a of alerts) {
    const key = a.group ?? a.id;
    const existing = map.get(key);
    if (existing) {
      existing.count += 1;
      existing.items.push(a);
      // keep the highest severity for the group
      if (LEVEL_ORDER[a.level] < LEVEL_ORDER[existing.level]) existing.level = a.level;
    } else {
      map.set(key, {
        key,
        level: a.level,
        title: a.title,
        count: 1,
        items: [a],
        time: a.time,
        href: a.href,
      });
    }
  }
  return [...map.values()].sort((x, y) => LEVEL_ORDER[x.level] - LEVEL_ORDER[y.level]);
}

function AlertBanner({ alert }: { alert: AlertItem }) {
  const meta = LEVEL_META[alert.level];
  const Icon = meta.icon;
  return (
    <a
      href={alert.href ?? '#'}
      className={cn(
        'flex items-center gap-2.5 rounded-lg border px-4 py-3 text-sm font-medium transition-colors',
        meta.banner,
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="truncate">{alert.title}</span>
    </a>
  );
}

export function AlertSummary({ alerts, className }: { alerts: AlertItem[]; className?: string }) {
  const [open, setOpen] = useState(false);
  const blocking = useMemo(
    () => alerts.find((a) => a.blocking && a.level === 'critical'),
    [alerts],
  );
  const rest = useMemo(() => alerts.filter((a) => a !== blocking), [alerts, blocking]);
  const groups = useMemo(() => groupAlerts(rest), [rest]);

  const counts = useMemo(() => {
    const c: Record<AlertLevel, number> = { critical: 0, warning: 0, info: 0 };
    for (const a of rest) c[a.level] += 1;
    return c;
  }, [rest]);

  if (!alerts.length) return null;

  const top = groups[0];
  const totalGroups = groups.length;

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {blocking ? <AlertBanner alert={blocking} /> : null}

      {totalGroups > 0 ? (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="flex h-11 w-full items-center gap-3 rounded-lg border border-border bg-muted/40 px-4 text-sm transition-colors hover:bg-muted"
            >
              <span className="flex items-center gap-2">
                {(['critical', 'warning', 'info'] as AlertLevel[])
                  .filter((l) => counts[l] > 0)
                  .map((l) => (
                    <span key={l} className="flex items-center gap-1 tabular-nums">
                      <span className={cn('h-2 w-2 rounded-full', LEVEL_META[l].dot)} />
                      {counts[l]}
                    </span>
                  ))}
              </span>
              {top ? (
                <span className="min-w-0 flex-1 truncate text-left text-foreground/80">
                  {top.count > 1 ? `${top.count} ${top.title}` : top.title}
                </span>
              ) : (
                <span className="flex-1" />
              )}
              <span className="ml-auto shrink-0 text-muted-foreground">
                View all ({rest.length}) &rarr;
              </span>
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-[min(24rem,90vw)] p-0">
            <div className="border-b border-border px-3 py-2.5 text-sm font-semibold">
              Notifications
            </div>
            <div className="max-h-[24rem] overflow-y-auto py-1">
              {groups.map((g) => {
                const meta = LEVEL_META[g.level];
                const Icon = meta.icon;
                return (
                  <a
                    key={g.key}
                    href={g.href ?? '#'}
                    className="flex items-start gap-2.5 px-3 py-2.5 transition-colors hover:bg-muted/50"
                  >
                    <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', meta.text)} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">
                        {g.count > 1 ? `${g.count} ${g.title}` : g.title}
                      </p>
                      {g.time || g.count > 1 ? (
                        <p className="text-xs text-muted-foreground">
                          {g.count > 1 ? `${g.count} affected` : ''}
                          {g.count > 1 && g.time ? ' · ' : ''}
                          {g.time ?? ''}
                        </p>
                      ) : null}
                    </div>
                  </a>
                );
              })}
            </div>
          </PopoverContent>
        </Popover>
      ) : null}
    </div>
  );
}
