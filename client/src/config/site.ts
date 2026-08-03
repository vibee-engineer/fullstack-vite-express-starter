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
