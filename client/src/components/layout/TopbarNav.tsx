import { NavLink } from 'react-router-dom';

import { NAV_SECTIONS } from '@/config/site';
import { cn } from '@/lib/utils';

/**
 * TopbarNav — horizontal navigation for the `topbar` archetype.
 *
 * Reads the SAME NAV_SECTIONS as AppSidebar, flattened. One nav source, so a
 * destination can never exist in one shell and be missing from the other, and
 * switching LAYOUT never silently drops a route.
 *
 * Hidden below md: at mobile width these tabs would wrap or overflow, and the
 * Topbar's drawer (which AppShell keeps visible at all widths for this
 * archetype) is the correct affordance there. That drawer renders AppSidebar,
 * which reads the same NAV_SECTIONS, so mobile parity holds by construction.
 *
 * Section labels are deliberately dropped here. Grouping is what justifies a
 * rail in the first place; if an app has enough destinations to need labelled
 * groups, it should be using the `sidebar` archetype instead of cramming
 * groups into a horizontal strip.
 */
export function TopbarNav({ className }: { className?: string }) {
  const items = NAV_SECTIONS.flatMap((section) => section.items);
  if (items.length === 0) return null;

  return (
    <nav aria-label="Main" className={cn('hidden md:flex md:items-center md:gap-1', className)}>
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === '/'}
          className={({ isActive }) =>
            cn(
              // h-8 keeps the control inside the 48px bar with room to breathe,
              // and clears the 24x24 WCAG 2.2 SC 2.5.8 (AA) minimum target.
              'inline-flex h-8 items-center rounded-md px-3 text-sm transition-colors',
              'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
              isActive
                ? 'bg-muted font-medium text-foreground'
                : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
            )
          }
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}
