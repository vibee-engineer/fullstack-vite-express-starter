/**
 * week-schedule.test.tsx — the day layout math and the view's render contract.
 *
 * The failure this primitive exists for: hand-rolled week calendars split
 * overlapping sessions into ever-thinner columns until each chip shows one or
 * two letters. `layoutDay` is pure, so the column rules are tested directly;
 * jsdom has no layout, so the render tests assert structure (labels, clicks,
 * overflow), not pixels.
 */

import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { layoutDay, WeekSchedule, type ScheduleEvent } from '../week-schedule';

const at = (h: number, m = 0, day = 6) => new Date(2026, 9, day, h, m);
const ev = (id: string, s: Date, e: Date, extra: Partial<ScheduleEvent> = {}): ScheduleEvent => ({
  id,
  start: s,
  end: e,
  title: `Patient ${id}`,
  ...extra,
});

describe('layoutDay', () => {
  it('gives non-overlapping events the full width', () => {
    const { placed, overflow } = layoutDay([ev('a', at(9), at(10)), ev('b', at(10), at(11))]);
    expect(placed.map((p) => [p.event.id, p.col, p.cols])).toEqual([
      ['a', 0, 1],
      ['b', 0, 1],
    ]);
    expect(overflow).toEqual([]);
  });

  it('splits an overlapping pair into two columns', () => {
    const { placed } = layoutDay([ev('a', at(9), at(10)), ev('b', at(9, 30), at(10, 30))]);
    expect(placed.map((p) => [p.event.id, p.col, p.cols])).toEqual([
      ['a', 0, 2],
      ['b', 1, 2],
    ]);
  });

  it('reuses a column once its event has ended, and the whole cluster shares the count', () => {
    const { placed } = layoutDay([
      ev('a', at(9), at(10)),
      ev('b', at(9, 30), at(10, 30)),
      ev('c', at(10), at(11)),
    ]);
    const byId = Object.fromEntries(placed.map((p) => [p.event.id, p]));
    expect(byId.c!.col).toBe(0);
    expect(new Set(placed.map((p) => p.cols))).toEqual(new Set([2]));
  });

  it('caps the columns and folds the rest into one "+N more" marker', () => {
    const four = ['a', 'b', 'c', 'd'].map((id) => ev(id, at(9), at(10)));
    const { placed, overflow } = layoutDay(four, 3);
    expect(placed).toHaveLength(2);
    expect(placed.every((p) => p.cols === 3)).toBe(true);
    expect(overflow).toHaveLength(1);
    expect(overflow[0]!.events.map((e) => e.id)).toEqual(['c', 'd']);
    expect(overflow[0]!.col).toBe(2);
    expect(overflow[0]!.cols).toBe(3);
  });

  it('never makes a chip narrower than 1 / maxColumns, however busy the hour', () => {
    const many = Array.from({ length: 9 }, (_, i) => ev(String(i), at(9), at(10)));
    const { placed, overflow } = layoutDay(many, 2);
    expect(Math.max(...placed.map((p) => p.cols), ...overflow.map((o) => o.cols))).toBe(2);
    expect(placed.length + overflow[0]!.events.length).toBe(9);
  });

  it('drops unparseable dates and gives a zero-length event 15 minutes', () => {
    const { placed } = layoutDay([ev('bad', new Date('nope'), at(10)), ev('zero', at(9), at(9))]);
    expect(placed.map((p) => p.event.id)).toEqual(['zero']);
    expect(placed[0]!.end.getTime() - placed[0]!.start.getTime()).toBe(15 * 60_000);
  });

  it('accepts ISO strings', () => {
    const { placed } = layoutDay([
      ev('a', at(9), at(10)),
      { ...ev('b', at(9), at(10)), start: at(9, 15).toISOString(), end: at(10, 15).toISOString() },
    ]);
    expect(placed.map((p) => p.cols)).toEqual([2, 2]);
  });
});

