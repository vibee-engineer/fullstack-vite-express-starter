/**
 * audit.test.tsx — reproductions for defects found in the starter's components.
 * Each test asserts the CORRECT behaviour; red means the defect is present.
 */
import { fireEvent, render, screen, within, act } from '@testing-library/react';
import { useForm } from 'react-hook-form';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DataTable, type Column } from '@/components/ui/data-table';
import { KanbanCard } from '@/components/ui/kanban-board';
import { Form, FormField, FormItem, FormControl, FormMessage } from '@/components/ui/form';
import { AlertSummary } from '@/components/ui/alert-summary';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Topbar } from '@/components/layout/Topbar';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { CommandPalette } from '@/components/ui/command-palette';
import { toast } from 'sonner';
import { Toaster } from '@/components/ui/toaster';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { AppShell } from '@/components/layout/AppShell';

afterEach(() => {
  vi.restoreAllMocks();
  document.documentElement.classList.remove('dark');
  localStorage.clear();
});

type Row = { id: string; name: string; due?: number };
const cols: Column<Row>[] = [
  { key: 'name', header: 'Name', sortable: true },
  { key: 'due', header: 'Due', sortable: true },
];
const names = () =>
  screen
    .getAllByRole('row')
    .slice(1)
    .map((r) => within(r).getAllByRole('cell')[0]!.textContent);

describe('DataTable', () => {
  it('sorts a column that has missing (undefined) values', () => {
    const data: Row[] = [
      { id: '1', name: 'c', due: 3 },
      { id: '2', name: 'x' },
      { id: '3', name: 'a', due: 1 },
      { id: '4', name: 'y' },
      { id: '5', name: 'b', due: 2 },
    ];
    render(<DataTable columns={cols} data={data} rowKey={(r) => r.id} searchable={false} />);
    fireEvent.click(screen.getByRole('button', { name: /Due/ }));
    // defined values ascending, missing values last
    expect(names().slice(0, 3)).toEqual(['a', 'b', 'c']);
  });

  it('sorts strings case-insensitively', () => {
    const data: Row[] = [
      { id: '1', name: 'banana' },
      { id: '2', name: 'Cherry' },
      { id: '3', name: 'apple' },
    ];
    render(<DataTable columns={cols} data={data} rowKey={(r) => r.id} searchable={false} />);
    fireEvent.click(screen.getByRole('button', { name: /Name/ }));
    expect(names()).toEqual(['apple', 'banana', 'Cherry']);
  });

  it('exposes sort state via aria-sort', () => {
    render(
      <DataTable
        columns={cols}
        data={[{ id: '1', name: 'a' }]}
        rowKey={(r) => r.id}
        searchable={false}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Name/ }));
    expect(screen.getAllByRole('columnheader')[0]).toHaveAttribute('aria-sort', 'ascending');
  });

  it('lets a keyboard user open a clickable row', () => {
    const onRowClick = vi.fn();
    render(
      <DataTable
        columns={cols}
        data={[{ id: '1', name: 'a' }]}
        rowKey={(r) => r.id}
        onRowClick={onRowClick}
      />,
    );
    const row = screen.getAllByRole('row')[1]!;
    expect(row).toHaveAttribute('tabindex', '0');
    fireEvent.keyDown(row, { key: 'Enter' });
    expect(onRowClick).toHaveBeenCalledTimes(1);
  });
});

describe('KanbanCard', () => {
  it('activates on Enter / Space like the button it claims to be', () => {
    const onClick = vi.fn();
    render(<KanbanCard title="Deal" onClick={onClick} />);
    const card = screen.getByRole('button', { name: /Deal/ });
    fireEvent.keyDown(card, { key: 'Enter' });
    fireEvent.keyDown(card, { key: ' ' });
    expect(onClick).toHaveBeenCalledTimes(2);
  });
});

function MsgForm() {
  const form = useForm<{ email: string }>({ defaultValues: { email: '' } });
  return (
    <Form {...form}>
      <button type="button" onClick={() => form.setError('email', { type: 'server' })}>
        fail
      </button>
      <FormField
        control={form.control}
        name="email"
        render={({ field }) => (
          <FormItem>
            <FormControl>
              <input {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </Form>
  );
}

describe('FormMessage', () => {
  it('never renders the literal string "undefined"', async () => {
    render(<MsgForm />);
    await act(async () => fireEvent.click(screen.getByText('fail')));
    expect(screen.queryByText('undefined')).not.toBeInTheDocument();
  });
});

describe('AlertSummary', () => {
  it('does not render dead href="#" links for alerts without an href', () => {
    const { container } = render(
      <AlertSummary
        alerts={[{ id: 'b', title: 'Billing failed', level: 'critical', blocking: true }]}
      />,
    );
    expect(container.querySelector('a[href="#"]')).toBeNull();
  });
});

describe('Tooltip', () => {
  it('renders without the app having to mount a TooltipProvider', () => {
    expect(() =>
      render(
        <Tooltip>
          <TooltipTrigger>hi</TooltipTrigger>
          <TooltipContent>tip</TooltipContent>
        </Tooltip>,
      ),
    ).not.toThrow();
  });
});

describe('Dialog-based overlays', () => {
  it('mobile nav sheet opens without a Radix a11y warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(
      <MemoryRouter>
        <Topbar />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    const msgs = warn.mock.calls.map((c) => String(c[0]));
    expect(msgs.filter((m) => m.includes('Description'))).toEqual([]);
  });

  it('command palette opens without a Radix a11y warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(
      <MemoryRouter>
        <CommandPalette open />
      </MemoryRouter>,
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    const msgs = warn.mock.calls.map((c) => String(c[0]));
    expect(msgs.filter((m) => m.includes('Description'))).toEqual([]);
  });

  it('command palette keeps the arrow-key active item scrolled into view', () => {
    const spy = vi.spyOn(Element.prototype, 'scrollIntoView');
    render(
      <MemoryRouter>
        <CommandPalette open />
      </MemoryRouter>,
    );
    fireEvent.keyDown(screen.getByLabelText('Command'), { key: 'ArrowDown' });
    expect(spy).toHaveBeenCalled();
  });
});

describe('Theme', () => {
  it('a stored dark theme is applied before React renders (any route, incl. AuthLayout)', () => {
    localStorage.setItem('theme', 'dark');
    const html = readFileSync(resolve(__dirname, '../../../index.html'), 'utf8');
    const inline = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
    for (const code of inline) new Function(code!)();
    render(
      <MemoryRouter>
        <AuthLayout title="Sign in">form</AuthLayout>
      </MemoryRouter>,
    );
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('toasts follow the dark theme', async () => {
    document.documentElement.classList.add('dark');
    render(<Toaster />);
    await act(async () => {
      toast('Saved');
      await new Promise((r) => setTimeout(r, 50));
    });
    const list = document.querySelector('[data-sonner-toaster]');
    expect(list).not.toBeNull();
    expect(list!.getAttribute('data-theme')).toBe('dark');
  });
});

describe('AppShell (sidebar)', () => {
  it('renders ONE account menu, not one in the rail and another in the topbar', () => {
    render(
      <MemoryRouter>
        <AppShell account={{ name: 'Ada L', menu: <div>Sign out</div> }}>x</AppShell>
      </MemoryRouter>,
    );
    // at md+ anything under an `md:hidden` ancestor is hidden; count the rest
    const desktopVisible = screen
      .getAllByRole('button', { name: 'Account' })
      .filter((b) => !b.closest('.md\\:hidden'));
    expect(desktopVisible).toHaveLength(1);
  });
});
