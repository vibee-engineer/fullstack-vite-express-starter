import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';

import { cn } from '@/lib/utils';

export type KanbanColumn<T> = {
  id: string;
  title: ReactNode;
  items: T[];
  /** optional accent color for the column header dot (any CSS color/token) */
  accent?: string;
};

type KanbanBoardProps<T> = {
  columns: KanbanColumn<T>[];
  renderCard: (item: T, columnId: string) => ReactNode;
  itemKey: (item: T) => string;
  /**
   * Enable drag-and-drop. Called on every committed move with the card id, the
   * column it landed in, and its index there. The PARENT owns the data — update
   * your state here (optimistically) and the board re-renders from the new
   * `columns`. Omit this prop for a read-only board (no drag affordances).
   */
  onMove?: (itemId: string, toColumnId: string, toIndex: number) => void;
  /** optional footer per column (e.g. an "+ Add" button) */
  columnFooter?: (columnId: string) => ReactNode;
  /** text shown in an empty column's drop zone (default: "Nothing here yet") */
  emptyLabel?: string;
  className?: string;
};

export type ColLayout = { id: string; itemIds: string[] };

/**
 * Where to drop the active card inside a destination column given what it's
 * hovering. Dropping on the column body appends; dropping on a card inserts
 * before or after it based on whether the dragged card's top crossed the target
 * card's midline — so a card can land at the very bottom of a column, which a
 * plain `indexOf` (always "before the hovered card") can't express.
 *
 * `toItemIds` must already have the active card removed, so indices refer to the
 * post-removal array. Exported (with primitive args, no dnd-kit event) so the
 * placement math is unit-testable without a synthetic DragEvent.
 */
export function resolveInsertIndex(
  toColId: string,
  toItemIds: string[],
  overId: string,
  activeTop?: number,
  overRect?: { top: number; height: number },
): number {
  if (toColId === overId) return toItemIds.length; // dropped on the column body, not a card
  const overIndex = toItemIds.indexOf(overId);
  if (overIndex === -1) return toItemIds.length;
  const isBelow =
    activeTop != null && overRect ? activeTop > overRect.top + overRect.height / 2 : false;
  return overIndex + (isBelow ? 1 : 0);
}

/** True when two layouts hold the same columns in the same order with the same cards. */
export function sameLayout(a: ColLayout[], b: ColLayout[]): boolean {
  if (a.length !== b.length) return false;
  return a.every(
    (col, i) =>
      col.id === b[i]!.id &&
      col.itemIds.length === b[i]!.itemIds.length &&
      col.itemIds.every((id, j) => id === b[i]!.itemIds[j]),
  );
}

/**
 * KanbanBoard — columns of cards for objects that move through stages (deals,
 * issues, orders, applicants). Pass `onMove` to get real drag-and-drop:
 *
 *   - pointer drag starts after a 5px move, so clicks and links inside a card
 *     still fire (dnd-kit has no default activation constraint — omitting it is
 *     the classic "the whole board is un-clickable" bug);
 *   - the source card stays in place at 40% opacity while a lifted clone follows
 *     the cursor (DragOverlay), the Atlassian pattern — cards don't vanish;
 *   - cross-column moves reflow live; the move commits on drop via `onMove`;
 *   - full keyboard DnD (Space to grab, arrows to move, Esc to cancel) with
 *     screen-reader announcements — a mouse-only board fails accessibility.
 *
 * Empty columns render a dashed drop zone instead of a blank void. Lives happily
 * in the 'canvas' archetype (full-bleed, owns its horizontal scroll).
 *
 * Presentational by default (no `onMove`) so it also works as a read-only board.
 */
