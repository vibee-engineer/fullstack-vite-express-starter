import { useState, type ReactNode } from 'react';
import { Menu } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { AccountMenu } from './AccountMenu';
import { Brand } from './Brand';
import { SidebarNav } from './SidebarNav';
import { TopbarNavLinks } from './TopbarNavLinks';
import type { Account } from './account';

/**
 * TopbarNav — the horizontal top navigation bar for the 'topbar' archetype:
 * brand on the left, destinations centered, actions + account on the right. No
 * left rail. Below md the destinations collapse into the SAME SidebarNav
 * Sheet used by every other shell. Composed BY AppShell.
 */
export function TopbarNav({ actions, account }: { actions?: ReactNode; account?: Account }) {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-4 border-b border-border bg-background/80 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <Brand />

      <div className="hidden md:flex">
        <TopbarNavLinks />
      </div>

      <div className="ml-auto flex items-center gap-2">
        {actions}
        <ThemeToggle />
        <AccountMenu account={account ?? null} />

        {/* Mobile menu */}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="flex w-72 flex-col p-0">
            <SheetTitle className="flex h-14 items-center border-b border-border px-4">
              <Brand />
            </SheetTitle>
            <SidebarNav onNavigate={() => setOpen(false)} />
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
