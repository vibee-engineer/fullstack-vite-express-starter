import { TZDate } from '@date-fns/tz';

export interface SlotOptions {
  /** The business's calendar day, `YYYY-MM-DD`. */
  date: string;
  /** IANA zone of the business, e.g. 'Europe/London'. NOT the server's zone. */
  timeZone: string;
  /** Opening time, `HH:mm` local to `timeZone`. */
  open: string;
  /** Closing time, `HH:mm`; the last slot ENDS at or before it. */
  close: string;
  /** Appointment length in minutes. */
  durationMin: number;
  /** Start-to-start spacing; defaults to `durationMin`. */
  stepMin?: number;
  /** Local `HH:mm-HH:mm` ranges with no bookings (lunch). */
  breaks?: string[];
}

export interface Slot {
  /** UTC ISO instants — what you store and compare. */
  start: string;
  end: string;
  /** `HH:mm` in the business zone — what you show. */
  label: string;
}

const toMin = (hhmm: string) => {
  const [h = NaN, m = NaN] = hhmm.split(':').map(Number);
  if (!Number.isInteger(h) || !Number.isInteger(m)) throw new Error(`Bad time "${hhmm}"`);
  return h * 60 + m;
};
const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Every bookable slot on `date`, built from WALL-CLOCK minutes in `timeZone`
 * (never by adding minutes to a Date), so DST cannot shift them:
 * a slot whose local time does not exist that day (spring-forward gap) is
 * dropped, and a repeated fall-back hour is not offered twice.
 */
export function generateSlots(opts: SlotOptions): Slot[] {
  const [y = NaN, mo = NaN, d = NaN] = opts.date.split('-').map(Number);
  const step = opts.stepMin ?? opts.durationMin;
  if (!(opts.durationMin > 0) || !(step > 0))
    throw new Error('durationMin and stepMin must be > 0');
  const open = toMin(opts.open);
  const close = toMin(opts.close);
  const breaks = (opts.breaks ?? []).map((b) => b.split('-').map(toMin) as [number, number]);
  const slots: Slot[] = [];
  const seen = new Set<string>();
  for (let m = open; m + opts.durationMin <= close; m += step) {
    if (breaks.some(([bs, be]) => m < be && m + opts.durationMin > bs)) continue;
    const start = new TZDate(y, mo - 1, d, Math.floor(m / 60), m % 60, opts.timeZone);
    // Gap check: the zone moved the clock (02:30 on spring-forward day -> 03:30).
    if (start.getHours() * 60 + start.getMinutes() !== m) continue;
    const end = new TZDate(start.getTime() + opts.durationMin * 60_000, opts.timeZone);
    const iso = new Date(start.getTime()).toISOString();
    if (seen.has(iso)) continue;
    seen.add(iso);
    slots.push({
      start: iso,
      end: new Date(end.getTime()).toISOString(),
      label: `${pad(Math.floor(m / 60))}:${pad(m % 60)}`,
    });
  }
  return slots;
}
