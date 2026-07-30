/**
 * site.ts — brand + nav configuration.
 *
 * THE AGENT EDITS THIS FILE FIRST. AppShell / SiteHeader / SiteFooter all
 * read SITE, NAV, NAV_CTA, and FOOTER_GROUPS from here. Editing the layout
 * components directly to change nav/brand is denied by the SDK canUseTool
 * gate — customize here instead.
 */

export const SITE = {
  /** Brand wordmark shown in the site header. */
  name: 'App',
  /** Short tagline for footer / meta description. */
  tagline: 'A fullstack app generated with founding.dev.',
  /** Canonical URL, used for OG tags. Overwritten at deploy. */
  url: 'http://localhost:8888',
  /** OG image path — relative to public/. */
  ogImage: '/og.png',
  author: 'founding.dev',
};

export type NavLink = { to: string; label: string; external?: boolean };

/** Primary navigation. First item is leftmost. */
export const NAV: NavLink[] = [
  { to: '/', label: 'Home' },
  // Reference CRUD vertical (client/src/pages/TasksPage.tsx). Remove this link
  // and the route in App.tsx once the real resources land.
  { to: '/tasks', label: 'Tasks' },
];

/** Optional right-aligned CTA in the header. Set to `null` to hide. */
export const NAV_CTA: { label: string; to: string } | null = null;

/** Footer link groups — each group renders as a labeled column. */
export const FOOTER_GROUPS: Array<{ heading: string; links: NavLink[] }> = [
  {
    heading: 'Product',
    links: [
      { to: '/', label: 'Home' },
      { to: '/tasks', label: 'Tasks' },
    ],
  },
];
