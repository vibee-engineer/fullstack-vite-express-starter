import { useState, type ReactNode } from 'react';

import { AppSidebar } from './AppSidebar';
import { Topbar } from './Topbar';

/**
 * AppShell — layout for every AUTHENTICATED route.
 *
 * Shape: persistent sidebar rail + 48px topbar + scrolling content region.
 * This is an application shell, not a page shell. It deliberately does NOT
 * render a marketing footer, a hero, or a centered marketing nav — those belong
 * to public pages, and shipping them around a dashboard is the clearest single
 * tell that an app was built by someone who has not shipped one.
 *
 * Public routes (sign in / sign up) use AuthLayout instead.
 *
 * Sourced measurements (shadcn/ui defaults + the shadcn dashboard-01 block):
 *   sidebar  256px expanded / 48px collapsed / 288px mobile sheet
 *   topbar   48px
 *   gutters  16px, 24px at lg
 *   rhythm   24px (gap-6). Dashboards top out here; the 64-128px section
 *            padding that suits marketing reads as empty in an app.
 *
 * Content is intentionally fluid rather than max-width clamped: the shadcn
 * dashboard block is full-bleed inside the sidebar inset, and no design system
 * publishes an authoritative app content max-width. If one page reads too wide
 * (a settings form, a single record), clamp THAT page — not the shell.
 */
export function AppShell({
  children,
  title,
  headerActions,
  account,
}: {
  children: ReactNode;
  /** Current page name — shown in the topbar on mobile where the rail is hidden. */
  title?: ReactNode;
  /** Rare: a page action that must live in global chrome. Prefer on-page. */
  headerActions?: ReactNode;
  /** Account menu / avatar, once auth exists. */
  account?: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      {/* Rail is hidden below md; Topbar's Sheet takes over there. */}
      <AppSidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed((v) => !v)}
        className="hidden md:flex"
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar title={title} actions={headerActions} account={account} />
        {/* The scroll container lives here, not on <body>, so the rail and
            topbar stay put while content scrolls — what every real app does. */}
        <main className="flex-1 overflow-y-auto px-4 py-6 lg:px-6">{children}</main>
      </div>
    </div>
  );
}
