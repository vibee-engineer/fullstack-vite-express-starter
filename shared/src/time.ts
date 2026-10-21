/**
 * time.ts — the business's clock, the same in the browser and on the server.
 *
 * A yoga class "at 6:30" means 6:30 where the studio is. Built with
 * `date.setHours(6, 30)` it means 6:30 on whatever clock runs the code: the
 * viewer's in the browser, UTC on the server. A demo world written for the
 * browser and then seeded from the server (phase 2) moved every class by the
 * viewer's offset — 6:30 AM became 12:00 PM for a viewer in India.
 *
 * So times a business keeps (classes, appointments, shifts, opening hours) are
 * built with `atTime` and shown with `formatTime` / `formatDay`, which all read
 * TIME_ZONE. Instants that are just "when it happened" (createdAt, 3 hours ago)
 * need none of this: store and compare them as ISO strings.
 */
import { TZDate } from '@date-fns/tz';
import { format } from 'date-fns';

/**
 * The business's IANA zone. Set it to where the brief puts the business
 * ("a studio in Austin" → 'America/Chicago'); otherwise where the demo world is
 * set. Every helper below defaults to it.
 */
export const TIME_ZONE = 'America/New_York';

/** A Date, an ISO instant, epoch ms, or a `YYYY-MM-DD` business-day key. */
type DateLike = Date | string | number;

const DAY_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * `d` as a date in the business zone, for calendar math and getters: date-fns
 * (`startOfWeek`, `addDays`, `isSameDay`, `format`) and `getHours` / `getDay`
 * then work on the business's calendar, wherever the code runs. Store and
 * compare `atTime(...)` results, not these.
 */
export function zoned(d: DateLike = new Date(), timeZone: string = TIME_ZONE): TZDate {
  if (typeof d === 'string') {
    const k = DAY_KEY.exec(d);
    // `new Date('2026-10-23')` is UTC midnight: the day before, west of London.
    if (k) return new TZDate(Number(k[1]), Number(k[2]) - 1, Number(k[3]), timeZone);
    return new TZDate(new Date(d).getTime(), timeZone);
  }
  return new TZDate(typeof d === 'number' ? d : d.getTime(), timeZone);
}

/**
 * The instant `hhmm` ('06:30', '18:45') happens on the business-zone day of
 * `day`. Use it for every scheduled time instead of `setHours`. Returns a plain
 * Date, so `.toISOString()` is the usual `...Z` string to store and compare.
 */
export function atTime(day: DateLike, hhmm: string, timeZone: string = TIME_ZONE): Date {
  const t = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!t) throw new Error(`atTime: bad time "${hhmm}"`);
  const h = Number(t[1]);
  const m = Number(t[2]);
  const z = zoned(day, timeZone);
  return new Date(new TZDate(z.getFullYear(), z.getMonth(), z.getDate(), h, m, timeZone).getTime());
}

/** The instant the business-zone day of `day` starts. */
export function startOfZonedDay(day: DateLike = new Date(), timeZone: string = TIME_ZONE): Date {
  return atTime(day, '00:00', timeZone);
}

/** `YYYY-MM-DD` of the business-zone day — the key for "today" and day buckets. */
export function dayKey(d: DateLike, timeZone: string = TIME_ZONE): string {
  return format(zoned(d, timeZone), 'yyyy-MM-dd');
}

/** The time on the business's clock, e.g. "6:30 AM". */
export function formatTime(d: DateLike, pattern = 'h:mm a', timeZone: string = TIME_ZONE): string {
  return format(zoned(d, timeZone), pattern);
}

/** The business-zone date, e.g. "Thu, Oct 23". Any date-fns pattern. */
export function formatDay(
  d: DateLike,
  pattern = 'EEE, MMM d',
  timeZone: string = TIME_ZONE,
): string {
  return format(zoned(d, timeZone), pattern);
}
