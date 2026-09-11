/**
 * site.ts — brand + navigation + layout configuration.
 *
 * THE AGENT EDITS THIS FILE FIRST. AppShell reads LAYOUT / NAV_SECTIONS /
 * CONTENT_WIDTH from here and composes the matching shell. The layout
 * components (AppShell, AppSidebar, Topbar, TopbarNav, AuthLayout, ListDetail)
 * are generic and stay unedited — you change the app's chrome by editing the
 * config below, not by re-implementing layout in a page.
 *
 * The reason this file exists: every generated app that hand-rolls its own
 * shell converges on the same left-sidebar-plus-stat-cards look. Picking a
 * LAYOUT that fits the app's core object (see the decision note on
 * NAV_SECTIONS) is the single biggest lever against that sameness.
 */

export const SITE = {
  /** Brand wordmark shown in the app header / sidebar. */
  name: 'App',
  /** Short tagline for meta description + auth screens. */
  tagline: 'A fullstack app generated with founding.dev.',
  /** Canonical URL, used for OG tags. Overwritten at deploy. */
  url: 'http://localhost:8888',
  /** OG image path — relative to public/. */
  ogImage: '/og.png',
  author: 'founding.dev',
};

/* ------------------------------------------------------------------ *
 * Layout archetype
 * ------------------------------------------------------------------ */

/**
 * The four app shells AppShell can compose. Pick ONE per app, on turn 0, from
 * the app's core object and primary verb — NOT by habit. A persistent left
 * rail beside two links is the clearest tell of a generated app.
 *
 *  - 'sidebar'  Persistent left rail + slim topbar. For BROAD or growing IA
 *               (5+ destinations, or more than one level of hierarchy).
 *               Slack, Linear, Notion, GitHub.
 *  - 'topbar'   Horizontal nav, no rail, content clamped. For a SMALL, stable
 *               set of sections (2–4 destinations). Stripe, Vercel marketing.
 *  - 'focused'  Slim bar, no destination list, one centered column. For a
 *               single view / wizard / writing / reading / one flow.
 *               Typeform, iA Writer, Stripe Checkout.
 *  - 'canvas'   Topbar + full-bleed main that does NOT scroll, so a board /
 *               calendar / map / editor inside owns the viewport. Figma, Miro,
 *               Trello, Google Calendar.
 *
 * For a list-beside-record view (inbox, CRM, tracker, pipeline) use the
 * <ListDetail> component INSIDE whichever archetype you picked — it is not a
 * fifth shell and composes with all of them.
 */
export type LayoutArchetype = 'sidebar' | 'topbar' | 'focused' | 'canvas';

export const LAYOUT: LayoutArchetype = 'sidebar';

/**
 * CONTENT_WIDTH is a SEPARATE axis from nav placement.
 *  - 'fluid'    fills the viewport — data tables, boards, dashboards.
 *  - 'clamped'  a readable max-width column — forms, records, prose, settings.
 * Never assume a topbar app must be narrow or a sidebar app must be wide.
 * (Ignored by 'canvas', which is always full-bleed, and 'focused', which is
 * always a single centered column.)
 */
export type ContentWidth = 'fluid' | 'clamped';

export const CONTENT_WIDTH: ContentWidth = 'fluid';

/* ------------------------------------------------------------------ *
 * Navigation
 * ------------------------------------------------------------------ */

/** A lucide icon name (see components/layout/nav-icons.ts for the resolver). */
export type NavIcon = string;

export type NavItem = {
  to: string;
  label: string;
  /** lucide icon name, e.g. 'inbox', 'calendar', 'kanban'. Optional in topbar. */
  icon?: NavIcon;
  /** exact-match the active route (use for the index route '/'). */
  end?: boolean;
  /** open in a new tab. */
  external?: boolean;
};

/** A labeled group of destinations. `heading` renders as a section label in
 *  the sidebar and is ignored by the topbar (which flattens all sections). */
export type NavSection = { heading?: string; items: NavItem[] };

/**
 * The app's global navigation — every signed-in destination, once. ALL shells
 * (sidebar, topbar, mobile sheet) read from this ONE array, so a destination
 * can never exist in one and be missing from another, and switching LAYOUT
 * never drops a route. An unreachable route is a bug; a route with no nav entry
 * is invisible.
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

/* ------------------------------------------------------------------ *
 * Marketing config (public/landing routes only — NOT the app chrome)
 * ------------------------------------------------------------------ */

export type NavLink = { to: string; label: string; external?: boolean };

/** Primary marketing nav (used only by SiteHeader on a public landing route,
 *  never by the app shell). Kept for apps that ship a marketing front page. */
export const NAV: NavLink[] = NAV_SECTIONS.flatMap((s) =>
  s.items.map(({ to, label, external }) => ({ to, label, external })),
);

/** Optional right-aligned CTA in the marketing header. `null` to hide. */
export const NAV_CTA: { label: string; to: string } | null = null;

/** Footer link groups for a marketing footer. App shells never render a
 *  footer — a marketing footer around a dashboard is the clearest tell of an
 *  app built by someone who has not shipped one. */
export const FOOTER_GROUPS: Array<{ heading: string; links: NavLink[] }> = [
  {
    heading: 'Product',
    links: [
      { to: '/', label: 'Home' },
      { to: '/tasks', label: 'Tasks' },
    ],
  },
];
