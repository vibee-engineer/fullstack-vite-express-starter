import { NavLink } from 'react-router-dom';

import { NAV_SECTIONS } from '@/config/site';
import { cn } from '@/lib/utils';
import { NavIcon } from './nav-icons';

/**
 * SidebarNav — the vertical destination list with icons, optional section
 * headings and badge counts. Used by BOTH the desktop sidebar rail and the
 * mobile sheet, so the two can never drift. Reads NAV_SECTIONS from config.
 *
 * `onNavigate` fires after a link is chosen (e.g. to close the mobile sheet).
 */
export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="flex flex-1 flex-col gap-6 overflow-y-auto px-3 py-4">
      {NAV_SECTIONS.map((section, i) => (
        <div key={section.heading ?? i} className="flex flex-col gap-1">
          {section.heading ? (
            <div className="px-3 pb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
              {section.heading}
            </div>
          ) : null}
          {section.items.map((item) =>
            item.external ? (
              <a
                key={item.to}
                href={item.to}
                target="_blank"
                rel="noreferrer"
                onClick={onNavigate}
                className="group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <NavIcon name={item.icon} className="h-4 w-4 shrink-0" />
                <span className="flex-1 truncate">{item.label}</span>
              </a>
            ) : (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end ?? item.to === '/'}
                onClick={onNavigate}
                className={({ isActive }) =>
                  cn(
                    'group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )
                }
              >
                <NavIcon name={item.icon} className="h-4 w-4 shrink-0" />
                <span className="flex-1 truncate">{item.label}</span>
                {item.badge != null ? (
                  <span className="ml-auto rounded-full bg-muted px-1.5 py-0.5 text-xs tabular-nums text-muted-foreground group-hover:bg-background">
                    {item.badge}
                  </span>
                ) : null}
              </NavLink>
            ),
          )}
        </div>
      ))}
    </nav>
  );
}
