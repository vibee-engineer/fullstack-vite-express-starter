import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

/**
 * ListDetail — a list beside the selected record.
 *
 * WHY THIS IS A PAGE SHAPE, NOT AN ARCHETYPE
 * ==========================================
 * List-detail is the shape most CRUD apps actually want: an inbox, a CRM, an
 * issue tracker, a candidate pipeline, a reservations list. Apple treats it as a
 * distinct navigation structure and tells you to reach for it once hierarchy
 * exceeds two levels ("use a split view interface that includes a content list
 * between the sidebar items and detail view"), and Material names it a canonical
 * layout.
 *
 * It is deliberately NOT one of AppShell's archetypes, because it is not
 * mutually exclusive with them: an app can have a sidebar AND a list-detail
 * page, exactly as Figma has both a rail and a canvas. Modelling it as a fifth
 * shell would force a false choice. It composes inside any archetype instead.
 *
 * RESPONSIVE BEHAVIOUR
 * ====================
 * Below md there is not room for both panes, so only one shows: the list when
 * nothing is selected, the detail when something is. That is why `selected` is
 * required rather than inferred — the parent owns selection (usually a route
 * param), and this component only needs to know whether a record is open.
 *
 * Scrolling is per-pane, not per-page: each side gets its own scroll container
 * so a long list does not drag the detail view off screen. Atlassian documents
 * the same posture for main ("it will have its own scroll container and not use
 * the body scroll").
 */
export function ListDetail({
  list,
  detail,
  selected,
  listWidth = 'md',
  className,
}: {
  /** The list pane. Owns its own scrolling. */
  list: ReactNode;
  /** The detail pane for the selected record, or an empty state when none is. */
  detail: ReactNode;
  /**
   * Whether a record is currently open. Drives which pane shows on mobile,
   * where there is only room for one.
   */
  selected: boolean;
  /**
   * List pane width on desktop. `sm` for a terse list (names, subjects), `md`
   * for rows carrying secondary metadata, `lg` when the list is the primary
   * surface and the detail is a preview.
   */
  listWidth?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const listWidthClass =
    listWidth === 'sm' ? 'md:w-64' : listWidth === 'lg' ? 'md:w-[28rem]' : 'md:w-80';

  return (
    <div className={cn('flex h-full min-h-0 gap-0', className)}>
      <div
        className={cn(
          // Fixed-width pane on desktop; full width on mobile when nothing is
          // selected. `shrink-0` keeps a long record from squeezing the list.
          'min-h-0 shrink-0 overflow-y-auto border-r border-border',
          listWidthClass,
          selected ? 'hidden md:block' : 'w-full md:block',
        )}
      >
        {list}
      </div>

      <div
        className={cn(
          'min-h-0 min-w-0 flex-1 overflow-y-auto',
          // Mirror image: on mobile the detail replaces the list rather than
          // stacking under it, which would bury the record below a long list.
          selected ? 'block' : 'hidden md:block',
        )}
      >
        {detail}
      </div>
    </div>
  );
}
