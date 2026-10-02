import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Tailwind-safe className concatenator. Used by every shadcn primitive. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** Format an ISO timestamp, or a date-only `YYYY-MM-DD` key, as a human-readable date.
 *  A date-only string is parsed as LOCAL midnight — `new Date('2026-10-02')` is UTC
 *  midnight and renders as Oct 1 everywhere west of Greenwich. */
export function formatDate(iso: string, locale = 'en-US'): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  const date = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(iso);
  return date.toLocaleDateString(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/**
 * `YYYY-MM-DD` for the user's LOCAL calendar day: the value an
 * `<input type="date">` expects and the key for "today", due dates and day
 * buckets. Never `date.toISOString().slice(0, 10)`: that is the UTC day, so in
 * the Americas every evening "today" is tomorrow (east of UTC, early morning is
 * yesterday).
 */
export function toDateInputValue(date: Date = new Date()): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/**
 * `YYYY-MM-DDTHH:mm` in LOCAL time, for `<input type="datetime-local">`.
 * `toISOString().slice(0, 16)` shows UTC wall-clock time in a local picker.
 */
export function toDateTimeInputValue(date: Date): string {
  return `${toDateInputValue(date)}T${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

/** Local-midnight Date for a `YYYY-MM-DD` key (`new Date(key)` parses it as UTC). */
export function parseDateInputValue(key: string): Date {
  const [y = NaN, m = NaN, d = NaN] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}
