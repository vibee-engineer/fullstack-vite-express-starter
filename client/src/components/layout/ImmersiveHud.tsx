import { useState, type ReactNode } from 'react';
import { Menu } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { AccountMenu } from './AccountMenu';
import { Brand } from './Brand';
import { SidebarNav } from './SidebarNav';
import type { Account } from './account';

/**
 * ImmersiveHud — the only chrome of the 'immersive' archetype: a transparent
 * strip floating over the full-viewport scene, brand top-left, the page's own
 * HUD actions + menu top-right. No rail, no bar, no border, no search, no bell.
 * Destinations live in a Sheet so the scene keeps the whole viewport.
 *
 * The strip itself ignores the pointer (pointer-events-none) so clicks and
 * drags fall through to the scene; only its controls take input.
 */
export function ImmersiveHud({ actions, account }: { actions?: ReactNode; account?: Account }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-40 flex items-center gap-3 p-3 md:p-4">
      <Brand className="pointer-events-auto rounded-md px-2 py-1 text-sm drop-shadow" />
      <div className="pointer-events-auto ml-auto flex items-center gap-2">
        {actions}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="secondary" size="icon" aria-label="Open menu">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="flex w-72 flex-col p-0">
            <SheetTitle className="flex h-14 items-center border-b border-border px-4">
              <Brand />
            </SheetTitle>
            <SidebarNav onNavigate={() => setOpen(false)} />
            <div className="mt-auto flex items-center justify-between border-t border-border p-3">
              <AccountMenu account={account ?? null} />
              <ThemeToggle />
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}
