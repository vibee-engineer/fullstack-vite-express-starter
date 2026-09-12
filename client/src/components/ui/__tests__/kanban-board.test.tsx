/**
 * kanban-board.test.tsx — the drag placement math and the board's static render.
 *
 * The pointer-drag interaction itself (grab, hover, drop) is exercised live in a
 * real browser — jsdom reports every element rect as 0×0, so a simulated drag
 * there would test nothing real. What IS unit-testable, and where the bugs lived,
 * is the placement resolver: `resolveInsertIndex` decides where a card lands, and
 * `sameLayout` is the equality guard that stops the drag from re-rendering the
 * whole board on every mouse move. Both are pure, so they're tested directly.
 */

import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { KanbanBoard, KanbanCard, resolveInsertIndex, sameLayout } from '../kanban-board';

describe('resolveInsertIndex — where a dragged card lands', () => {
  const ids = ['a', 'b', 'c']; // the destination column, active card already removed

  it('appends when dropped on the column body (overId === column id)', () => {
    expect(resolveInsertIndex('todo', ids, 'todo')).toBe(3);
  });

  it('appends when the hovered id is not in the column (stale/unknown over)', () => {
    expect(resolveInsertIndex('todo', ids, 'gone')).toBe(3);
  });

  it('inserts BEFORE the hovered card when no rect info is available', () => {
    expect(resolveInsertIndex('todo', ids, 'b')).toBe(1);
  });

  it('inserts BEFORE when the dragged top is above the target midline', () => {
    // target 'b' spans top=100..height=40 → midline 120; active top 105 < 120.
    expect(resolveInsertIndex('todo', ids, 'b', 105, { top: 100, height: 40 })).toBe(1);
  });

  it('inserts AFTER when the dragged top crosses below the target midline', () => {
    // active top 130 > midline 120 → after 'b'.
    expect(resolveInsertIndex('todo', ids, 'b', 130, { top: 100, height: 40 })).toBe(2);
  });

  it('can land at the very BOTTOM by dropping past the last card (the old bug)', () => {
    // Hovering the last card 'c' with the pointer past its midline must yield
    // index 3 (end), not 2. The old indexOf-only code could never reach the end.
    expect(resolveInsertIndex('todo', ids, 'c', 999, { top: 200, height: 40 })).toBe(3);
  });

  it('lands at the TOP (index 0) when above the first card', () => {
    expect(resolveInsertIndex('todo', ids, 'a', 0, { top: 10, height: 40 })).toBe(0);
  });

  it('appends into an empty destination column', () => {
    expect(resolveInsertIndex('done', [], 'done')).toBe(0);
  });
});

describe('sameLayout — the dragOver equality guard', () => {
  const base = [
    { id: 'todo', itemIds: ['a', 'b'] },
    { id: 'done', itemIds: ['c'] },
  ];

  it('is true for a structurally identical layout', () => {
    expect(
      sameLayout(
        base,
        base.map((c) => ({ ...c, itemIds: [...c.itemIds] })),
      ),
    ).toBe(true);
  });

  it('is false when a card order changes', () => {
    expect(
      sameLayout(base, [
        { id: 'todo', itemIds: ['b', 'a'] },
        { id: 'done', itemIds: ['c'] },
      ]),
    ).toBe(false);
  });

  it('is false when a card moves to another column', () => {
    expect(
      sameLayout(base, [
        { id: 'todo', itemIds: ['a'] },
        { id: 'done', itemIds: ['b', 'c'] },
      ]),
    ).toBe(false);
  });

  it('is false when column count differs', () => {
    expect(sameLayout(base, [{ id: 'todo', itemIds: ['a', 'b'] }])).toBe(false);
  });

  it('is false when a column id differs (reordered/renamed columns)', () => {
    expect(
      sameLayout(base, [
        { id: 'backlog', itemIds: ['a', 'b'] },
        { id: 'done', itemIds: ['c'] },
      ]),
    ).toBe(false);
  });
});

type Deal = { id: string; name: string };
const columns = [
  { id: 'todo', title: 'To do', items: [{ id: 'd1', name: 'Acme' }] as Deal[] },
  { id: 'done', title: 'Done', items: [] as Deal[] },
];
const renderCard = (d: Deal) => <KanbanCard title={d.name} />;
const itemKey = (d: Deal) => d.id;

describe('KanbanBoard — static render', () => {
  it('renders cards and per-column counts', () => {
    render(<KanbanBoard columns={columns} renderCard={renderCard} itemKey={itemKey} />);
    expect(screen.getByText('Acme')).toBeInTheDocument();
    expect(screen.getByText('To do')).toBeInTheDocument();
    // The populated column shows count 1, the empty one shows 0.
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('shows the plain empty label when read-only (no onMove)', () => {
    render(
      <KanbanBoard
        columns={columns}
        renderCard={renderCard}
        itemKey={itemKey}
        emptyLabel="No deals"
      />,
    );
    expect(screen.getByText('No deals')).toBeInTheDocument();
  });

  it('shows the "drop here" affordance on an empty column when draggable', () => {
    render(
      <KanbanBoard
        columns={columns}
        renderCard={renderCard}
        itemKey={itemKey}
        emptyLabel="No deals"
        onMove={() => {}}
      />,
    );
    expect(screen.getByText(/No deals — drop here/)).toBeInTheDocument();
  });

  it('reflects an updated column order when props change (parent owns the data)', () => {
    const { rerender } = render(
      <KanbanBoard columns={columns} renderCard={renderCard} itemKey={itemKey} onMove={() => {}} />,
    );
    const moved = [
      { id: 'todo', title: 'To do', items: [] as Deal[] },
      { id: 'done', title: 'Done', items: [{ id: 'd1', name: 'Acme' }] as Deal[] },
    ];
    rerender(
      <KanbanBoard columns={moved} renderCard={renderCard} itemKey={itemKey} onMove={() => {}} />,
    );
    const doneCol = screen.getByText('Done').closest('section')!;
    expect(within(doneCol).getByText('Acme')).toBeInTheDocument();
  });
});
