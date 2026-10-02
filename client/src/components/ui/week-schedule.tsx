import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { addDays, format, isSameDay, startOfDay } from 'date-fns';

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

/**
 * week-schedule.tsx — a week time-grid for sessions, shifts, bookings.
 *
 * Hand-rolled week calendars are where scheduling apps break: overlapping
 * sessions squeezed into ever-thinner columns until each chip shows one or two
 * letters ("M..", "Dieg…"). This view lays a day out the standard way (events
 * that overlap form a cluster, every member shares the cluster's column count,
 * a column is reused once its event ends) and then CAPS the columns: past
 * `maxColumns`, the rest collapse into a "+N more" chip that opens the full
 * list. Chips also get a minimum height, the full text as an accessible label,
 * and the grid scrolls sideways (with an edge fade) rather than shrinking.
 * Below `md` it renders as a day-by-day agenda instead.
 *
 * The PARENT owns the data: pass `events` for the visible week and handle
 * `onEventClick`. Filter per staff member in the parent (one person's week is
 * the readable default for a staff calendar).
 */

/** primary / muted / destructive, or a chart-N token to colour by staff member or service */
export type ScheduleTone =
  | 'default'
  | 'primary'
  | 'destructive'
  | 'muted'
  | 'chart-1'
  | 'chart-2'
  | 'chart-3'
  | 'chart-4'
  | 'chart-5';

export type ScheduleEvent = {
  id: string;
  start: Date | string;
  end: Date | string;
  /** the line staff scan for: usually the patient / client / shift name */
  title: string;
  /** e.g. the service, room or therapist; shown when the chip has room */
  subtitle?: string;
  tone?: ScheduleTone;
  /** cancelled sessions stay visible, struck through, so the gap is explained */
  cancelled?: boolean;
};

export type PositionedEvent = {
  event: ScheduleEvent;
  start: Date;
  end: Date;
  /** column index inside its cluster */
  col: number;
  /** columns the cluster is split into (after the cap) */
  cols: number;
};

export type OverflowMarker = {
  /** events hidden from this cluster, in start order */
  events: ScheduleEvent[];
  start: Date;
  end: Date;
  col: number;
  cols: number;
};

const toDate = (d: Date | string) => (d instanceof Date ? d : new Date(d));

/**
 * layoutDay — columns for one day's events. Pure, so it is unit-tested directly.
 *
 * Events are sorted by start (longer first on ties), grouped into clusters of
 * transitively overlapping events, and each gets the first column whose last
 * event has already ended. A cluster needing more than `maxColumns` keeps the
 * first `maxColumns - 1` columns and folds every other event into one overflow
 * marker in the last column, so no chip is ever narrower than 1 / maxColumns.
 */
export function layoutDay(
  events: ScheduleEvent[],
  maxColumns = 3,
): { placed: PositionedEvent[]; overflow: OverflowMarker[] } {
  const cap = Math.max(1, Math.floor(maxColumns));
  const items = events
    .map((event) => ({ event, start: toDate(event.start), end: toDate(event.end) }))
    .filter((x) => !Number.isNaN(x.start.getTime()) && !Number.isNaN(x.end.getTime()))
    .map((x) => (x.end <= x.start ? { ...x, end: new Date(x.start.getTime() + 15 * 60_000) } : x))
    .sort(
      (a, b) =>
        a.start.getTime() - b.start.getTime() ||
        b.end.getTime() - a.end.getTime() ||
        a.event.id.localeCompare(b.event.id),
    );

  const placed: PositionedEvent[] = [];
  const overflow: OverflowMarker[] = [];

  let cluster: { item: (typeof items)[number]; col: number }[] = [];
  let clusterEnd = -Infinity;
  let colEnds: number[] = [];

  const flush = () => {
    if (!cluster.length) return;
    const needed = colEnds.length;
    if (needed <= cap) {
      for (const { item, col } of cluster) placed.push({ ...item, col, cols: needed });
    } else {
      const keep = cap - 1;
      const hidden = cluster.filter((c) => c.col >= keep).map((c) => c.item);
      for (const { item, col } of cluster) {
        if (col < keep) placed.push({ ...item, col, cols: cap });
      }
      overflow.push({
        events: hidden.map((h) => h.event),
        start: new Date(Math.min(...hidden.map((h) => h.start.getTime()))),
        end: new Date(Math.max(...hidden.map((h) => h.end.getTime()))),
        col: keep,
        cols: cap,
      });
    }
    cluster = [];
    colEnds = [];
    clusterEnd = -Infinity;
  };

  for (const item of items) {
    const s = item.start.getTime();
    if (s >= clusterEnd) flush();
    let col = colEnds.findIndex((end) => end <= s);
    if (col === -1) {
      col = colEnds.length;
      colEnds.push(item.end.getTime());
    } else {
      colEnds[col] = item.end.getTime();
    }
    cluster.push({ item, col });
    clusterEnd = Math.max(clusterEnd, item.end.getTime());
  }
  flush();
  return { placed, overflow };
}

