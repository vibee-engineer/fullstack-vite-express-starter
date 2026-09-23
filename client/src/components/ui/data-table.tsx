import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ArrowUpDown, ChevronDown, ChevronUp, Search } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { EmptyState } from '@/components/ui/empty-state';

export type Column<T> = {
  /** unique key; also the object key used for default sort/search if no accessor */
  key?: string;
  /**
   * TanStack-style alias for `key`. Accepted so a column written as
   * `{ accessorKey: 'Referrer', header: 'Referrer' }` renders instead of
   * producing a table of blank cells — the single most repeated authoring
   * mistake against this component (three builds in one day, 2026-09-23).
   * Normalised into `key` on entry; `key` wins when both are given.
   */
  accessorKey?: string;
  header: ReactNode;
  /** cell renderer; defaults to String(row[key]) */
  render?: (row: T) => ReactNode;
  /** value used for sorting/searching; defaults to row[key] */
  accessor?: (row: T) => string | number;
  sortable?: boolean;
  className?: string;
  align?: 'left' | 'right' | 'center';
};

/**
 * DataTable — a light, dependency-free wrapper over the Table primitive with
 * client-side sort + search. For homogeneous records users scan / filter /
 * compare (the table-first archetype). Not a replacement for server-side
 * pagination on large datasets — swap `data` for a fetched page and disable
 * `searchable` when you do.
 */
export function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  searchable = true,
  searchKeys,
  onRowClick,
  rowKey,
  empty,
  className,
}: {
  columns: Array<Column<T>>;
  data: T[];
  searchable?: boolean;
  /** which columns to search; defaults to all columns */
  searchKeys?: string[];
  onRowClick?: (row: T) => void;
  rowKey: (row: T) => string;
  empty?: { title: string; description?: string };
  className?: string;
}) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(null);

  // Normalise once: `accessorKey` → `key`. Everything below reads `cols`.
  const cols = useMemo<Array<Column<T> & { key: string }>>(
    () =>
      columns.map((c) => ({
        ...c,
        key: c.key ?? c.accessorKey ?? '',
      })),
    [columns],
  );

  // Dev-only: a column whose key matches no field on the rows renders blank
  // cells while the header looks fine — the failure is invisible in the UI and
  // invisible to the type checker once `as any` is involved. Say it where the
  // pre-finish console scan will see it. Runs when columns or data change, not
  // on every render.
  useEffect(() => {
    if (!import.meta.env.DEV || data.length === 0) return;
    const sample = data[0] as Record<string, unknown>;
    const available = Object.keys(sample);
    for (const col of cols) {
      if (col.render || col.accessor) continue;
      if (!col.key) {
        console.error(
          '[DataTable] a column has neither `key` nor `accessorKey`; its cells will be blank.',
        );
        continue;
      }
      if (!(col.key in sample)) {
        console.error(
          `[DataTable] column key "${col.key}" matches no field on the rows — its cells will be blank. ` +
            `Available fields: ${available.map((k) => `"${k}"`).join(', ')}. ` +
            'Use the exact field name (row keys are case- and space-sensitive), or pass `render`/`accessor`.',
        );
      }
    }
  }, [cols, data]);

  const valueOf = (row: T, col?: Column<T>) => {
    if (col?.accessor) return col.accessor(row);
    const key = col?.key;
    return key ? (row[key] as string | number) : '';
  };

  const filtered = useMemo(() => {
    if (!searchable || !query.trim()) return data;
    const q = query.toLowerCase();
    const keys = searchKeys ?? cols.map((c) => c.key);
    return data.filter((row) =>
      keys.some((k) => {
        const col = cols.find((c) => c.key === k);
        return String(valueOf(row, col) ?? '')
          .toLowerCase()
          .includes(q);
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, query, searchable, searchKeys, columns]);

  const sorted = useMemo(() => {
    if (!sort) return filtered;
    const col = cols.find((c) => c.key === sort.key);
    const arr = [...filtered].sort((a, b) => {
      const av = valueOf(a, col);
      const bv = valueOf(b, col);
      if (av < bv) return sort.dir === 'asc' ? -1 : 1;
      if (av > bv) return sort.dir === 'asc' ? 1 : -1;
      return 0;
    });
    return arr;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, sort, columns]);

  const toggleSort = (key: string) =>
    setSort((s) =>
      s?.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' },
    );

  const alignClass = (a?: string) =>
    a === 'right' ? 'text-right' : a === 'center' ? 'text-center' : 'text-left';

  return (
    <div className={cn('space-y-3', className)}>
      {searchable ? (
        <div className="relative max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search…"
            className="pl-8"
          />
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              {cols.map((col) => (
                <TableHead key={col.key} className={cn(alignClass(col.align), col.className)}>
                  {col.sortable ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(col.key)}
                      className="inline-flex items-center gap-1 hover:text-foreground"
                    >
                      {col.header}
                      {sort?.key === col.key ? (
                        sort.dir === 'asc' ? (
                          <ChevronUp className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5" />
                        )
                      ) : (
                        <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />
                      )}
                    </button>
                  ) : (
                    col.header
                  )}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((row) => (
              <TableRow
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={onRowClick ? 'cursor-pointer' : undefined}
              >
                {cols.map((col) => (
                  <TableCell key={col.key} className={cn(alignClass(col.align), col.className)}>
                    {col.render ? col.render(row) : String(row[col.key] ?? '')}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {sorted.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title={empty?.title ?? 'Nothing here yet'}
              description={empty?.description ?? (query ? 'No rows match your search.' : undefined)}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
