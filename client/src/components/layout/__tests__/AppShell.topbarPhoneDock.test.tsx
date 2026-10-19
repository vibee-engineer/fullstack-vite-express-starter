import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// The topbar shell's phone navigation depends on how many places the app has.
const nav = vi.hoisted(() => ({ count: 3 }));
vi.mock('@/config/site', async (orig) => {
  const real = (await orig()) as Record<string, unknown>;
  return {
    ...real,
    get NAV_SECTIONS() {
      return [{ label: 'Main', items: Array.from({ length: nav.count }, (_, i) => ({ label: `Place ${i}`, to: i === 0 ? '/' : `/p${i}`, icon: 'home' })) }];
    },
  };
});

import { AppShell } from '../AppShell';

function topbar() {
  return render(
    <MemoryRouter>
      <AppShell layout="topbar" title="Recipes">
        <div>content</div>
      </AppShell>
    </MemoryRouter>,
  );
}

describe("AppShell 'topbar' on phones", () => {
  beforeEach(() => { nav.count = 3; });

  it('2-5 places: a phone-only bottom dock replaces the hamburger', () => {
    topbar();
    const dock = screen.getByRole('navigation', { name: 'Main' });
    expect(dock.className).toMatch(/bottom-0/);
    expect(dock.className).toMatch(/md:hidden/);
    expect(dock.querySelectorAll('a')).toHaveLength(3);
    expect(screen.queryByRole('button', { name: 'Open menu' })).toBeNull();
  });

  it('6+ places: keeps the hamburger sheet and no dock', () => {
    nav.count = 6;
    topbar();
    expect(screen.getByRole('button', { name: 'Open menu' })).toBeInTheDocument();
    expect(document.querySelector('nav.fixed')).toBeNull();
  });

  it("the 'dock' shell keeps its wide-screen pill (not phone-only)", () => {
    render(
      <MemoryRouter>
        <AppShell layout="dock" title="Today"><div /></AppShell>
      </MemoryRouter>,
    );
    expect(screen.getByRole('navigation', { name: 'Main' }).className).not.toMatch(/md:hidden/);
  });
});
