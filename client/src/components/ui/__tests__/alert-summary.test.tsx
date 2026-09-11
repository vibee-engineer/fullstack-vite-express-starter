/**
 * alert-summary.test.tsx — the point of this component is to REPLACE a stack of
 * near-identical banners with one grouped strip. So we assert the two behaviours
 * that do that: near-identical alerts collapse into one counted row, and only a
 * single blocking alert is promoted to a full banner.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AlertSummary, type AlertItem } from '@/components/ui/alert-summary';

const alerts: AlertItem[] = [
  { id: 'a1', title: 'Payment failed — $499/mo at risk', level: 'critical', blocking: true },
  { id: 'a2', title: 'trials ending soon', group: 'trial', level: 'warning' },
  { id: 'a3', title: 'trials ending soon', group: 'trial', level: 'warning' },
  { id: 'a4', title: 'trials ending soon', group: 'trial', level: 'warning' },
  { id: 'a5', title: 'Seat limit reached', level: 'info' },
];

describe('AlertSummary', () => {
  it('renders nothing when there are no alerts', () => {
    const { container } = render(<AlertSummary alerts={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('promotes a single blocking alert to a full banner', () => {
    render(<AlertSummary alerts={alerts} />);
    expect(screen.getByText('Payment failed — $499/mo at risk')).toBeInTheDocument();
  });

  it('collapses near-identical alerts into one counted strip row', () => {
    render(<AlertSummary alerts={alerts} />);
    // three grouped "trial" alerts render as ONE "3 trials ending soon" row, not three
    expect(screen.getByText('3 trials ending soon')).toBeInTheDocument();
    expect(screen.queryAllByText('trials ending soon')).toHaveLength(0);
  });

  it('counts the non-blocking alerts in the View-all affordance', () => {
    render(<AlertSummary alerts={alerts} />);
    // 4 non-blocking (3 trial + 1 info); the blocking one is excluded from the strip
    expect(screen.getByText(/View all \(4\)/)).toBeInTheDocument();
  });
});
