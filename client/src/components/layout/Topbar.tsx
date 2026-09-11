import { useState, type ReactNode } from 'react';
import { Menu } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { SITE } from '@/config/site';
import { AccountMenu } from './AccountMenu';
import { Brand } from './Brand';
import { SidebarNav } from './SidebarNav';
import type { Account } from './account';

/**
 * Topbar — the slim horizontal bar at the top of the 'sidebar' and 'canvas'
 * shells. Holds the current page title, cross-cutting actions, the account
 * affordance, and (below md, where the rail is hidden) a menu button that opens
 * the SAME SidebarNav in a Sheet — so mobile nav can never drift from desktop.
 */
export function Topbar({
  title,
  actions,
  account,
}: {
  title?: ReactNode;
  actions?: ReactNode;
  account?: Account;
}) {
  const [open, setOpen] = useState(false);

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      {/* Mobile: open the sidebar nav in a sheet */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="flex w-72 flex-col p-0">
          <SheetTitle className="flex h-14 items-center border-b border-border px-4">
            <Brand />
          </SheetTitle>
          <SidebarNav onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>

      {title ? (
        <h1 className="truncate text-base font-semibold tracking-tight">{title}</h1>
      ) : (
        <span className="truncate text-base font-semibold tracking-tight md:hidden">
          {SITE.name}
        </span>
      )}

      <div className="ml-auto flex items-center gap-2">
        {actions}
        <ThemeToggle />
        <AccountMenu account={account ?? null} />
      </div>
    </header>
  );
}
