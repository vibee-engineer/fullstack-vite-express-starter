/**
 * page-header.test.tsx — the page title wraps, it is never cut off. A home
 * screen opens on a line derived from the data ("Friday — 9 appointments
 * today, 2 gaps to fill"), which is longer than a phone is wide; a truncating
 * <h1> showed "Friday — 9 appoi…" at 375px and the build's own verify sweep
 * failed it as clipped text.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PageHeader } from '@/components/ui/page-header';

describe('PageHeader title', () => {
  it('wraps instead of truncating', () => {
    render(<PageHeader title="Friday — 9 appointments today, 2 gaps to fill" />);
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1.className).not.toMatch(/\btruncate\b/);
    expect(h1.className).not.toMatch(/\b(overflow-hidden|whitespace-nowrap|line-clamp-\d)\b/);
    expect(h1.className).toMatch(/\bbreak-words\b/);
  });

  it('keeps the description and actions', () => {
    render(<PageHeader title="Clients" description="42 active" actions={<button type="button">Add</button>} />);
    expect(screen.getByText('42 active')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add' })).toBeInTheDocument();
  });
});
