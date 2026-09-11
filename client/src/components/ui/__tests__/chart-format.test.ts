/**
 * chart-format.test.ts — the axis/tooltip formatters are what make a chart read
 * "$22.8k" instead of "22800". Assert the compaction rather than exact locale
 * glyphs (currency symbol placement varies by runtime locale).
 */
import { describe, expect, it } from 'vitest';

import { formatCompactCurrency, formatCompactNumber, formatCurrency } from '@/components/ui/chart';

describe('chart formatters', () => {
  it('compacts currency (22800 → 22.8k, not 22800)', () => {
    const out = formatCompactCurrency(22800);
    expect(out).toMatch(/22\.8/i);
    expect(out).toMatch(/k/i);
    expect(out).not.toMatch(/22800/);
  });

  it('compacts millions', () => {
    expect(formatCompactCurrency(1_200_000)).toMatch(/1\.2/);
    expect(formatCompactCurrency(1_200_000)).toMatch(/m/i);
  });

  it('compacts plain numbers', () => {
    expect(formatCompactNumber(1500)).toMatch(/1\.5/);
    expect(formatCompactNumber(1_500)).toMatch(/k/i);
  });

  it('formats full currency with 2 decimals and separators', () => {
    expect(formatCurrency(1234.5)).toMatch(/1,234\.50/);
  });
});
