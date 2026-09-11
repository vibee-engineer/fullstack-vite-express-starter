import { useEffect, useRef, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Sparkline, type ChartDatum } from '@/components/ui/chart';

/**
 * StatCard — a single headline metric with a trend delta, done to the funded-
 * product bar. Two ideas make it read right where generic KPI cards go wrong:
 *
 * 1. The delta's ARROW, SIGN, and COLOR are decoupled (the churn bug fix). The
 *    arrow follows the raw DIRECTION of the number, the sign is literal, and the
 *    COLOUR follows MEANING via `higherIsBetter`. So for churn (higherIsBetter
 *    = false) a decrease renders a DOWN arrow, a "-0.8%" sign, and GREEN — never
 *    the incoherent green up-arrow next to a negative number.
 * 2. The hero number is set in the MONO family with tabular figures (funded-app
 *    signature) and counts up on change over ~350ms (the one signature motion).
 *
 * Only use a row of these when the app's core object really is money / metrics
 * over time. A stat strip bolted onto a records or content app is the generic-
 * SaaS tell.
 */

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => setReduced(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return reduced;
}

/** Count from the previous value to `target` over `duration` ms, ease-out. */
function useCountUp(target: number, duration = 350): number {
  const reduced = useReducedMotion();
  const [display, setDisplay] = useState(target);
  const fromRef = useRef(target);
  const rafRef = useRef<number | null>(null);
  useEffect(() => {
    if (reduced) {
      setDisplay(target);
      fromRef.current = target;
      return;
    }
    const from = fromRef.current;
    if (from === target) return;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      setDisplay(from + (target - from) * eased);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = target;
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      fromRef.current = target;
    };
  }, [target, duration, reduced]);
  return display;
}

export type Direction = 'up' | 'down' | 'flat';

export function StatCard({
  label,
  value,
  format = (n) => Math.round(n).toLocaleString(),
  delta,
  direction = 'flat',
  higherIsBetter = true,
  icon: Icon,
  hint,
  sparkline,
  className,
}: {
  label: string;
  /** a number animates a count-up via `format`; a node/string renders as-is */
  value: number | React.ReactNode;
  format?: (n: number) => string;
  /** signed change label ("+12.4%", "-0.8%") — shown literally */
  delta?: string;
  /** raw direction of the change — drives the ARROW, not the colour */
  direction?: Direction;
  /** does an increase mean good? false for churn / cost / latency / error rate */
  higherIsBetter?: boolean;
  icon?: LucideIcon;
  hint?: string;
  /** optional trend series (>=7 points) rendered as a sparkline */
  sparkline?: ChartDatum[];
  className?: string;
}) {
  const isNumber = typeof value === 'number';
  const counted = useCountUp(isNumber ? (value as number) : 0);

  // colour = whether the move is GOOD; arrow = the raw direction of the move.
  const isGood = direction === 'up' ? higherIsBetter : direction === 'down' ? !higherIsBetter : null;
  const deltaPill =
    isGood === null
      ? 'bg-muted text-muted-foreground'
      : isGood
        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
        : 'bg-rose-500/10 text-rose-600 dark:text-rose-400';
  const ArrowIcon = direction === 'up' ? ArrowUpRight : direction === 'down' ? ArrowDownRight : Minus;
  const sparkTone = isGood === null ? 'accent' : isGood ? 'positive' : 'negative';

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
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="h-[18px] w-[18px]" />
          </span>
        ) : null}
      </div>
      <div className="mt-3 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
        <div className="font-mono text-3xl font-semibold leading-none tracking-tight tabular-nums">
          {isNumber ? format(counted) : value}
        </div>
        {delta ? (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-semibold tabular-nums',
              deltaPill,
            )}
          >
            <ArrowIcon className="h-3 w-3" />
            {delta}
          </span>
        ) : null}
      </div>
      {hint ? <div className="mt-1.5 text-xs text-muted-foreground">{hint}</div> : null}
      {sparkline && sparkline.length >= 7 ? (
        <div className="mt-3 -mb-1">
          <Sparkline data={sparkline} tone={sparkTone} height={40} />
        </div>
      ) : null}
    </div>
  );
}
