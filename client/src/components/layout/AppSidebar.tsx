import { NavLink } from 'react-router-dom';
import {
  BarChart3,
  CalendarDays,
  ChevronsLeft,
  Folder,
  Home,
  Inbox,
  List,
  Settings,
  Star,
  Tag,
  Users,
  type LucideIcon,
} from 'lucide-react';

import { SITE, NAV_SECTIONS, type NavIcon } from '@/config/site';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * AppSidebar — the primary navigation rail for the authenticated app.
 *
 * Widths follow the shadcn/ui sidebar defaults so this stays interchangeable
 * with the upstream primitive if it is ever installed:
 *   expanded  16rem / 256px
 *   icon rail  3rem /  48px
 *   mobile sheet 18rem / 288px  (rendered by Topbar, not here)
 *
 * Nav content comes from NAV_SECTIONS in @/config/site — add routes there, not
 * here. Every signed-in route belongs in that list; a route with no nav entry
 * is unreachable and counts as a bug.
 */

const ICONS: Record<NavIcon, LucideIcon> = {
  home: Home,
  list: List,
  chart: BarChart3,
  users: Users,
  calendar: CalendarDays,
  settings: Settings,
  inbox: Inbox,
  folder: Folder,
  star: Star,
  tag: Tag,
};

export function AppSidebar({
  collapsed = false,
  onToggle,
  className,
}: {
  collapsed?: boolean;
  onToggle?: () => void;
  className?: string;
}) {
  return (
    <aside
      data-collapsed={collapsed || undefined}
      className={cn(
        // bg-muted/40, not bg-card: --card and --background are identical in this
        // token set (both 0 0% 100% light, 222.2 84% 4.9% dark), so a card-
        // surfaced rail is indistinguishable from the content area. muted
        // differs in both themes and survives regenerate_tokens.
        'flex h-full flex-col border-r border-border bg-muted/40 text-foreground',
        collapsed ? 'w-12' : 'w-64',
        'transition-[width] duration-200 ease-out motion-reduce:transition-none',
        className,
      )}
    >
      {/* Brand — 48px to match the topbar so the two align on the same baseline. */}
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-3">
        <div
          aria-hidden
          className="grid size-6 shrink-0 place-items-center rounded bg-primary text-[11px] font-semibold text-primary-foreground"
        >
          {SITE.name.slice(0, 1).toUpperCase()}
        </div>
        {!collapsed && (
          <span className="truncate text-sm font-semibold tracking-tight">{SITE.name}</span>
        )}
      </div>

      <nav aria-label="Main" className="flex-1 overflow-y-auto px-2 py-3">
        {NAV_SECTIONS.map((section, i) => (
          <div key={section.heading ?? `section-${i}`} className={cn(i > 0 && 'mt-5')}>
            {section.heading && !collapsed && (
              <div className="px-2 pb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                {section.heading}
              </div>
            )}
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = ICONS[item.icon] ?? Home;
                return (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.to === '/'}
                      title={collapsed ? item.label : undefined}
                      className={({ isActive }) =>
                        cn(
                          // 32px row: comfortable for a nav list, and clears the
                          // WCAG 2.2 SC 2.5.8 24px minimum target with margin.
                          'group flex h-8 items-center gap-2 rounded-md px-2 text-sm outline-none',
                          'focus-visible:ring-[3px] focus-visible:ring-ring/50',
                          'transition-colors motion-reduce:transition-none',
                          isActive
                            ? 'bg-accent font-medium text-accent-foreground'
                            : 'text-muted-foreground hover:bg-accent/60 hover:text-accent-foreground',
                          collapsed && 'justify-center px-0',
                        )
                      }
                    >
                      <Icon aria-hidden className="size-4 shrink-0" />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                      {!collapsed && item.badge != null && (
                        <span className="ml-auto text-xs tabular-nums text-muted-foreground">
                          {item.badge}
                        </span>
                      )}
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Collapse control lives at the bottom so it never competes with nav. */}
      {onToggle && (
        <div className="shrink-0 border-t border-border p-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onToggle}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className={cn('w-full justify-start gap-2 text-muted-foreground', collapsed && 'justify-center')}
          >
            <ChevronsLeft
              aria-hidden
              className={cn('size-4 transition-transform motion-reduce:transition-none', collapsed && 'rotate-180')}
            />
            {!collapsed && <span className="text-sm">Collapse</span>}
          </Button>
        </div>
      )}
    </aside>
  );
}
