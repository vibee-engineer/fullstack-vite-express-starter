import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Inbox } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * EmptyState — first-class primitive. Agents forget to render a state when
 * a list is empty; standardizing it here keeps generated UIs from showing
 * a blank void when the DB returns [].
 *
 * `action` is REQUIRED, deliberately. Nielsen Norman Group's empty-state
 * guidance names three jobs: state the status, explain what would appear here
 * and how to populate it, and give a pathway to do it. A generated habit
 * tracker shipped an empty dashboard reading "No habits yet / Create your first
 * habit to start tracking your progress" with NO button anywhere on the page —
 * the copy told the user to act and the UI gave them nothing to click. The
 * create form existed, on another route, undiscoverable from there.
 *
 * Prose in the rules did not prevent that. A required prop does: omitting it is
 * now a typecheck failure, which the build gate catches before the preview is
 * ever shown.
 *
 * For a search/filter "no results" state the action is "Clear filters", not a
 * create button. There is always an action; if you genuinely cannot name one,
 * the region probably should not be rendered at all.
 */
export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  /** REQUIRED — the pathway out of the empty state. See the note above. */
  action: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/30 py-12 px-6 text-center',
        className,
      )}
    >
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Icon className="h-6 w-6" />
      </div>
      <div className="font-heading text-base font-semibold">{title}</div>
      {description ? (
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      ) : null}
      <div className="mt-4">{action}</div>
    </div>
  );
}
