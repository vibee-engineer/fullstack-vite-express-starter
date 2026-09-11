import type { CSSProperties, ReactNode } from 'react';

import { cn } from '@/lib/utils';

/**
 * ListDetail — a list pane beside the selected record, for inboxes, CRMs,
 * trackers and pipelines. It is NOT a fifth shell: it composes INSIDE whichever
 * AppShell archetype you picked. Each pane owns its own scrolling, so a long
 * list can never drag the record off screen.
 *
 * Below md there is only room for one pane: `selected` drives which shows. Pass
 * `selected={true}` when a record is open (show the detail, with a back
 * affordance you render in `detail`), `false` to show the list.
 *
 * Props:
 *   list       the master list pane
 *   detail     the detail / reading pane
 *   selected   is a record open? (drives the mobile single-pane view)
 *   listWidth  width of the list pane on desktop (default 20rem)
 */
export function ListDetail({
  list,
  detail,
  selected = false,
  listWidth = '20rem',
}: {
  list: ReactNode;
  detail: ReactNode;
  selected?: boolean;
  listWidth?: string;
}) {
  return (
    <div className="flex h-full min-h-0 w-full">
      <div
        className={cn(
          'min-h-0 shrink-0 overflow-y-auto border-r border-border',
          // mobile: full width when no record open, hidden when one is
          selected ? 'hidden md:block' : 'w-full',
          // desktop always shows the list at its fixed width
          'md:w-[var(--list-w)]',
        )}
        style={{ '--list-w': listWidth } as CSSProperties}
      >
        {list}
      </div>
      <div
        className={cn('min-h-0 flex-1 overflow-y-auto', selected ? 'block' : 'hidden md:block')}
      >
        {detail}
      </div>
    </div>
  );
}