describe('<WeekSchedule />', () => {
  const weekStart = new Date(2026, 9, 5); // Monday 5 October 2026
  const now = new Date(2026, 9, 6, 12, 0);

  it('labels each chip with its full text and calls onEventClick', () => {
    const onEventClick = vi.fn();
    const e = ev('a', at(9), at(9, 45), { title: 'Maya Chen', subtitle: 'Initial assessment' });
    render(
      <WeekSchedule
        weekStart={weekStart}
        days={5}
        events={[e]}
        now={now}
        onEventClick={onEventClick}
      />,
    );
    const tuesday = screen.getAllByRole('region', { name: 'Tuesday 6 October' })[0]!;
    const chip = within(tuesday).getByRole('button', {
      name: '09:00 to 09:45, Maya Chen, Initial assessment',
    });
    fireEvent.click(chip);
    expect(onEventClick).toHaveBeenCalledWith(e);
  });

  it('shows a "+N more" chip instead of squeezing a busy hour', () => {
    const busy = ['a', 'b', 'c', 'd', 'e'].map((id) => ev(id, at(10), at(11)));
    render(<WeekSchedule weekStart={weekStart} days={5} events={busy} now={now} />);
    expect(screen.getByRole('button', { name: '3 more at 10:00' })).toHaveTextContent('+3 more');
  });

  it('keeps a cancelled session visible and says so', () => {
    render(
      <WeekSchedule
        weekStart={weekStart}
        days={5}
        events={[ev('a', at(9), at(10), { cancelled: true })]}
        now={now}
      />,
    );
    const chips = screen.getAllByRole('button', { name: /Patient a, cancelled/ });
    expect(chips[0]!.className).toMatch(/line-through/);
  });

  it('renders the agenda with an empty-day label for days with nothing on', () => {
    render(
      <WeekSchedule
        weekStart={weekStart}
        days={2}
        events={[]}
        now={now}
        emptyDayLabel="No sessions"
      />,
    );
    expect(screen.getAllByText('No sessions')).toHaveLength(2);
  });

  // Live clinic builds 2026-10-03: a 17:45-18:30 session on a grid ending at 18:00 was cut
  // off at the grid's bottom edge, and 15-minute sessions rendered as 24px chips whose
  // text was sliced through the middle.
  it('stretches the hours to show a session that runs past endHour or starts before startHour', () => {
    const late = ev('late', at(17, 45, 7), at(18, 30, 7));
    const early = ev('early', at(7, 30, 8), at(8, 15, 8));
    render(
      <WeekSchedule
        weekStart={weekStart}
        days={5}
        events={[late, early]}
        now={now}
        startHour={8}
        endHour={18}
      />,
    );
    const wed = screen.getAllByRole('region', { name: 'Wednesday 7 October' })[0]!;
    const chipBox = within(wed)
      .getByRole('button', { name: /Patient late/ })
      .closest('[style]')!;
    const top = parseFloat((chipBox as HTMLElement).style.top);
    const height = parseFloat((chipBox as HTMLElement).style.height);
    expect(top + height).toBeLessThanOrEqual(parseFloat((wed as HTMLElement).style.height));
    expect(screen.getByText('18:00')).toBeInTheDocument(); // the grid now reaches 19:00
    expect(screen.getByText('08:00')).toBeInTheDocument(); // and starts at 07:00
  });

  it('gives a short session one unpadded line so its text is not sliced', () => {
    render(
      <WeekSchedule
        weekStart={weekStart}
        days={5}
        events={[ev('s', at(9, 30), at(9, 45))]}
        now={now}
      />,
    );
    const chip = screen.getAllByRole('button', { name: /Patient s/ })[0]!;
    expect(chip.className).toMatch(/\bpy-0\b/);
    expect(chip.className).not.toMatch(/\bpy-1\b/);
  });

  it('renders the requested number of day columns', () => {
    render(<WeekSchedule weekStart={weekStart} days={5} events={[]} now={now} />);
    // each day appears once in the grid and once in the agenda
    expect(screen.getAllByRole('region', { name: /October/ })).toHaveLength(10);
  });
});
