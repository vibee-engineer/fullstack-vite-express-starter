import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { AppShell } from '../AppShell';

function shell(layout: Parameters<typeof AppShell>[0]['layout']) {
  return render(
    <MemoryRouter>
      <AppShell layout={layout} title="Page title" headerActions={<button>Cart</button>}>
        <div data-testid="scene">scene</div>
      </AppShell>
    </MemoryRouter>,
  );
}

describe('AppShell archetypes', () => {
  it("'immersive' renders no bar, no rail and no title row: the scene owns the viewport", () => {
    const { container } = shell('immersive');
    expect(container.querySelector('header')).toBeNull();
    expect(container.querySelector('aside')).toBeNull();
    expect(screen.queryByText('Page title')).toBeNull();
    expect(screen.getByTestId('scene')).toBeInTheDocument();
    // HUD controls stay reachable: page actions + the destinations menu.
    expect(screen.getByRole('button', { name: 'Cart' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open menu' })).toBeInTheDocument();
  });

  it("'storefront' renders the top nav with the page's actions and no title row", () => {
    const { container } = shell('storefront');
    expect(container.querySelector('header')).not.toBeNull();
    expect(container.querySelector('aside')).toBeNull();
    expect(screen.queryByText('Page title')).toBeNull();
    expect(screen.getByRole('button', { name: 'Cart' })).toBeInTheDocument();
  });

  it("'sidebar' is unchanged: rail + topbar + title", () => {
    const { container } = shell('sidebar');
    expect(container.querySelector('aside')).not.toBeNull();
    expect(container.querySelector('header')).not.toBeNull();
    expect(screen.getByText('Page title')).toBeInTheDocument();
  });
});

describe('AppShell dock', () => {
  it("'dock' renders a bottom nav of destinations and no rail", () => {
    const { container } = shell('dock');
    expect(container.querySelector('aside')).toBeNull();
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(nav.className).toMatch(/bottom-0/);
    expect(nav.querySelectorAll('a').length).toBeGreaterThan(0);
  });
});
