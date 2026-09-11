/**
 * stat-card.test.tsx — the delta convention is the whole point of this card, so
 * it is what we assert: the ARROW follows the raw direction, the COLOUR follows
 * meaning (higherIsBetter). The bug this prevents is a green up-arrow next to a
 * negative number for an inverse metric like churn.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { StatCard } from '@/components/ui/stat-card';

describe('StatCard delta convention', () => {
  it('renders the label and a numeric value', () => {
    render(<StatCard label="Active Subscribers" value={148} />);
    expect(screen.getByText('Active Subscribers')).toBeInTheDocument();
    expect(screen.getByText('148')).toBeInTheDocument();
  });

  it('normal metric rising is GOOD → green pill', () => {
    render(<StatCard label="MRR" value={100} delta="+6.3%" direction="up" higherIsBetter />);
    const pill = screen.getByText('+6.3%');
    expect(pill.className).toMatch(/emerald/);
    expect(pill.className).not.toMatch(/rose/);
  });

  it('inverse metric (churn) falling is GOOD → green pill with a down arrow', () => {
    const { container } = render(
      <StatCard label="Churn" value={1.8} delta="-0.8%" direction="down" higherIsBetter={false} />,
    );
    const pill = screen.getByText('-0.8%');
    // meaning: a decrease in churn is good → green, never red
    expect(pill.className).toMatch(/emerald/);
    expect(pill.className).not.toMatch(/rose/);
    // the arrow follows the raw direction (down), not the colour
    expect(container.querySelector('[class*="arrow-down"]')).toBeTruthy();
    expect(container.querySelector('[class*="arrow-up"]')).toBeFalsy();
  });

  it('inverse metric (churn) rising is BAD → red pill with an up arrow', () => {
    const { container } = render(
      <StatCard label="Churn" value={2.6} delta="+0.8%" direction="up" higherIsBetter={false} />,
    );
    const pill = screen.getByText('+0.8%');
    expect(pill.className).toMatch(/rose/);
    expect(pill.className).not.toMatch(/emerald/);
    expect(container.querySelector('[class*="arrow-up"]')).toBeTruthy();
  });

  it('renders a non-numeric value verbatim (no count-up)', () => {
    render(<StatCard label="Status" value={<span>Healthy</span>} />);
    expect(screen.getByText('Healthy')).toBeInTheDocument();
  });
});