const TONE: Record<ScheduleTone, string> = {
  default: 'border-border bg-card text-card-foreground',
  primary: 'border-primary/40 bg-primary/10 text-foreground',
  // Literal class strings so Tailwind's scanner sees every one of them.
  'chart-1': 'border-chart-1/40 bg-chart-1/10 text-foreground',
  'chart-2': 'border-chart-2/40 bg-chart-2/10 text-foreground',
  'chart-3': 'border-chart-3/40 bg-chart-3/10 text-foreground',
  'chart-4': 'border-chart-4/40 bg-chart-4/10 text-foreground',
  'chart-5': 'border-chart-5/40 bg-chart-5/10 text-foreground',
  destructive: 'border-destructive/40 bg-destructive/10 text-foreground',
  muted: 'border-border bg-muted text-muted-foreground',
};

type WeekScheduleProps = {
  /** first day shown (any time on that day) */
  weekStart: Date;
  /** 7 for a full week, 5 for Mon-Fri, 1 for a single day */
  days?: number;
  events: ScheduleEvent[];
  /** first and last hour of the grid (24h), default 7 and 19 */
  startHour?: number;
  endHour?: number;
  /** pixels per hour; 56 keeps a 30 min session two lines tall */
  hourHeight?: number;
  /** column cap per overlapping cluster; default 3 for 5 days or fewer, else 2 */
  maxColumns?: number;
  onEventClick?: (event: ScheduleEvent) => void;
  /** time format, default 24h "HH:mm" */
  formatTime?: (d: Date) => string;
  /** override the chip body; the chip itself (position, label, click) stays ours */
  renderEvent?: (
    event: ScheduleEvent,
    ctx: { start: Date; end: Date; compact: boolean },
  ) => ReactNode;
  /** marks today and draws the current-time line; pass a fixed date in tests */
  now?: Date;
  /** shown in the agenda for a day with nothing on it */
  emptyDayLabel?: string;
  className?: string;
};

const MIN_CHIP_PX = 24;

