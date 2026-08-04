import * as React from 'react';
import { cn } from '@/lib/utils';

const Table = React.forwardRef<HTMLTableElement, React.HTMLAttributes<HTMLTableElement>>(
  ({ className, ...props }, ref) => (
    <div className="relative w-full overflow-auto">
      <table ref={ref} className={cn('w-full caption-bottom text-sm', className)} {...props} />
    </div>
  ),
);
Table.displayName = 'Table';

const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead
    ref={ref}
    // A hairline alone does not separate the header from the first row once the
    // rows also have hairlines. A surface step does, and it survives scrolling.
    className={cn('[&_tr]:border-b bg-muted/40', className)}
    {...props}
  />
));
TableHeader.displayName = 'TableHeader';

const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody ref={ref} className={cn('[&_tr:last-child]:border-0', className)} {...props} />
));
TableBody.displayName = 'TableBody';

const TableFooter = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tfoot
    ref={ref}
    className={cn('border-t bg-muted/50 font-medium [&>tr]:last:border-b-0', className)}
    {...props}
  />
));
TableFooter.displayName = 'TableFooter';

const TableRow = React.forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(
  ({ className, ...props }, ref) => (
    <tr
      ref={ref}
      className={cn(
        'border-b border-border transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted',
        className,
      )}
      {...props}
    />
  ),
);
TableRow.displayName = 'TableRow';

/**
 * Cells opt into numeric presentation with `numeric`, rather than each app
 * hand-writing `text-right tabular-nums` on every money and count column — the
 * kind of detail that gets applied to three columns out of five and reads as
 * sloppy.
 */
type NumericCellProps = { numeric?: boolean };

const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement> & NumericCellProps
>(({ className, numeric, ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      // 44px header against 48px body rows. Carbon ships 32/40/48 for
      // sm/md/lg tables and Material 3's standard data row is 52px; the dense
      // 36px this used to render (p-2 + text-sm) is a spreadsheet, not a
      // dashboard, and it is the main reason generated tables read as cramped.
      'h-11 px-3 text-left align-middle',
      // Headers are labels, not data: smaller, tracked out, and muted so the
      // ROW content is what the eye lands on first.
      'text-xs font-medium uppercase tracking-[0.04em] text-muted-foreground',
      'whitespace-nowrap',
      numeric && 'text-right',
      className,
    )}
    {...props}
  />
));
TableHead.displayName = 'TableHead';

const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement> & NumericCellProps
>(({ className, numeric, ...props }, ref) => (
  <td
    ref={ref}
    className={cn(
      'px-3 py-3 align-middle',
      // Numeric columns get tabular figures and right alignment. Proportional
      // digits are different widths, so a column of them cannot be compared
      // down the page — the digits do not line up. Right alignment puts the
      // ones place under the ones place, which is what makes magnitudes
      // scannable at a glance. Geist calls for tabular figures whenever you
      // are conveying numbers; StatCard already does this for its value.
      numeric && 'text-right tabular-nums',
      className,
    )}
    {...props}
  />
));
TableCell.displayName = 'TableCell';

const TableCaption = React.forwardRef<
  HTMLTableCaptionElement,
  React.HTMLAttributes<HTMLTableCaptionElement>
>(({ className, ...props }, ref) => (
  <caption ref={ref} className={cn('mt-4 text-sm text-muted-foreground', className)} {...props} />
));
TableCaption.displayName = 'TableCaption';

export { Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell, TableCaption };
