/**
 * AppShell.test.tsx — each layout archetype must actually differ.
 *
 * WHY THIS EXISTS
 * ===============
 * AppShell used to hardcode one shape: a 256px sidebar rail plus a topbar,
 * applied to every route of every generated app because App.tsx wraps the whole
 * route tree in it and there was no prop to vary it. A single-purpose tool and a
 * 12-destination admin console came out identical, same rail, same width.
 *
 * Now the archetype is chosen per app. These tests pin the invariant that makes
 * that real: each archetype composes DIFFERENT chrome. A regression that quietly
 * renders the rail everywhere again (or drops navigation entirely) fails here.
 *
 * The mobile-parity case matters most of the four: without a rail, hiding the
 * drawer trigger on desktop would strand every destination behind a control that
 * does not exist at that width — an app with unreachable routes.
 */
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, test, vi } from 'vitest';

import { AppShell } from '../AppShell';

vi.mock('@/config/site', () => ({
  LAYOUT: 'sidebar',
  // Nav placement and content width are independent axes, so the mock must
  // supply both. 'fluid' is the starter default: dense app UI uses the full
  // width (Carbon's high-density model), and only prose/forms clamp.
  CONTENT_WIDTH: 'fluid',
  SITE: { name: 'Test App', tagline: 't', url: '', ogImage: '', author: '' },
  NAV_SECTIONS: [
    {
      items: [
        { to: '/', label: 'Overview', icon: 'home' },
        { to: '/things', label: 'Things', icon: 'list' },
      ],
    },
  ],
}));

const mount = (
  layout?: 'sidebar' | 'topbar' | 'focused' | 'canvas',
  width?: 'fluid' | 'clamped',
) =>
  render(
    <MemoryRouter>
      <AppShell layout={layout} width={width} title="Page">
        <p>content</p>
      </AppShell>
    </MemoryRouter>,
  );

/** The desktop rail is the <aside> AppSidebar renders. */
const rail = () => document.querySelector('aside');
const main = () => document.querySelector('main');
/**
 * Horizontal nav only exists in the topbar archetype.
 *
 * Scoped to <header> deliberately: AppSidebar ALSO renders
 * nav[aria-label="Main"], so an unscoped selector matches the rail's nav and
 * every archetype looks like it has a topbar nav.
 */
const topbarNav = () => document.querySelector('header nav[aria-label="Main"]');

describe('AppShell archetypes', () => {
  test('sidebar: mounts the rail and scrolls main', () => {
    mount('sidebar');
    expect(rail()).not.toBeNull();
    expect(topbarNav()).toBeNull();
    expect(main()!.className).toContain('overflow-y-auto');
  });

  test('topbar: no rail, horizontal nav, width left to the policy', () => {
    mount('topbar');
    // The whole point: no 256px column holding two links.
    expect(rail()).toBeNull();
    const nav = topbarNav();
    expect(nav).not.toBeNull();
    // Every destination still reachable — nav parity with the rail it replaced.
    expect(nav!.textContent).toContain('Overview');
    expect(nav!.textContent).toContain('Things');
    // Width is NOT implied by nav placement: with the default 'fluid' policy a
    // topbar app of wide data tables must stay full width. Clamping it here was
    // the bug — it conflated two independent axes.
    expect(document.querySelector('.max-w-7xl')).toBeNull();
  });

  test('width policy clamps independently of nav placement', () => {
    mount('topbar', 'clamped');
    expect(document.querySelector('.max-w-7xl')).not.toBeNull();
  });

  test('a sidebar app can clamp a single route', () => {
    // A settings form inside a dashboard should not run to 1600px.
    mount('sidebar', 'clamped');
    expect(rail()).not.toBeNull();
    expect(document.querySelector('.max-w-7xl')).not.toBeNull();
  });

  test('canvas ignores a clamp — the surface owns the viewport', () => {
    mount('canvas', 'clamped');
    expect(document.querySelector('.max-w-7xl')).toBeNull();
    expect(document.querySelector('.max-w-3xl')).toBeNull();
  });

  test('focused: no rail, no destination list, narrow column', () => {
    mount('focused');
    expect(rail()).toBeNull();
    expect(topbarNav()).toBeNull();
    expect(document.querySelector('.max-w-3xl')).not.toBeNull();
  });

  test('focused clamps even when the policy says fluid', () => {
    // A readable measure IS the archetype; 'fluid' cannot opt out of it.
    mount('focused', 'fluid');
    expect(document.querySelector('.max-w-3xl')).not.toBeNull();
  });

  test('canvas: full-bleed, and main does NOT scroll', () => {
    mount('canvas');
    expect(rail()).toBeNull();
    // The canvas inside owns scrolling; a scrolling wrapper double-scrollbars it.
    expect(main()!.className).toContain('overflow-hidden');
    expect(main()!.className).not.toContain('overflow-y-auto');
    // Full-bleed: no shell padding, and no width clamp.
    expect(main()!.className).toContain('p-0');
    expect(document.querySelector('.max-w-7xl')).toBeNull();
    expect(document.querySelector('.max-w-3xl')).toBeNull();
  });

  test('defaults to the app-wide LAYOUT when no override is passed', () => {
    mount(); // mocked LAYOUT is 'sidebar'
    expect(rail()).not.toBeNull();
  });

  test('railless archetypes keep the nav drawer reachable on desktop', () => {
    // Regression guard: the trigger is `md:hidden` by default because the rail
    // covers navigation above md. With no rail, that default would hide the ONLY
    // way to reach other routes on a desktop viewport.
    mount('topbar');
    const trigger = screen.getByLabelText('Open navigation');
    expect(trigger.className).not.toContain('md:hidden');
  });

  test('sidebar archetype still hides the drawer trigger on desktop', () => {
    // The rail is the desktop affordance there, so showing both is duplicate nav.
    mount('sidebar');
    expect(screen.getByLabelText('Open navigation').className).toContain('md:hidden');
  });

  test('every archetype renders its children', () => {
    for (const l of ['sidebar', 'topbar', 'focused', 'canvas'] as const) {
      const { unmount } = mount(l);
      expect(screen.getByText('content')).toBeInTheDocument();
      unmount();
    }
  });
});
