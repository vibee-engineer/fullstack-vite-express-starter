/**
 * nav-icons.test.tsx — the nav icon map resolves the names the generator emits.
 *
 * The generated site.ts names icons by string. When a name isn't in the map,
 * NavIcon falls back to a first-letter monogram — which showed up in real apps
 * as bare "S / C / R" letters in the nav (store, calendar-clock, receipt). The
 * map is keyed on BOTH semantic intent (orders, invoices) and the literal lucide
 * kebab name (store, receipt, calendar-clock); this guards that both resolve to a
 * real glyph, and that the monogram only appears for a genuinely unknown name.
 */

import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { NavIcon, hasIcon } from '../nav-icons';

describe('hasIcon — the names the generator actually emits resolve', () => {
  // The exact literal lucide names that regressed to bare letters in shipped apps.
  it.each(['store', 'receipt', 'calendar-clock'])('resolves the literal name %s', (name) => {
    expect(hasIcon(name)).toBe(true);
  });

  // A spread across the verticals the generator scaffolds.
  it.each([
    'orders',
    'invoices',
    'shopping-cart',
    'credit-card',
    'trending-up',
    'heart-pulse',
    'graduation-cap',
    'shield-check',
    'clipboard-list',
    'products',
    'services',
    'discounts',
    'appointments',
    'patients',
  ])('resolves %s', (name) => {
    expect(hasIcon(name)).toBe(true);
  });

  it('returns false for a genuinely unknown name', () => {
    expect(hasIcon('definitely-not-an-icon')).toBe(false);
    expect(hasIcon(undefined)).toBe(false);
  });
});

describe('NavIcon — render', () => {
  it('renders an svg glyph for a known name', () => {
    const { container } = render(<NavIcon name="store" />);
    expect(container.querySelector('svg')).not.toBeNull();
    expect(container.textContent).toBe(''); // no monogram letter
  });

  it('renders a first-letter monogram (no svg) for an unknown name', () => {
    const { container } = render(<NavIcon name="zzunknown" />);
    expect(container.querySelector('svg')).toBeNull();
    expect(container.textContent).toBe('Z');
  });

  it('renders nothing when no name is given', () => {
    const { container } = render(<NavIcon />);
    expect(container.firstChild).toBeNull();
  });
});
