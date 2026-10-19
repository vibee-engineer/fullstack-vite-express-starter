import { NavLink } from 'react-router-dom';

import { NAV_SECTIONS } from '@/config/site';
import { cn } from '@/lib/utils';
import { NavIcon } from './nav-icons';

/**
 * BottomDock — the destination bar of the 'dock' archetype: icon + label tabs
 * pinned to the bottom of the viewport, where a thumb reaches them. Phone-first
 * products (trackers, journals, personal finance, fitness) live here, the way
 * Strava, Streaks and Monzo do. On wide screens it floats as a centred pill
 * instead of stretching edge to edge.
 *
 * Reads the same NAV_SECTIONS as every other shell. Five destinations is the
 * comfortable maximum for a dock; more belong in a sidebar app.
 */
export function BottomDock() {
  const items = NAV_SECTIONS.flatMap((s) => s.items).filter((i) => !i.external).slice(0, 5);
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur supports-[backdrop-filter]:bg-background/75 md:inset-x-auto md:bottom-4 md:left-1/2 md:-translate-x-1/2 md:rounded-full md:border md:px-2 md:shadow-lg"
    >
      <ul className="mx-auto flex max-w-md items-stretch justify-around md:gap-1">
        {items.map((item) => (
          <li key={item.to} className="flex-1 md:flex-none">
            <NavLink
              to={item.to}
              end={item.end ?? item.to === '/'}
              className={({ isActive }) =>
                cn(
                  'flex min-h-14 flex-col items-center justify-center gap-0.5 px-3 text-[11px] font-medium transition-colors md:min-h-12 md:flex-row md:gap-2 md:rounded-full md:text-sm',
                  isActive ? 'text-primary-ink md:bg-accent' : 'text-muted-foreground hover:text-foreground',
                )
              }
            >
              <NavIcon name={item.icon} className="h-5 w-5" />
              <span>{item.label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
