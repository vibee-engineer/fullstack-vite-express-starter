import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

export type KanbanColumn<T> = {
  id: string;
  title: ReactNode;
  items: T[];
  /** optional accent color for the column header dot (any CSS color/token) */
  accent?: string;
};

/**
 * KanbanBoard — horizontal columns of cards, for objects that move through
 * stages (deals, issues, orders, applicants). Presentational: it renders the
 * columns and cards; wire drag/drop or click-to-advance with your own handlers
 * via `renderCard`. Lives happily inside the 'canvas' archetype (full-bleed,
 * owns its own horizontal scroll) or any scrolling shell.
 */
export function KanbanBoard<T>({
  columns,
  renderCard,
  itemKey,
  columnFooter,
  className,
}: {
  columns: KanbanColumn<T>[];
  renderCard: (item: T, columnId: string) => ReactNode;
  itemKey: (item: T) => string;
  /** optional footer per column (e.g. an "+ Add" button) */
  columnFooter?: (columnId: string) => ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex h-full gap-4 overflow-x-auto p-4', className)}>
      {columns.map((col) => (
        <section
          key={col.id}
          className="flex h-full w-72 shrink-0 flex-col rounded-lg border border-border bg-muted/30"
        >
          <header className="flex items-center gap-2 border-b border-border px-3 py-2.5">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: col.accent ?? 'hsl(var(--primary))' }}
            />
            <span className="text-sm font-semibold">{col.title}</span>
            <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground tabular-nums">
              {col.items.length}
            </span>
          </header>
          <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-2">
            {col.items.map((item) => (
              <div key={itemKey(item)}>{renderCard(item, col.id)}</div>
            ))}
          </div>
          {columnFooter ? (
            <footer className="border-t border-border p-2">{columnFooter(col.id)}</footer>
          ) : null}
        </section>
      ))}
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
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-md border border-border bg-card p-3 text-left shadow-sm transition-colors hover:border-primary/40"
    >
      <div className="text-sm font-medium">{title}</div>
      {meta ? <div className="mt-1 text-xs text-muted-foreground">{meta}</div> : null}
      {children ? <div className="mt-2">{children}</div> : null}
    </button>
  );
}
