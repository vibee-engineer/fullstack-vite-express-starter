import type { ReactNode } from 'react';

import { SITE } from '@/config/site';

/**
 * AuthLayout — layout for PUBLIC routes (sign in, sign up, forgot password).
 *
 * A centered card on a plain surface. No sidebar (there is nothing to navigate
 * to yet), no marketing footer, no nav links. The only chrome is the wordmark,
 * so the form is unambiguously the single thing to do on the page.
 *
 * Use this for every unauthenticated route. Rendering the sign-in form inside
 * AppShell instead produces a sidebar full of links that 401 — a bug users hit
 * immediately.
 */
export function AuthLayout({
  children,
  title,
  description,
}: {
  children: ReactNode;
  /** Short heading, e.g. "Welcome back". */
  title: string;
  /** One line under the heading explaining what happens next. */
  description?: string;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12 text-foreground">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-2">
          <div
            aria-hidden
            className="grid size-7 place-items-center rounded bg-primary text-xs font-semibold text-primary-foreground"
          >
            {SITE.name.slice(0, 1).toUpperCase()}
          </div>
          <span className="text-sm font-semibold tracking-tight">{SITE.name}</span>
        </div>

        <div className="rounded-lg border border-border bg-card p-6 text-card-foreground shadow-sm">
          <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
          {description && (
            <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>
          )}
          <div className="mt-6">{children}</div>
        </div>
      </div>
    </div>
  );
}
