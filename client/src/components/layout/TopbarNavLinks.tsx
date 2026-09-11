import { NavLink } from 'react-router-dom';

import { NAV_SECTIONS } from '@/config/site';
import { cn } from '@/lib/utils';

/**
 * TopbarNavLinks — horizontal destination links for the 'topbar' archetype.
 * Flattens NAV_SECTIONS (headings are a sidebar affordance). Reads the same
 * NAV_SECTIONS as SidebarNav, so nav can never drift between shells.
 */
export function TopbarNavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const items = NAV_SECTIONS.flatMap((s) => s.items);
  return (
    <nav className="flex items-center gap-1">
      {items.map((item) =>
        item.external ? (
          <a
            key={item.to}
            href={item.to}
            target="_blank"
            rel="noreferrer"
            onClick={onNavigate}
            className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            {item.label}
          </a>
        ) : (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end ?? item.to === '/'}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
              )
            }
          >
            {item.label}
          </NavLink>
        ),
      )}
    </nav>
  );
}
