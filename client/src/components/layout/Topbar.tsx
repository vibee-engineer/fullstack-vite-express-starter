import { useState, type ReactNode } from 'react';
import { Menu } from 'lucide-react';

import { AppSidebar } from './AppSidebar';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet';
import { ThemeToggle } from '@/components/ui/theme-toggle';

/**
 * Topbar — 48px application header.
 *
 * Height matches the sidebar brand block so the two align on one baseline.
 * Holds ONLY global chrome: the mobile nav trigger, a page-title slot, theme
 * toggle, and the account affordance. Page-level actions ("New invoice",
 * "Export") belong on the page, next to the thing they act on — not up here.
 *
 * `actions` is the slot for a page's own primary action if it genuinely needs
 * to sit in the header (rare). `title` renders the current page name on mobile
 * where the sidebar is hidden.
 */
export function Topbar({
  title,
  actions,
  account,
}: {
  title?: ReactNode;
  actions?: ReactNode;
  /** Account menu / avatar. Supply once auth exists. */
  account?: ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border bg-background px-4 lg:px-6">
      {/* Mobile: sidebar becomes an 18rem/288px sheet — the shadcn default. */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="md:hidden"
            aria-label="Open navigation"
          >
            <Menu aria-hidden className="size-4" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-72 p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          {/* Same component, same NAV_SECTIONS — mobile nav parity is not
              optional. A mobile drawer with fewer links than the desktop rail
              is a shipped bug. */}
          <AppSidebar className="w-full border-r-0" />
        </SheetContent>
      </Sheet>

      {title && <div className="truncate text-sm font-medium md:hidden">{title}</div>}

      <div className="ml-auto flex items-center gap-1">
        {actions}
        <ThemeToggle />
        {account}
      </div>
    </header>
  );
}
