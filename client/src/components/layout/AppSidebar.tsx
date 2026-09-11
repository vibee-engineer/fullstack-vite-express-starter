import type { ReactNode } from 'react';

import { AccountMenu, Brand, SidebarNav, type Account } from './nav';

/**
 * AppSidebar — the persistent left rail for the 'sidebar' archetype. Hidden
 * below md (where Topbar's Sheet takes over). Brand at top, SidebarNav in the
 * middle, account pinned to the bottom. Composed BY AppShell; you do not mount
 * it directly — edit NAV_SECTIONS in @/config/site to change what it contains.
 */
export function AppSidebar({ account, footer }: { account?: Account; footer?: ReactNode }) {
  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-muted/30 md:flex">
      <div className="flex h-14 shrink-0 items-center border-b border-border px-5">
        <Brand />
      </div>
      <SidebarNav />
      {account || footer ? (
        <div className="mt-auto flex items-center gap-3 border-t border-border px-4 py-3">
          <AccountMenu account={account ?? null} />
          {account ? (
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{account.name}</div>
              {account.email ? (
                <div className="truncate text-xs text-muted-foreground">{account.email}</div>
              ) : null}
            </div>
          ) : null}
          {footer}
        </div>
      ) : null}
    </aside>
  );
}
