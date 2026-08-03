import { useState, type ReactNode } from 'react';

import { AppSidebar } from './AppSidebar';
import { Topbar } from './Topbar';
import { TopbarNav } from './TopbarNav';
import { LAYOUT, type LayoutArchetype } from '@/config/site';
import { cn } from '@/lib/utils';

/**
 * AppShell — the chrome around every AUTHENTICATED route.
 *
 * WHY THIS TAKES A `layout`
 * =========================
 * This shell used to hardcode one shape: a persistent 256px sidebar rail plus a
 * 48px topbar. That was a deliberate fix for generated apps that shipped as
 * `container max-w-3xl py-12` page stacks and read as beginner frontend. It
 * worked, and then it over-corrected: because App.tsx wraps every route in this
 * component and there was no prop to vary it, EVERY generated app wore
 * dashboard chrome. A single-purpose calculator and a 12-section admin console
 * came out looking identical, down to the same `bg-muted/40` rail at the same
 * 256px.
 *
 * Layout is a consequence of information architecture, not a house style. Real
 * products pick by destination count and interaction model: Linear and Stripe
 * carry sidebars because they have many destinations; a focused tool has no nav
 * at all; a board or canvas app gives the canvas the whole viewport and floats
 * its controls. Forcing one of those shapes onto the other two is the actual
 * design error.
 *
 * So the archetype is chosen per app (see LAYOUT in @/config/site) and this
 * component composes the matching chrome. All four are equally finished — none
 * is a downgrade, and picking the fitting one is not "less polished".
 *
 * ARCHETYPES
 * ==========
 *   sidebar  Persistent rail + topbar + scrolling main. Many destinations (5+),
 *            or nav that needs grouping into sections.
 *            Rail 256px expanded / 48px collapsed / 288px mobile sheet.
 *
 *   topbar   Horizontal nav in the topbar, no rail, content clamped and
 *            centered. 2 to 4 destinations, where a rail is mostly empty space.
 *
 *   focused  No nav chrome beyond a slim bar. One view, a wizard, or a flow
 *            where navigation would be a distraction. Narrow centered column.
 *
 *   canvas   Topbar + full-bleed main that does NOT scroll — the board, map or
 *            editor inside owns its own scrolling and gets the whole viewport.
 *
 * SHARED MEASUREMENTS (shadcn/ui defaults + the dashboard-01 block)
 *   topbar 48px · gutters 16px, 24px at lg · rhythm 24px (gap-6)
 * The 64-128px section padding that suits marketing reads as empty in an app.
 */
export function AppShell({
  children,
  title,
  headerActions,
  account,
  layout,
}: {
  children: ReactNode;
  /** Current page name — shown in the topbar on mobile where the rail is hidden. */
  title?: ReactNode;
  /** Rare: a page action that must live in global chrome. Prefer on-page. */
  headerActions?: ReactNode;
  /** Account menu / avatar, once auth exists. */
  account?: ReactNode;
  /**
   * Override the app-wide archetype for one route. Rare and usually wrong —
   * changing chrome between routes of the same app is disorienting. Set LAYOUT
   * in @/config/site instead. Legitimate use: an onboarding wizard inside an
   * otherwise sidebar app.
   */
  layout?: LayoutArchetype;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const archetype: LayoutArchetype = layout ?? LAYOUT;

  // Only the sidebar archetype mounts a rail. The others would render an empty
  // or near-empty 256px column, which is exactly the wasted chrome this exists
  // to avoid.
  const hasRail = archetype === 'sidebar';

  // `canvas` must not scroll: the board/editor inside is the scroll container,
  // and a scrolling wrapper around it produces the classic double-scrollbar.
  const mainScrolls = archetype !== 'canvas';

  const mainClasses = cn(
    'flex-1',
    mainScrolls ? 'overflow-y-auto' : 'overflow-hidden',
    // Canvas gets the full viewport with no padding — the surface bleeds to the
    // edges and floats its own controls.
    archetype === 'canvas' ? 'p-0' : 'px-4 py-6 lg:px-6',
  );

  // Content width. The sidebar inset is already narrow, so it stays fluid (the
  // shadcn dashboard block is full-bleed inside the inset). Without a rail,
  // full-bleed text runs to unreadable line lengths on a wide monitor, so those
  // archetypes clamp: 1280px for a topbar app, 768px for a focused one.
  const contentClasses = cn(
    archetype === 'topbar' && 'mx-auto w-full max-w-7xl',
    archetype === 'focused' && 'mx-auto w-full max-w-3xl',
  );

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      {hasRail ? (
        // Rail is hidden below md; Topbar's Sheet takes over there.
        <AppSidebar
          collapsed={collapsed}
          onToggle={() => setCollapsed((v) => !v)}
          className="hidden md:flex"
        />
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          title={title}
          actions={headerActions}
          account={account}
          // Without a rail the topbar carries the navigation, so the mobile
          // Sheet trigger must stay available at every width rather than only
          // below md. `focused` has no destinations worth listing.
          showMenuAtAllWidths={!hasRail && archetype !== 'focused'}
          nav={archetype === 'topbar' ? <TopbarNav /> : null}
        />
        {/* The scroll container lives here, not on <body>, so chrome stays put
            while content scrolls — what every real app does. */}
        <main className={mainClasses}>
          {contentClasses ? <div className={contentClasses}>{children}</div> : children}
        </main>
      </div>
    </div>
  );
}
