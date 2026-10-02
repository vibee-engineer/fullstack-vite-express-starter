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
