/**
 * site.ts — brand + navigation configuration for the APP shell.
 *
 * THE AGENT EDITS THIS FILE FIRST. AppSidebar and Topbar read SITE and
 * NAV_SECTIONS from here. Editing the layout components directly to change
 * nav/brand is denied by the SDK canUseTool gate — customize here instead.
 *
 * This is an authenticated application, not a marketing site. There is
 * deliberately no FOOTER_GROUPS and no NAV_CTA export: a dashboard does not
 * ship a marketing footer with link columns, and a primary action belongs on
 * the page it applies to, not in the global chrome. If the product genuinely
 * needs a public marketing page, build it as its own route with its own
 * layout — never push marketing chrome into the app shell.
 */

/** Icon keys resolve through ICONS in AppSidebar.tsx (lucide-react). */
export type NavIcon =
  | 'home'
  | 'list'
  | 'chart'
  | 'users'
  | 'calendar'
  | 'settings'
  | 'inbox'
  | 'folder'
  | 'star'
  | 'tag';

export type NavItem = {
  to: string;
  label: string;
  icon: NavIcon;
  /** Optional trailing count, e.g. unread or overdue items. */
  badge?: string | number;
};

/** A labelled group of sidebar links. One unlabelled group is fine for small apps. */
export type NavSection = {
  /** Omit on the primary group to render it without a label. */
  heading?: string;
  items: NavItem[];
};

/**
 * The four application shells AppShell can compose.
 *
 * Layout follows from information architecture, not from house style. Pick the
 * one that fits THIS app; none of them is a downgrade.
 *
 *   sidebar  Persistent rail + topbar + scrolling main.
 *            Many destinations, or nav that needs labelled groups.
 *   topbar   Horizontal nav in the topbar, no rail, content clamped to 1280px.
 *            A handful of destinations, where a rail is mostly empty space.
 *   focused  Slim bar, no destinations listed, single centered 768px column.
 *            One view, a wizard, or a flow where nav is a distraction.
 *   canvas   Topbar + full-bleed main that does NOT scroll. The board, map or
 *            editor inside owns the viewport and its own scrolling.
 */
export type LayoutArchetype = 'sidebar' | 'topbar' | 'focused' | 'canvas';

/**
 * This app's shell. AppShell reads it; change it here, never by editing the
 * layout components.
 *
 * Choose by counting the destinations a signed-in user navigates between (the
 * entries in NAV_SECTIONS), then sanity-check against the app's interaction
 * model — a board or editor wants `canvas` regardless of destination count.
 *
 * A sidebar on a two-page app is the most common tell of a generated app: a
 * 256px rail holding two links, next to content that had nowhere to go.
 */
export const LAYOUT: LayoutArchetype = 'sidebar';

export const SITE = {
  /** Brand wordmark in the sidebar header. Keep it short — it sits in 256px. */
  name: 'App',
  /** One-sentence positioning. Used for meta description, not shown in chrome. */
  tagline: 'A fullstack app generated with founding.dev.',
  /** Canonical URL, used for OG tags. Overwritten at deploy. */
  url: 'http://localhost:8888',
  /** OG image path — relative to public/. */
  ogImage: '/og.png',
  author: 'founding.dev',
};

/**
 * Sidebar navigation. Every route a signed-in user should reach belongs here —
 * an unreachable route is a bug. Group only once there are enough links to
 * warrant it (roughly 6+); a single unlabelled group reads cleaner below that.
 */
export const NAV_SECTIONS: NavSection[] = [
  {
    items: [
      { to: '/', label: 'Dashboard', icon: 'home' },
      // Reference CRUD vertical (client/src/pages/TasksPage.tsx). Remove this
      // item and the route in App.tsx once the real resources land.
      { to: '/tasks', label: 'Tasks', icon: 'list' },
    ],
  },
];
