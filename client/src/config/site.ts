/**
 * site.ts — brand + navigation + layout configuration for the APP shell.
 *
 * THE AGENT EDITS THIS FILE FIRST. AppShell reads LAYOUT / CONTENT_WIDTH and
 * the nav shells read NAV_SECTIONS from here — you change the app's chrome by
 * editing the config below, not by re-implementing layout in a page.
 *
 * This is an authenticated application, not a marketing site: there is no
 * FOOTER_GROUPS and no NAV_CTA. If the product needs a public marketing page,
 * build it as its own route with its own layout.
 *
 * NOTE: founding.dev's scaffolder OVERWRITES this file on project creation with
 * the same export surface (SITE / NAV_SECTIONS / LAYOUT / CONTENT_WIDTH). The
 * two are ONE contract — if you change the shape here, change the seeder
 * (server/lib/fullstackScaffoldService.js initialSiteConfig) in the same commit.
 */

export const SITE = {
  /** Brand wordmark in the sidebar / topbar. Keep it short — it sits in 256px. */
  name: 'App',
  /** One-sentence positioning for THIS app. Meta description + auth subtitle.
   *  Keep it about the product — never platform branding. */
  tagline: 'Everything you need, in one place.',
  /** Canonical URL, used for OG tags. Overwritten at deploy. */
  url: 'http://localhost:8888',
  /** OG image path — relative to public/. */
  ogImage: '/og.png',
  /** Meta author. Platform attribution lives ONLY in favicon + meta, never UI. */
  author: 'founding.dev',
};

/* ------------------------------------------------------------------ *
 * Layout archetype — pick from the app's core object, not by habit
 * ------------------------------------------------------------------ */

/**
 * The four app shells AppShell composes. Layout follows from information
 * architecture, not house style. A 256px rail holding two links, beside content
 * that has nowhere to go, is the clearest tell of a generated app.
 *
 *   'sidebar'  Persistent rail + slim topbar + scrolling main. Many
 *              destinations, or nav that needs labelled groups. Slack, Linear.
 *   'topbar'   Horizontal nav, no rail, content clamped. A handful of
 *              destinations, where a rail is mostly empty space. Stripe, Vercel.
 *   'focused'  Slim bar, no destination list, one centered column. One view, a
 *              wizard, or a flow where nav is a distraction. Typeform, iA Writer.
 *   'canvas'   Topbar + full-bleed main that does NOT scroll — the board, map or
 *              editor inside owns the viewport. Figma, Miro, Trello, Calendar.
 *
 * For a list-beside-record view (inbox, CRM, tracker, pipeline) use the
 * <ListDetail> component INSIDE whichever archetype you picked — it is not a
 * fifth shell and composes with all of them.
 */
export type LayoutArchetype = 'sidebar' | 'topbar' | 'focused' | 'canvas';

/** THIS APP's shell. Set it deliberately on turn 0, from the brief. */
export const LAYOUT: LayoutArchetype = 'sidebar';

/**
 * Content width — INDEPENDENT of where navigation sits. Conflating them is a
 * real bug: a topbar app of wide data tables must NOT be clamped, and a settings
 * form in a sidebar app should not run to 1600px.
 *
 *   'fluid'    Full available width — data tables, boards, dashboards.
 *   'clamped'  Centered, readable measure — forms, records, prose, settings.
 *
 * Override a single route with the `width` prop on AppShell. (Ignored by
 * 'canvas', which is always full-bleed, and 'focused', a single centered column.)
 */
export type ContentWidth = 'fluid' | 'clamped';

export const CONTENT_WIDTH: ContentWidth = 'fluid';

/* ------------------------------------------------------------------ *
 * Navigation
 * ------------------------------------------------------------------ */

/**
 * A lucide icon name. Resolves through the ICONS map in
 * components/layout/nav-icons.tsx; unknown names fall back to a neutral dot, so
 * any lucide name is safe. Common keys: 'home', 'inbox', 'users', 'calendar',
 * 'kanban', 'chart', 'settings', 'briefcase', 'file', 'package', 'activity'.
 */
export type NavIcon = string;

export type NavItem = {
  to: string;
  label: string;
  /** lucide icon name (see NavIcon). */
  icon?: NavIcon;
  /** exact-match the active route. Auto-true for '/' when omitted. */
  end?: boolean;
  /** trailing count pill, e.g. unread / overdue. */
  badge?: string | number;
  /** open in a new tab. */
  external?: boolean;
};

/** A labelled group of destinations. `heading` renders as a sidebar section
 *  label and is ignored by the topbar (which flattens all sections). Group only
 *  once there are ~6+ links. */
export type NavSection = { heading?: string; items: NavItem[] };

/**
 * The app's global navigation — every signed-in destination, once. ALL shells
 * (sidebar, topbar, mobile sheet) read this ONE array, so a destination can
 * never exist in one and be missing from another, and switching LAYOUT never
 * drops a route. An unreachable route is a bug; a route with no nav entry is
 * invisible.
 */
export const NAV_SECTIONS: NavSection[] = [
  {
    items: [
      { to: '/', label: 'Home', icon: 'home', end: true },
      // Reference CRUD vertical (client/src/pages/TasksPage.tsx). Replace with
      // the real resources; delete the route in App.tsx once they land.
      { to: '/tasks', label: 'Tasks', icon: 'check-square' },
    ],
  },
];
