import { Link, NavLink } from 'react-router-dom';
import { Menu } from 'lucide-react';

import { SITE, NAV, NAV_CTA } from '@/config/site';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { cn } from '@/lib/utils';

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center justify-between">
        <Link to="/" className="flex items-center gap-2 font-heading font-semibold">
          {SITE.name}
        </Link>

        <nav className="hidden md:flex items-center gap-6 text-sm">
          {NAV.map((link) =>
            link.external ? (
              <a
                key={link.to}
                href={link.to}
                target="_blank"
                rel="noreferrer"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {link.label}
              </a>
            ) : (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  cn(
                    'transition-colors hover:text-foreground',
                    isActive ? 'text-foreground' : 'text-muted-foreground',
                  )
                }
              >
                {link.label}
              </NavLink>
            ),
          )}
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          {NAV_CTA ? (
            <Button asChild size="sm" className="hidden md:inline-flex">
              <Link to={NAV_CTA.to}>{NAV_CTA.label}</Link>
            </Button>
          ) : null}

          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
              <SheetTitle className="mb-6">{SITE.name}</SheetTitle>
              <nav className="flex flex-col gap-4 text-sm">
                {NAV.map((link) => (
                  <Link
                    key={link.to}
                    to={link.to}
                    className="text-foreground hover:text-primary transition-colors"
                  >
                    {link.label}
                  </Link>
                ))}
                {NAV_CTA ? (
                  <Button asChild className="mt-2">
                    <Link to={NAV_CTA.to}>{NAV_CTA.label}</Link>
                  </Button>
                ) : null}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
