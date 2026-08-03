import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

/**
 * PageHeader — the title row every app page opens with.
 *
 * Exists because generated dashboards keep shipping as dead ends: a measured
 * build (habit tracker, 2026-08-03) rendered a page titled "Dashboard" with an
 * empty state reading "Create your first habit" and ZERO buttons or links
 * anywhere in <main>. The create form was on another route.
 *
 * Top-tier dashboards (Linear, Stripe, Vercel) put the page's primary action
 * right-aligned with the title, on the same baseline. That is what `action` is
 * for. It is optional here — a genuinely read-only view exists — but a page with
 * neither an action nor any other control in <main> is flagged by
 * fullstackLint's dead_end_page rule.
 *
 * `title` renders the page's single <h1>. Do not add another one below it.
 */
export function PageHeader({
  title,
  description,
  action,
  className,
}: {
  title: string;
  /** One line of context. Skip it rather than padding with filler. */
  description?: string;
  /** Primary action for this page. Right-aligned, same baseline as the title. */
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('mb-6 flex items-start justify-between gap-4', className)}>
      <div className="min-w-0">
        <h1 className="truncate text-2xl font-semibold tracking-tight">{title}</h1>
        {description ? (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
    </div>
  );
}
