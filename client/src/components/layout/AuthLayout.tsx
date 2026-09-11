import type { ReactNode } from 'react';

import { SITE } from '@/config/site';
import { Brand } from './Brand';

/**
 * AuthLayout — a centered card for PUBLIC routes (sign in, sign up, reset).
 * Use it for every UNAUTHENTICATED route. Rendering a sign-in form inside
 * AppShell would give the user a sidebar full of links that 401.
 *
 * Props:
 *   title     heading above the card body (e.g. "Sign in")
 *   subtitle  supporting line under the title
 *   footer    below the card (e.g. "Don't have an account? Sign up")
 */
export function AuthLayout({
  children,
  title,
  subtitle,
  footer,
}: {
  children: ReactNode;
  title?: ReactNode;
  subtitle?: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/30 px-4 py-12 text-foreground">
      <div className="mb-8">
        <Brand className="text-lg" />
      </div>
      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-6 shadow-sm">
        {title ? (
          <div className="mb-6 space-y-1 text-center">
            <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
            {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
          </div>
        ) : null}
        {children}
      </div>
      {footer ? (
        <div className="mt-6 text-center text-sm text-muted-foreground">{footer}</div>
      ) : null}
      <p className="mt-8 text-xs text-muted-foreground/70">{SITE.tagline}</p>
    </div>
  );
}
