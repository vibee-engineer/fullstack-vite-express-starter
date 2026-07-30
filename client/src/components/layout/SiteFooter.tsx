import { Link } from 'react-router-dom';

import { SITE, FOOTER_GROUPS } from '@/config/site';

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="container py-10 grid grid-cols-1 md:grid-cols-4 gap-8">
        <div className="md:col-span-1">
          <div className="font-heading font-semibold">{SITE.name}</div>
          <p className="mt-2 text-sm text-muted-foreground">{SITE.tagline}</p>
        </div>
        {FOOTER_GROUPS.map((group) => (
          <div key={group.heading}>
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {group.heading}
            </div>
            <ul className="mt-3 space-y-2 text-sm">
              {group.links.map((link) => (
                <li key={link.to}>
                  {link.external ? (
                    <a
                      href={link.to}
                      target="_blank"
                      rel="noreferrer"
                      className="text-foreground hover:text-primary transition-colors"
                    >
                      {link.label}
                    </a>
                  ) : (
                    <Link
                      to={link.to}
                      className="text-foreground hover:text-primary transition-colors"
                    >
                      {link.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-border">
        <div className="container py-4 text-xs text-muted-foreground flex items-center justify-between">
          <span>
            © {new Date().getFullYear()} {SITE.name}. All rights reserved.
          </span>
          <span>Built with founding.dev</span>
        </div>
      </div>
    </footer>
  );
}