export function KanbanBoard<T>({
  columns,
  renderCard,
  itemKey,
  onMove,
  columnFooter,
  emptyLabel = 'Nothing here yet',
  className,
}: KanbanBoardProps<T>) {
  const draggable = Boolean(onMove);

  // Fast lookup from card id -> { item, columnId } off the source-of-truth props.
  const index = useMemo(() => {
    const map = new Map<string, { item: T; columnId: string }>();
    for (const col of columns)
      for (const item of col.items) map.set(itemKey(item), { item, columnId: col.id });
    return map;
  }, [columns, itemKey]);

  // Working copy of the id layout, synced from props except while a drag is live
  // (so cross-column reflow can happen without waiting on the parent round-trip).
  const propLayout = useMemo(
    () => columns.map((c) => ({ id: c.id, itemIds: c.items.map(itemKey) })),
    [columns, itemKey],
  );
  const [layout, setLayout] = useState(propLayout);
  const [activeId, setActiveId] = useState<string | null>(null);
  // Measured width of the grabbed card, applied to the DragOverlay clone so the
  // lifted card is exactly the size of the one it left behind — otherwise it
  // pops to a hardcoded width on grab and snaps again on drop (the old `w-64`
  // was narrower than the real card, which reads as the "clunky" size jump).
  const [activeWidth, setActiveWidth] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (!activeId) setLayout(propLayout);
  }, [propLayout, activeId]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const columnOf = (id: string) => layout.find((c) => c.id === id || c.itemIds.includes(id))?.id;

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
    const w = e.active.rect.current.initial?.width;
    if (w) setActiveWidth(w);
  }

  function onDragOver(e: DragOverEvent) {
    const activeCardId = String(e.active.id);
    const overId = e.over ? String(e.over.id) : null;
    if (!overId) return;
    const from = columnOf(activeCardId);
    const to = columnOf(overId);
    // Same-column reordering is previewed by verticalListSortingStrategy (it
    // shifts the siblings live) and committed in onDragEnd — mutating `layout`
    // here too would fight the strategy. So onDragOver only handles the
    // cross-column hand-off.
    if (!from || !to || from === to) return;
    setLayout((prev) => {
      const next = prev.map((c) => ({ ...c, itemIds: [...c.itemIds] }));
      const fromCol = next.find((c) => c.id === from)!;
      const toCol = next.find((c) => c.id === to)!;
      fromCol.itemIds = fromCol.itemIds.filter((id) => id !== activeCardId);
      const insertAt = resolveInsertIndex(
        toCol.id,
        toCol.itemIds,
        overId,
        e.active.rect.current.translated?.top,
        e.over?.rect,
      );
      toCol.itemIds.splice(insertAt, 0, activeCardId);
      // Equality guard: dragOver fires on every pointer move, so bail out with
      // the SAME array reference when the order is unchanged — otherwise the
      // whole board re-renders on every mousemove and the drag visibly stutters.
      return sameLayout(prev, next) ? prev : next;
    });
  }

  function onDragEnd(e: DragEndEvent) {
    const activeCardId = String(e.active.id);
    const overId = e.over ? String(e.over.id) : null;
    setActiveId(null);
    setActiveWidth(undefined);
    // Dropped outside any droppable — snap back to the prop order.
    if (!overId) {
      setLayout(propLayout);
      return;
    }
    // `over` can resolve to the DRAGGED CARD itself at drop — most often in
    // keyboard DnD, where after an arrow move the collision target is the card
    // in its new slot. That is NOT a no-op: the card may have crossed columns
    // during the live drag. Treat "over === active" as "commit where the card
    // now sits" — columnOf(active) is its transient column — instead of
    // reverting, which would silently throw away a real move.
    const to = columnOf(overId) ?? columnOf(activeCardId);
    if (!to) {
      setLayout(propLayout);
      return;
    }
    // Compute final placement from the CURRENT layout, then commit. `onMove` is
    // a side effect (parent setState), so it must run AFTER setLayout and never
    // inside the updater — React StrictMode double-invokes updaters to check
    // purity, which would fire `onMove` twice. This unifies the same-column
    // arrayMove and the cross-column drop through one index resolver so both
    // honor the pointer's top/bottom-half position over the target card.
    const next = layout.map((c) => ({ ...c, itemIds: [...c.itemIds] }));
    const toCol = next.find((c) => c.id === to)!;
    let finalIndex: number;
    if (overId === activeCardId) {
      // Over is the dragged card itself (common in keyboard DnD): it already
      // sits in `to` at its live-drag slot — commit that index as-is.
      finalIndex = Math.max(0, toCol.itemIds.indexOf(activeCardId));
    } else {
      const fromCol = next.find((c) => c.itemIds.includes(activeCardId))!;
      fromCol.itemIds = fromCol.itemIds.filter((id) => id !== activeCardId);
      finalIndex = resolveInsertIndex(
        toCol.id,
        toCol.itemIds,
        overId,
        e.active.rect.current.translated?.top,
        e.over?.rect,
      );
      toCol.itemIds.splice(finalIndex, 0, activeCardId);
    }
    setLayout(next);
    onMove?.(activeCardId, to, finalIndex);
  }

  const activeItem = activeId ? index.get(activeId)?.item : undefined;
  const activeColumnId = activeId ? index.get(activeId)?.columnId : undefined;

  const board = (
    <div className={cn('flex h-full items-start gap-4 overflow-x-auto p-4', className)}>
      {layout.map((col) => {
        const meta = columns.find((c) => c.id === col.id);
        if (!meta) return null;
        return (
          <KanbanColumnShell
            key={col.id}
            id={col.id}
            title={meta.title}
            accent={meta.accent}
            count={col.itemIds.length}
            footer={columnFooter?.(col.id)}
            emptyLabel={emptyLabel}
            draggable={draggable}
            itemIds={col.itemIds}
          >
            {col.itemIds.map((id) => {
              const entry = index.get(id);
              if (!entry) return null;
              return (
                <SortableCard key={id} id={id} draggable={draggable} dimmed={id === activeId}>
                  {renderCard(entry.item, col.id)}
                </SortableCard>
              );
            })}
          </KanbanColumnShell>
        );
      })}
    </div>
  );

  if (!draggable) return board;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={() => {
        setActiveId(null);
        setActiveWidth(undefined);
        setLayout(propLayout);
      }}
    >
      {board}
      {/*
        Drop animation: a plain decelerate curve (no overshoot). The old
        cubic-bezier ended at 1.22, so the card flew PAST its slot and snapped
        back — the "bad transition" on drop. 200ms ease-out lands it cleanly.
      */}
      <DragOverlay dropAnimation={{ duration: 200, easing: 'cubic-bezier(0.2, 0, 0, 1)' }}>
        {activeItem && activeColumnId ? (
          <div
            style={{ width: activeWidth }}
            className="rotate-[1.5deg] cursor-grabbing opacity-100 shadow-xl"
          >
            {renderCard(activeItem, activeColumnId)}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function KanbanColumnShell({
  id,
  title,
  accent,
  count,
  footer,
  emptyLabel,
  draggable,
  itemIds,
  children,
}: {
  id: string;
  title: ReactNode;
  accent?: string;
  count: number;
  footer?: ReactNode;
  emptyLabel: string;
  draggable: boolean;
  itemIds: string[];
  children: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <section className="flex h-full w-72 shrink-0 flex-col rounded-xl border border-border bg-muted/40">
      <header className="flex items-center gap-2 px-3.5 py-3">
        <span
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ backgroundColor: accent ?? 'hsl(var(--primary))' }}
        />
        <span className="text-[0.8125rem] font-semibold tracking-tight">{title}</span>
        <span className="ml-auto rounded-full bg-background px-2 py-0.5 text-xs font-medium text-muted-foreground tabular-nums">
          {count}
        </span>
      </header>
      <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
        <div
          ref={setNodeRef}
          className={cn(
            'flex min-h-0 flex-1 flex-col gap-2 rounded-lg p-2 transition-colors duration-fast',
            isOver && 'bg-primary/[0.04]',
          )}
        >
          {count > 0 ? (
            children
          ) : (
            <div
              className={cn(
                'flex flex-1 items-center justify-center rounded-lg border border-dashed border-border/70 px-3 py-8 text-center text-xs text-muted-foreground/70 transition-colors duration-fast',
                isOver && 'border-primary/40 text-primary',
              )}
            >
              {draggable ? `${emptyLabel} — drop here` : emptyLabel}
            </div>
          )}
        </div>
      </SortableContext>
      {footer ? <footer className="p-2 pt-0">{footer}</footer> : null}
    </section>
  );
}

