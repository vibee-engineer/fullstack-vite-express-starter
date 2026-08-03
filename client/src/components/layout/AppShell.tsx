import { useState, type ReactNode } from 'react';

import { AppSidebar } from './AppSidebar';
import { Topbar } from './Topbar';
import { TopbarNav } from './TopbarNav';
import { LAYOUT, CONTENT_WIDTH, type LayoutArchetype, type ContentWidth } from '@/config/site';
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
 * Layout is a consequence of information architecture, not a house style, and
 * the published thresholds agree on roughly where the lines fall:
 *
 *   Material 3    navigation drawer at 5+ destinations or more than one level of
 *                 hierarchy; navigation rail carries 3-7; "don't use a
 *                 navigation bar for fewer than three destinations — use tabs".
 *   WinUI         top navigation at 5 or fewer top-level categories; left
 *                 navigation at 5-10.
 *   Apple HIG     "prefer a tab bar"; convert to a sidebar when the app is more
 *                 complex; no more than two levels of hierarchy in a sidebar.
 *   IBM Carbon    the left panel is optional and earns its place above ~5
 *                 secondary items; the header "can be used on its own".
 *   NN/g          top nav suits most products; vertical nav wins for broad or
 *                 growing IAs, at a worse content-to-chrome ratio.
 *
 * Note the disagreement rather than pretending it away: Shopify Polaris makes a
 * sidebar effectively mandatory (its frame requires the navigation component),
 * Carbon calls it optional, and WinUI recommends against one at five or fewer
 * destinations. Material also DEPRECATED the navigation drawer in May 2025 in
 * favour of an expanded rail, so "sidebar" here means rail-expanded-or-collapsed
 * rather than a drawer.
 *
 * So the archetype is chosen per app (see LAYOUT in @/config/site) and this
 * component composes the matching chrome. All four are equally finished — none
 * is a downgrade, and picking the fitting one is not "less polished".
 *
 * Two things this deliberately does NOT do:
 *   - It does not decide content width. That is an independent axis
 *     (CONTENT_WIDTH / the `width` prop): a topbar app of wide data tables wants
 *     full width, a settings form inside a sidebar app wants a readable measure.
 *   - It does not model list-detail. That shape is not mutually exclusive with
 *     any of these (an app can have a rail AND a list-detail page, as Figma has
 *     both a rail and a canvas), so it composes INSIDE an archetype — see
 *     ListDetail.
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
 *            Put the surface's own controls in DOCKED, resizable rails, not
 *            floating panels: Figma shipped floating panels in UI3, measured
 *            them, found they "slowed people down" and cramped the canvas on
 *            smaller screens, and reverted to docked rails with floating left
 *            as an opt-in "Minimize UI" mode.
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
  width,
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
  /**
   * Content width for this route, overriding CONTENT_WIDTH. Nav placement and
   * content width are independent axes — a topbar app of wide data tables wants
   * 'fluid', a settings form inside a sidebar app wants 'clamped'.
   */
  width?: ContentWidth;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const archetype: LayoutArchetype = layout ?? LAYOUT;
  // `focused` is defined by its narrow measure, so it always clamps; otherwise
  // the app-wide policy applies unless this route overrides it.
  const widthPolicy: ContentWidth =
    archetype === 'focused' ? 'clamped' : (width ?? CONTENT_WIDTH);

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

  // Content width comes from the POLICY, not from where nav sits.
  //
  // 'focused' clamps narrow (max-w-3xl, ~768px) because a readable measure is
  // the entire point of that archetype. Anything else that clamps gets
  // max-w-7xl (1280px), a middle ground between Polaris capping a page at 998px
  // and Carbon capping its grid at 1584px — neither is authoritative, and
  // Atlassian caps main at nothing at all. 'canvas' never clamps: the surface
  // owns the viewport.
  const contentClasses = cn(
    widthPolicy === 'clamped'
      && archetype !== 'canvas'
      && (archetype === 'focused' ? 'mx-auto w-full max-w-3xl' : 'mx-auto w-full max-w-7xl'),
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
