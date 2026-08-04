/**
 * overlay-and-table-craft.test.tsx
 *
 * The token ladder reached Card, Button, Input and StatCard and stopped there.
 * Two consequences the craft-tokens tests could not see:
 *
 *   OVERLAYS — dropdown, popover, select, dialog, alert-dialog and sheet all
 *   used Tailwind's generic `shadow-md` / `shadow-lg`. Those are built on
 *   rgb(0 0 0 / 0.1), and a black shadow on a dark surface is invisible: shadow
 *   is occlusion, and on a dark page there is little light left to occlude. So
 *   in dark mode every menu and modal lost its edge and floated with no
 *   separation from the page. The elevation ladder already ships per-theme
 *   values for exactly this (measured: --elevation-menu alpha .08 light vs .4
 *   dark) and nothing consumed them.
 *
 *   TABLES — a dashboard is mostly table, and this one had no row spec: 36px
 *   rows (p-2 + text-sm), no numeric alignment, no tabular figures. Carbon
 *   ships 32/40/48 for sm/md/lg and Material 3's standard data row is 52px.
 *
 * These assert the WIRING. The rendered result is verified separately: all four
 * shadow-[shadow:var(--elevation-*)] utilities compile to real box-shadow rules
 * in the built CSS, and both theme blocks define menu/modal.
 */
import { render } from '@testing-library/react';
import { describe, expect, test } from 'vitest';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../table';

describe('overlays consume the elevation ladder, not generic shadows', () => {
  // Source-level assertion: these are Radix primitives whose class strings live
  // in the module, and rendering them standalone requires a provider. Reading
  // the module text is the honest way to assert the wiring without a portal.
  const read = (f: string) =>
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    require('fs').readFileSync(
      require('path').join(__dirname, '..', f),
      'utf8',
    ) as string;

  const MENU_LAYER = ['dropdown-menu.tsx', 'popover.tsx', 'select.tsx'];
  const MODAL_LAYER = ['dialog.tsx', 'alert-dialog.tsx', 'sheet.tsx'];

  test.each(MENU_LAYER)('%s uses --elevation-menu', (file) => {
    expect(read(file)).toContain('shadow-[shadow:var(--elevation-menu)]');
  });

  test.each(MODAL_LAYER)('%s uses --elevation-modal', (file) => {
    // Modals sit above menus, so they take the deeper step — 16px blur at .13
    // light / .5 dark, against the menu layer's 4px.
    expect(read(file)).toContain('shadow-[shadow:var(--elevation-modal)]');
  });

  test.each([...MENU_LAYER, ...MODAL_LAYER])('%s has no generic Tailwind shadow left', (file) => {
    // shadow-md/lg/sm/xl are the ones with a hardcoded black alpha. A single
    // survivor puts one overlay back on an invisible dark-mode shadow.
    expect(read(file)).not.toMatch(/(?<![\w-])shadow-(sm|md|lg|xl|2xl)(?![\w-])/);
  });

  test('the shadow: type hint is present on every elevation utility', () => {
    // Without the hint Tailwind cannot tell a box-shadow from a shadow COLOUR
    // and emits no rule at all. This shipped broken three times; the compiled
    // CSS is the only proof, and this is the guard against regressing the hint.
    for (const file of [...MENU_LAYER, ...MODAL_LAYER]) {
      const src = read(file);
      const bare = src.match(/shadow-\[var\(--elevation-/g) || [];
      expect(bare).toHaveLength(0);
    }
  });
});

describe('Table row spec', () => {
  const renderTable = (numeric = false) =>
    render(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead numeric={numeric}>Amount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell numeric={numeric}>1234.50</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );

  test('body cells are padded for a ~48px row, not a 36px spreadsheet row', () => {
    const { container } = renderTable();
    const td = container.querySelector('td')!;
    expect(td.getAttribute('class')).toContain('py-3');
    expect(td.getAttribute('class')).toContain('px-3');
    expect(td.getAttribute('class')).not.toMatch(/(?<![\w-])p-2(?![\w-])/);
  });

  test('header rows are 44px and read as labels, not data', () => {
    const { container } = renderTable();
    const th = container.querySelector('th')!.getAttribute('class')!;
    expect(th).toContain('h-11');
    expect(th).toContain('uppercase');
    expect(th).toContain('text-muted-foreground');
  });

  test('numeric cells get tabular figures AND right alignment', () => {
    // Both, not either. Proportional digits have different widths so a column
    // cannot be compared down the page; right alignment puts the ones place
    // under the ones place so magnitude is scannable.
    const { container } = renderTable(true);
    const td = container.querySelector('td')!.getAttribute('class')!;
    expect(td).toContain('tabular-nums');
    expect(td).toContain('text-right');
    const th = container.querySelector('th')!.getAttribute('class')!;
    expect(th).toContain('text-right');
  });

  test('non-numeric cells stay left-aligned with proportional digits', () => {
    // The default must not change: forcing tabular figures on prose makes it
    // look like a terminal.
    const { container } = renderTable(false);
    const td = container.querySelector('td')!.getAttribute('class')!;
    expect(td).not.toContain('tabular-nums');
    expect(td).not.toContain('text-right');
  });

  test('the header block carries a surface step, not only a hairline', () => {
    // Once every row has a hairline, one more hairline does not separate the
    // header. A surface does, and it survives scrolling.
    const { container } = renderTable();
    expect(container.querySelector('thead')!.getAttribute('class')).toContain('bg-muted/40');
  });

  test('caller classes still win', () => {
    const { container } = render(
      <Table>
        <TableBody>
          <TableRow>
            <TableCell className="custom-cell">x</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );
    expect(container.querySelector('td')!.getAttribute('class')).toContain('custom-cell');
  });
});
