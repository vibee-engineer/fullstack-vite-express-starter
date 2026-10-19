import { useEffect, useRef, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';

import { CONTENT_WIDTH, LAYOUT, type ContentWidth, type LayoutArchetype } from '@/config/site';
import { cn } from '@/lib/utils';
import { AppSidebar } from './AppSidebar';
import { BottomDock } from './BottomDock';
import { ImmersiveHud } from './ImmersiveHud';
import { Topbar } from './Topbar';
import { TopbarNav } from './TopbarNav';
import type { Account } from './account';

export type { Account } from './account';

/**
 * AppShell — the chrome around every AUTHENTICATED page. It composes ONE of
 * seven shells based on LAYOUT in @/config/site:
 *
 *   'sidebar'  left rail + slim topbar + scrolling main
 *   'topbar'   horizontal nav, no rail, content clamped
 *   'focused'  slim topbar, no destination list, one centered column
 *   'canvas'   topbar + full-bleed main that does NOT scroll (the board / map /
 *              editor inside owns scrolling)
 *   'immersive' no bar at all; full-viewport scene with a floating HUD strip
 *              (games, players, creative tools)
 *   'storefront' top nav with search + cart actions, wide content, no title
 *              row (shops, catalogues, marketplaces)
 *   'dock'     slim top bar + one column + a bottom dock of 3-5 destinations
 *              (phone-first: trackers, journals, personal money, fitness)
 *
 * Set LAYOUT once for the app. The per-render `layout` prop exists to override
 * it, but changing chrome between routes of one app is disorienting and usually
 * wrong. None of the seven has a footer and none ever should. Never
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
  // The sidebar/canvas shells scroll <main>, not the window, so the router's
  // window scroll handling never touches it: without this a new route opens
  // at the previous page's scroll offset.
  const { pathname } = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (mainRef.current) mainRef.current.scrollTop = 0;
  }, [pathname]);
  const contentWidth = width ?? CONTENT_WIDTH;

  // The inner content wrapper. 'clamped' gets a readable max-width; 'fluid'
  // fills. (Ignored by focused/canvas, which own their own width.)
  const contentClass =
    contentWidth === 'clamped'
      ? 'mx-auto w-full max-w-5xl px-4 py-6 md:px-6'
      : 'w-full px-4 py-6 md:px-6';

  if (archetype === 'focused') {
    return (
      <div className="flex min-h-screen flex-col bg-background text-foreground">
        <Topbar title={title} actions={headerActions} account={account} showBrand />
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-3xl px-4 py-10 md:px-6">{children}</div>
        </main>
      </div>
    );
  }

  if (archetype === 'canvas') {
    return (
      <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
        <Topbar title={title} actions={headerActions} account={account} showBrand showNav />
        {/* Full-bleed, non-scrolling: the canvas inside owns scroll/pan. */}
        <main className="min-h-0 flex-1 overflow-hidden">{children}</main>
      </div>
    );
  }

  if (archetype === 'immersive') {
    // Games, players, creative scenes: the scene IS the app. Full viewport, no
    // bar; a transparent HUD strip floats over it.
    return (
      <div className="relative h-dvh w-full overflow-hidden bg-background text-foreground">
        <ImmersiveHud actions={headerActions} account={account} />
        <main className="h-full w-full">{children}</main>
      </div>
    );
  }

  if (archetype === 'dock') {
    // Phone-first: destinations in a thumb-reach dock, one readable column,
    // bottom padding so the last row never hides under the dock.
    return (
      <div className="flex min-h-screen flex-col bg-background text-foreground">
        <Topbar title={title} actions={headerActions} account={account} showBrand />
        <main className="flex-1 pb-24">
          <div className="mx-auto w-full max-w-2xl px-4 py-6 md:px-6">{children}</div>
        </main>
        <BottomDock />
      </div>
    );
  }

  if (archetype === 'storefront') {
    // Shops, catalogues, marketplaces: top nav with search + cart in actions,
    // wide content, and NO page-title row — storefront pages open on their own
    // hero or product grid, not a heading over a card.
    return (
      <div className="flex min-h-screen flex-col bg-background text-foreground">
        <TopbarNav actions={headerActions} account={account} />
        <main className="flex-1">
          <div className="mx-auto w-full max-w-7xl px-4 md:px-6">{children}</div>
        </main>
      </div>
    );
  }

  if (archetype === 'topbar') {
    return (
      <div className="flex min-h-screen flex-col bg-background text-foreground">
        <TopbarNav actions={headerActions} account={account} />
        <main className="flex-1 overflow-y-auto">
          <div
            className={cn(
              'mx-auto w-full max-w-7xl px-4 py-6 md:px-6',
              contentWidth === 'clamped' && 'max-w-3xl',
            )}
          >
            {title ? <h1 className="mb-4 text-2xl font-semibold tracking-tight">{title}</h1> : null}
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
        <main ref={mainRef} className="min-h-0 flex-1 overflow-y-auto">
          <div className={contentClass}>{children}</div>
        </main>
      </div>
    </div>
  );
}
