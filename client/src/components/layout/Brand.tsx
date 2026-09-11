import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

import { SITE } from '@/config/site';
import { cn } from '@/lib/utils';

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
