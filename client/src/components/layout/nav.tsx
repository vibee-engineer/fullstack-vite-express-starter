import type { ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';

import { NAV_SECTIONS, SITE } from '@/config/site';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { NavIcon } from './nav-icons';

/**
 * nav.tsx — the nav primitives every shell composes from. SidebarNav (vertical)
 * and TopbarNavLinks (horizontal) BOTH read NAV_SECTIONS, so desktop, mobile
 * and topbar nav can never drift out of sync.
 */

/** The signed-in user shown in the account affordance. `null` hides it. */
export type Account = {
  name: string;
  email?: string;
  avatarUrl?: string;
  /** Menu contents (sign out, settings…). Rendered inside a dropdown. */
  menu?: ReactNode;
} | null;

/** Brand wordmark — links home. `icon` is an optional leading mark. */
export function Brand({ className, icon }: { className?: string; icon?: ReactNode }) {
  return (
    <Link
      to="/"
      className={cn('flex items-center gap-2 font-heading font-semibold tracking-tight', className)}
    >
      {icon}
      <span className="truncate">{SITE.name}</span>
    </Link>
  );
}

/** Vertical destination list with icons + optional section headings. Used by
 *  the desktop sidebar rail AND the mobile sheet. */
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
                <span className="truncate">{item.label}</span>
              </a>
            ) : (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
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
                <span className="truncate">{item.label}</span>
              </NavLink>
            ),
          )}
        </div>
      ))}
    </nav>
  );
}

/** Horizontal destination links for the topbar archetype. Flattens sections. */
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
            end={item.end}
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

/** Account affordance — avatar + optional dropdown menu. Renders nothing when
 *  no account is passed (an app with no auth shows no account chip). */
export function AccountMenu({ account }: { account: Account }) {
  if (!account) return null;
  const initials = account.name
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const trigger = (
    <button
      type="button"
      className="flex items-center gap-2 rounded-full outline-none ring-ring focus-visible:ring-2"
      aria-label="Account"
    >
      <Avatar className="h-8 w-8">
        {account.avatarUrl ? <AvatarImage src={account.avatarUrl} alt={account.name} /> : null}
        <AvatarFallback className="text-xs">{initials || '?'}</AvatarFallback>
      </Avatar>
    </button>
  );

  if (!account.menu) return trigger;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <div className="px-2 py-1.5">
          <div className="text-sm font-medium">{account.name}</div>
          {account.email ? (
            <div className="truncate text-xs text-muted-foreground">{account.email}</div>
          ) : null}
        </div>
        {account.menu}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