function SortableCard({
  id,
  draggable,
  dimmed,
  children,
}: {
  id: string;
  draggable: boolean;
  dimmed: boolean;
  children: ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled: !draggable,
  });
  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  } as const;
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group/card relative touch-none',
        // The source card holds its place at 40% while the overlay clone drags.
        isDragging || dimmed ? 'opacity-40' : 'opacity-100',
      )}
      {...(draggable ? { ...attributes, ...listeners } : {})}
    >
      {draggable ? (
        <span
          aria-hidden
          className="pointer-events-none absolute right-1.5 top-1.5 text-muted-foreground/0 transition-colors duration-fast group-hover/card:text-muted-foreground/50"
        >
          <GripVertical className="h-4 w-4" />
        </span>
      ) : null}
      <div className={cn(draggable && 'cursor-grab active:cursor-grabbing')}>{children}</div>
    </div>
  );
}

/** A default card shell for KanbanBoard items — use it or roll your own. */
export function KanbanCard({
  title,
  meta,
  children,
  onClick,
}: {
  title: ReactNode;
  meta?: ReactNode;
  children?: ReactNode;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      className={cn(
        'w-full rounded-lg border border-border bg-card p-3 text-left text-card-foreground shadow-xs transition-all duration-fast ease-out',
        onClick && 'cursor-pointer hover:-translate-y-0.5 hover:border-border hover:shadow-md',
      )}
    >
      <div className="text-sm font-medium leading-snug">{title}</div>
      {meta ? <div className="mt-1.5 text-xs text-muted-foreground">{meta}</div> : null}
      {children ? <div className="mt-2">{children}</div> : null}
    </div>
  );
}
