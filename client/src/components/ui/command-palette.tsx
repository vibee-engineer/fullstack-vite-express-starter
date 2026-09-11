import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { NAV_SECTIONS } from '@/config/site';
import { NavIcon } from '@/components/layout/nav-icons';

export type Command = {
  id: string;
  label: string;
  hint?: string;
  icon?: string;
  /** kebab keywords to widen matching */
  keywords?: string;
  run: () => void;
};

/**
 * CommandPalette — a ⌘K / Ctrl-K overlay to search-and-act. An ACCELERATOR
 * layered on visible nav for power users, never the only navigation (hiding
 * nav halves discoverability). By default it lists every NAV_SECTIONS
 * destination; pass extra `commands` for actions ("New deal", "Invite member").
 *
 * Mount once, high in the tree (e.g. beside AppShell). Opens on ⌘K/Ctrl-K, or
 * control it with `open`/`onOpenChange`.
 */
export function CommandPalette({
  commands = [],
  includeNav = true,
  placeholder = 'Type a command or search…',
  open: controlledOpen,
  onOpenChange,
}: {
  commands?: Command[];
  includeNav?: boolean;
  placeholder?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const [uncontrolled, setUncontrolled] = useState(false);
  const open = controlledOpen ?? uncontrolled;
  const setOpen = (v: boolean) => {
    onOpenChange?.(v);
    if (controlledOpen === undefined) setUncontrolled(v);
  };

  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  // Global ⌘K / Ctrl-K
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(!open);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const all = useMemo<Command[]>(() => {
    const navCmds: Command[] = includeNav
      ? NAV_SECTIONS.flatMap((s) =>
          s.items
            .filter((i) => !i.external)
            .map((i) => ({
              id: `nav:${i.to}`,
              label: i.label,
              hint: s.heading,
              icon: i.icon,
              run: () => navigate(i.to),
            })),
        )
      : [];
    return [...navCmds, ...commands];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commands, includeNav]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all.filter((c) =>
      `${c.label} ${c.hint ?? ''} ${c.keywords ?? ''}`.toLowerCase().includes(q),
    );
  }, [all, query]);

  useEffect(() => setActive(0), [query, open]);

  const runAt = (i: number) => {
    const cmd = results[i];
    if (!cmd) return;
    setOpen(false);
    setQuery('');
    cmd.run();
  };

  const onListKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      runAt(active);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-lg [&>button]:hidden">
        <DialogTitle className="sr-only">Command palette</DialogTitle>
        <div className="flex items-center gap-2 border-b border-border px-3">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onListKey}
            placeholder={placeholder}
            className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            aria-label="Command"
          />
        </div>
        <div ref={listRef} className="max-h-80 overflow-y-auto p-2">
          {results.length === 0 ? (
            <div className="px-3 py-6 text-center text-sm text-muted-foreground">No results</div>
          ) : (
            results.map((cmd, i) => (
              <button
                key={cmd.id}
                type="button"
                onMouseEnter={() => setActive(i)}
                onClick={() => runAt(i)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm',
                  i === active ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-muted',
                )}
              >
                <NavIcon name={cmd.icon} className="h-4 w-4 shrink-0 opacity-80" />
                <span className="flex-1 truncate">{cmd.label}</span>
                {cmd.hint ? (
                  <span className="text-xs text-muted-foreground">{cmd.hint}</span>
                ) : null}
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** A small "⌘K" trigger button you can drop into a topbar's actions slot. */
export function CommandPaletteTrigger({ onClick }: { onClick: () => void }): ReactNode {
  return (
    <button
      type="button"
      onClick={onClick}
      className="hidden items-center gap-2 rounded-md border border-border bg-muted/40 px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted md:inline-flex"
    >
      <Search className="h-3.5 w-3.5" />
      <span>Search</span>
      <kbd className="rounded border border-border bg-background px-1 font-mono text-[10px]">⌘K</kbd>
    </button>
  );
}
