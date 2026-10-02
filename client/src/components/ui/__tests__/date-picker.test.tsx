/**
 * DatePicker must round-trip a calendar DAY. The classic bug: a picked Date
 * goes through toISOString() and lands on the previous day west of UTC.
 */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DatePicker } from '../date-picker';

const ORIGINAL_TZ = process.env.TZ;
beforeEach(() => {
  process.env.TZ = 'America/Los_Angeles';
});
afterEach(() => {
  process.env.TZ = ORIGINAL_TZ;
});

function Harness({
  initial,
  onChange,
}: {
  initial: string | null;
  onChange: (v: string | null) => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <DatePicker
      id="due"
      value={value}
      onChange={(v) => {
        setValue(v);
        onChange(v);
      }}
      disabled={{ dayOfWeek: [0, 6] }}
    />
  );
}

describe('DatePicker', () => {
  it('shows a stored key on its own day, not the day before', () => {
    render(<Harness initial="2026-10-02" onChange={() => {}} />);
    expect(screen.getByRole('button', { name: /October 2nd, 2026/ })).toBeInTheDocument();
  });

  it('emits the clicked day as YYYY-MM-DD and closes', async () => {
    const onChange = vi.fn();
    render(<Harness initial="2026-10-02" onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: /October 2nd, 2026/ }));
    const grid = await screen.findByRole('grid');
    await userEvent.click(within(grid).getByRole('button', { name: /October 15th, 2026/ }));
    expect(onChange).toHaveBeenCalledWith('2026-10-15');
    expect(screen.queryByRole('grid')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /October 15th, 2026/ })).toBeInTheDocument();
  });

  it('will not pick a disabled day', async () => {
    const onChange = vi.fn();
    render(<Harness initial="2026-10-02" onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: /October 2nd, 2026/ }));
    const grid = await screen.findByRole('grid');
    // Oct 3 2026 is a Saturday.
    const sat = within(grid).getByRole('button', { name: /October 3rd, 2026/ });
    expect(sat).toBeDisabled();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('shows the placeholder when empty', () => {
    render(<Harness initial={null} onChange={() => {}} />);
    expect(screen.getByRole('button', { name: /Pick a date/ })).toBeInTheDocument();
  });
});
