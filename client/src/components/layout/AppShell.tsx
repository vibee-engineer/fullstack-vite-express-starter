import type { ReactNode } from 'react';

import { SiteHeader } from './SiteHeader';
import { SiteFooter } from './SiteFooter';

/**
 * AppShell — layout wrapper mounted by App.tsx's layout route.
 * Every page inside the router renders inside this shell.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