export function WeekSchedule({
  weekStart,
  days = 7,
  events,
  startHour = 7,
  endHour = 19,
  hourHeight = 56,
  maxColumns,
  onEventClick,
  formatTime = (d) => format(d, 'HH:mm'),
  renderEvent,
  now = new Date(),
  emptyDayLabel = 'Nothing booked',
  className,
}: WeekScheduleProps) {
  const dayList = useMemo(
    () => Array.from({ length: Math.max(1, days) }, (_, i) => addDays(startOfDay(weekStart), i)),
    [weekStart, days],
  );
  const cap = maxColumns ?? (days <= 5 ? 3 : 2);
  // The edge fade is a scroll affordance, so it shows only when the grid really
  // overflows; drawn unconditionally it dims the last day's chips for nothing.
  const scroller = useRef<HTMLDivElement>(null);
  const [overflows, setOverflows] = useState(false);
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const check = () => setOverflows(el.scrollWidth - el.clientWidth - el.scrollLeft > 1);
    check();
    el.addEventListener('scroll', check, { passive: true });
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(check);
    ro?.observe(el);
    return () => {
      el.removeEventListener('scroll', check);
      ro?.disconnect();
    };
  }, []);
  const hours = Array.from({ length: Math.max(1, endHour - startHour) }, (_, i) => startHour + i);
  const gridHeight = hours.length * hourHeight;

  const byDay = useMemo(
    () =>
      dayList.map((day) => {
        const mine = events.filter((e) => isSameDay(toDate(e.start), day));
        return { day, events: mine, ...layoutDay(mine, cap) };
      }),
    [dayList, events, cap],
  );

  const topFor = (d: Date) => {
    const mins = (d.getHours() - startHour) * 60 + d.getMinutes();
    return Math.min(Math.max((mins / 60) * hourHeight, 0), gridHeight);
  };
  const heightFor = (s: Date, e: Date) => Math.max(topFor(e) - topFor(s), MIN_CHIP_PX);
  const labelFor = (ev: ScheduleEvent, s: Date, e: Date) =>
    `${formatTime(s)} to ${formatTime(e)}, ${ev.title}${ev.subtitle ? `, ${ev.subtitle}` : ''}${ev.cancelled ? ', cancelled' : ''}`;

  // `oneLine` below ~40px: a 30 min session at the default scale has room for one
  // line, and two stacked lines there overlap each other.
  const chip = (
    p: { event: ScheduleEvent; start: Date; end: Date },
    compact: boolean,
    oneLine = false,
  ) => (
    <button
      type="button"
      onClick={onEventClick ? () => onEventClick(p.event) : undefined}
      aria-label={labelFor(p.event, p.start, p.end)}
      title={labelFor(p.event, p.start, p.end)}
      className={cn(
        'flex h-full w-full flex-col overflow-hidden rounded-md border px-1.5 py-1 text-left text-xs leading-tight shadow-xs transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        onEventClick ? 'cursor-pointer hover:brightness-95' : 'cursor-default',
        TONE[p.event.tone ?? 'primary'],
        p.event.cancelled && 'border-dashed opacity-70 line-through',
      )}
    >
      {renderEvent ? (
        renderEvent(p.event, { start: p.start, end: p.end, compact })
      ) : oneLine ? (
        <span className="truncate">
          <span className="tabular-nums text-muted-foreground">{formatTime(p.start)}</span>{' '}
          <span className="font-medium">{p.event.title}</span>
        </span>
      ) : (
        <>
          <span className="truncate font-medium">{p.event.title}</span>
          <span className="truncate tabular-nums text-muted-foreground">
            {formatTime(p.start)}
            {!compact && p.event.subtitle ? ` · ${p.event.subtitle}` : ''}
          </span>
        </>
      )}
    </button>
  );

  return (
    <div className={cn('w-full', className)}>
      {/* Time grid, md and up. Scrolls sideways instead of squeezing columns. */}
      <div className="relative hidden md:block">
        <div ref={scroller} className="overflow-x-auto rounded-lg border border-border bg-card">
          <div className="min-w-[720px]">
            <div
              className="grid border-b border-border"
              style={{ gridTemplateColumns: `3.5rem repeat(${dayList.length}, minmax(0, 1fr))` }}
            >
              <div />
              {dayList.map((day) => (
                <div
                  key={day.toISOString()}
                  className={cn(
                    'px-2 py-2 text-xs font-medium text-muted-foreground',
                    isSameDay(day, now) && 'text-primary-ink',
                  )}
                >
                  <span className="uppercase tracking-wide">{format(day, 'EEE')}</span>{' '}
                  <span className="tabular-nums text-foreground">{format(day, 'd MMM')}</span>
                </div>
              ))}
            </div>
            <div
              className="grid"
              style={{ gridTemplateColumns: `3.5rem repeat(${dayList.length}, minmax(0, 1fr))` }}
            >
              <div className="relative" style={{ height: gridHeight }}>
                {hours.map((h, i) => (
                  <div
                    key={h}
                    className="absolute right-2 -translate-y-1/2 text-[11px] tabular-nums text-muted-foreground"
                    style={{ top: i * hourHeight }}
                  >
                    {i === 0 ? '' : `${String(h).padStart(2, '0')}:00`}
                  </div>
                ))}
              </div>
              {byDay.map(({ day, placed, overflow }) => (
                <section
                  key={day.toISOString()}
                  aria-label={format(day, 'EEEE d MMMM')}
                  className={cn(
                    'relative border-l border-border',
                    isSameDay(day, now) && 'bg-primary/5',
                  )}
                  style={{ height: gridHeight }}
                >
                  {hours.map((h, i) => (
                    <div
                      key={h}
                      aria-hidden
                      className="absolute inset-x-0 border-t border-border/60"
                      style={{ top: i * hourHeight }}
                    />
                  ))}
                  {isSameDay(day, now) &&
                    now.getHours() >= startHour &&
                    now.getHours() < endHour && (
                      <div
                        aria-hidden
                        className="absolute inset-x-0 h-0.5 bg-destructive"
                        style={{ top: topFor(now) }}
                      >
                        <span className="absolute -left-1 -top-1 h-2.5 w-2.5 rounded-full bg-destructive" />
                      </div>
                    )}
                  {placed.map((p) => (
                    <div
                      key={p.event.id}
                      className="absolute z-10 p-0.5"
                      style={{
                        top: topFor(p.start),
                        height: heightFor(p.start, p.end),
                        left: `${(p.col / p.cols) * 100}%`,
                        width: `${100 / p.cols}%`,
                      }}
                    >
                      {/* opaque backing: the tinted chip sits over the hour lines and the now line */}
                      <div className="h-full w-full rounded-md bg-card">
                        {chip(
                          p,
                          p.cols > 1 || heightFor(p.start, p.end) < 44,
                          heightFor(p.start, p.end) < 40,
                        )}
                      </div>
                    </div>
                  ))}
                  {overflow.map((o) => (
                    <div
                      key={`more-${o.start.toISOString()}`}
                      className="absolute z-10 p-0.5"
                      style={{
                        top: topFor(o.start),
                        height: Math.max(heightFor(o.start, o.end), MIN_CHIP_PX),
                        left: `${(o.col / o.cols) * 100}%`,
                        width: `${100 / o.cols}%`,
                      }}
                    >
                      <Popover>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            className="flex h-full w-full items-start rounded-md border border-dashed border-border bg-muted px-1.5 py-1 text-left text-xs font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            aria-label={`${o.events.length} more at ${formatTime(o.start)}`}
                          >
                            +{o.events.length} more
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-64 p-2" align="start">
                          <ul className="space-y-1">
                            {o.events.map((ev) => {
                              const s = toDate(ev.start);
                              const e = toDate(ev.end);
                              return (
                                <li key={ev.id} className="h-12">
                                  {chip({ event: ev, start: s, end: e }, false)}
                                </li>
                              );
                            })}
                          </ul>
                        </PopoverContent>
                      </Popover>
                    </div>
                  ))}
                </section>
              ))}
            </div>
          </div>
        </div>
        {overflows && (
          <div
            aria-hidden
            data-testid="week-schedule-fade"
            className="pointer-events-none absolute inset-y-0 right-0 w-6 rounded-r-lg bg-gradient-to-l from-card to-transparent"
          />
        )}
      </div>

      {/* Agenda, below md: one list per day, nothing squeezed. */}
      <div className="space-y-4 md:hidden">
        {byDay.map(({ day, events: mine }) => {
          const sorted = [...mine].sort(
            (a, b) => toDate(a.start).getTime() - toDate(b.start).getTime(),
          );
          return (
            <section key={day.toISOString()} aria-label={format(day, 'EEEE d MMMM')}>
              <h3
                className={cn(
                  'mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground',
                  isSameDay(day, now) && 'text-primary-ink',
                )}
              >
                {format(day, 'EEE d MMM')}
              </h3>
              {sorted.length === 0 ? (
                <p className="text-sm text-muted-foreground">{emptyDayLabel}</p>
              ) : (
                <ul className="space-y-1.5">
                  {sorted.map((ev) => (
                    <li key={ev.id} className="h-12">
                      {chip({ event: ev, start: toDate(ev.start), end: toDate(ev.end) }, false)}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
