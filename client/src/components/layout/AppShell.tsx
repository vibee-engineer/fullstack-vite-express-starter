import type { ReactNode } from 'react';

import { CONTENT_WIDTH, LAYOUT, type ContentWidth, type LayoutArchetype } from '@/config/site';
import { cn } from '@/lib/utils';
import { AppSidebar } from './AppSidebar';
import { Topbar } from './Topbar';
import { TopbarNav } from './TopbarNav';
import type { Account } from './account';

export type { Account } from './account';

/**
 * AppShell — the chrome around every AUTHENTICATED page. It composes ONE of
 * four shells based on LAYOUT in @/config/site:
 *
 *   'sidebar'  left rail + slim topbar + scrolling main
 *   'topbar'   horizontal nav, no rail, content clamped
 *   'focused'  slim topbar, no destination list, one centered column
 *   'canvas'   topbar + full-bleed main that does NOT scroll (the board / map /
 *              editor inside owns scrolling)
 *
 * Set LAYOUT once for the app. The per-render `layout` prop exists to override
 * it, but changing chrome between routes of one app is disorienting and usually
 * wrong. None of the four has a footer and none ever should. Never
 * re-implement layout at the page level — edit @/config/site instead.
 *
 * Props:
 *   title         current page title, shown in the topbar
 *   headerActions cross-cutting actions (search, "New", filters) in the topbar
 *   account       the signed-in user, for the account affordance (null = none)
 *   layout        override LAYOUT for this render (rare)
 *   width         override CONTENT_WIDTH for this render (rare)
 */
export function AppShell({
  children,
  title,
  headerActions,
  account = null,
  layout,
  width,
}: {
  children: ReactNode;
  title?: ReactNode;
  headerActions?: ReactNode;
  account?: Account;
  layout?: LayoutArchetype;
  width?: ContentWidth;
}) {
  const archetype = layout ?? LAYOUT;
  const contentWidth = width ?? CONTENT_WIDTH;

  // The inner content wrapper. 'clamped' gets a readable max-width; 'fluid'
  // fills. (Ignored by focused/canvas, which own their own width.)
  const contentClass =
    contentWidth === 'clamped' ? 'mx-auto w-full max-w-5xl px-4 py-6 md:px-6' : 'w-full px-4 py-6 md:px-6';

  if (archetype === 'focused') {
    return (
      <div className="flex min-h-screen flex-col bg-background text-foreground">
        <Topbar title={title} actions={headerActions} account={account} />
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-3xl px-4 py-10 md:px-6">{children}</div>
        </main>
      </div>
    );
  }

  if (archetype === 'canvas') {
    return (
      <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
        <Topbar title={title} actions={headerActions} account={account} />
        {/* Full-bleed, non-scrolling: the canvas inside owns scroll/pan. */}
        <main className="min-h-0 flex-1 overflow-hidden">{children}</main>
      </div>
    );
  }

  if (archetype === 'topbar') {
    return (
      <div className="flex min-h-screen flex-col bg-background text-foreground">
        <TopbarNav actions={headerActions} account={account} />
        <main className="flex-1 overflow-y-auto">
          <div className={cn('mx-auto w-full max-w-7xl px-4 py-6 md:px-6', contentWidth === 'clamped' && 'max-w-3xl')}>
            {title ? (
              <h1 className="mb-4 text-2xl font-semibold tracking-tight">{title}</h1>
            ) : null}
            {children}
          </div>
        </main>
      </div>
    );
  }

  // Default: 'sidebar'
  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <AppSidebar account={account} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar title={title} actions={headerActions} account={account} />
        <main className="min-h-0 flex-1 overflow-y-auto">
          <div className={contentClass}>{children}</div>
        </main>
      </div>
    </div>
  );
}
