/**
 * chart-series-keys.test.tsx — field names and the percent scale.
 *
 * ClassFlow (staging, 2026-10-21) plotted `{ label, fill }` rows: recharts
 * copies a datum's fields onto its bar, so `fill: 0.79` painted every bar
 * black; and its 0-1 ratios under valueFormat="percent" read "1.2%" on the axis.
 */
import { cloneElement, isValidElement, type ReactNode } from 'react';
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('recharts', async (orig) => {
  const actual = await orig<typeof import('recharts')>();
  // bars start at height 0 and grow in an animation jsdom never runs
  (actual.Bar as unknown as { defaultProps: Record<string, unknown> }).defaultProps = {
    ...(actual.Bar as unknown as { defaultProps: Record<string, unknown> }).defaultProps,
    isAnimationActive: false,
  };
  // jsdom has no layout, so give the chart a real size to draw bars at.
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: ReactNode }) =>
      isValidElement(children)
        ? cloneElement(children as never, { width: 600, height: 260 })
        : null,
  };
});

import { Chart, formatPercent } from '@/components/ui/chart';

const rows = [
  { label: 'Sunrise Flow', fill: 0.79 },
  { label: 'Power', fill: 1.11 },
  { label: 'Yin', fill: 0.42 },
];

const barFills = (container: HTMLElement) =>
  [...container.querySelectorAll('.recharts-bar-rectangle path, .recharts-bar-rectangle rect')].map(
    (el) => el.getAttribute('fill'),
  );

describe('Chart series keys', () => {
  it('a series named `fill` keeps the accent colour', () => {
    const named = render(<Chart data={rows} xKey="label" series="fill" type="bar" />);
    const fills = barFills(named.container);
    expect(fills.length).toBe(3);
    for (const f of fills) expect(f).not.toMatch(/^[\d.]+$/);
    const plain = render(
      <Chart
        data={rows.map((r) => ({ label: r.label, value: r.fill }))}
        xKey="label"
        series="value"
        type="bar"
      />,
    );
    expect(fills).toEqual(barFills(plain.container));
  });

  it('the x key and series keep their data under any name', () => {
    const { container } = render(
      <Chart
        data={[
          { stroke: 'Mon', radius: 4 },
          { stroke: 'Tue', radius: 9 },
        ]}
        xKey="stroke"
        series="radius"
        type="bar"
      />,
    );
    expect(barFills(container).length).toBe(2);
    expect(container.textContent).toContain('Mon');
  });
});

describe('Chart percent', () => {
  it('takes 0-1 fractions', () => {
    expect(formatPercent(0.79)).toBe('79%');
    expect(formatPercent(1.11)).toBe('111%');
    expect(formatPercent(0.0425)).toBe('4.3%');
    expect(formatPercent(0.0425, true)).toBe('4%');
  });

  it('says so in the console when handed 0-100', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <Chart
        data={rows.map((r) => ({ ...r, fill: r.fill * 100 }))}
        xKey="label"
        series="fill"
        type="bar"
        valueFormat="percent"
      />,
    );
    expect(
      err.mock.calls.some((c) =>
        /\[Chart\] valueFormat "percent" takes a 0-1 fraction/.test(String(c[0])),
      ),
    ).toBe(true);
  });

  it('stays quiet for fractions, including an overfull 111%', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<Chart data={rows} xKey="label" series="fill" type="bar" valueFormat="percent" />);
    expect(err.mock.calls.some((c) => /\[Chart\]/.test(String(c[0])))).toBe(false);
  });
});
