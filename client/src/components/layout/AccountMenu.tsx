import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { Account } from './account';

/**
 * AccountMenu — the account affordance: an avatar that, when given a `menu`,
 * opens a dropdown with the user's name/email and your menu items. Renders
 * nothing when no account is passed (an app with no auth shows no chip).
 */
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
