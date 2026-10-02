/**
 * TasksPage.test.tsx — THE REFERENCE PAGE TEST. Copy this file per page.
 *
 * The only seam is the axios instance (`@/api/client`), so the real query
 * hooks, the real cache invalidation, and the real form validation all run.
 * Mocking the hooks instead would test the mock, not the page.
 *
 * The first three cases are the ones that matter: a generated list view that
 * renders nothing while loading, nothing when empty, or nothing on error is
 * the most common defect in this codebase's history. Assert all three.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Task } from '@shared/types';

const { apiMock } = vi.hoisted(() => ({
  apiMock: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('@/api/client', () => ({ api: apiMock }));
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), message: vi.fn() },
}));

const { TasksPage } = await import('../TasksPage');

const TASKS: Task[] = [
  {
    id: 'task_1',
    title: 'Read the reference vertical',
    description: 'Schema → model → repository → routes → client → page.',
    status: 'todo',
    ownerId: null,
    createdAt: '2026-07-31T00:00:00.000Z',
    updatedAt: '2026-07-31T00:00:00.000Z',
  },
  {
    id: 'task_2',
    title: 'Copy the shape',
    description: null,
    status: 'done',
    ownerId: null,
    createdAt: '2026-07-30T00:00:00.000Z',
    updatedAt: '2026-07-30T00:00:00.000Z',
  },
];

function renderPage(ui: ReactElement = <TasksPage />, url = '/tasks') {
  // Fresh cache per test, retries off — retries make failure assertions slow
  // and flaky.
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        {/* The page keeps search + sort in the URL, so it needs a router. */}
        <MemoryRouter initialEntries={[url]}>
          {ui}
          <LocationProbe />
        </MemoryRouter>
      </QueryClientProvider>
    </HelmetProvider>,
  );
}

/** Renders the current query string so tests can assert URL state. */
function LocationProbe() {
  return <output data-testid="location">{useLocation().search}</output>;
}

beforeEach(() => {
  apiMock.get.mockReset();
  apiMock.post.mockReset();
  apiMock.patch.mockReset();
  apiMock.delete.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('TasksPage — the four list states', () => {
  it('1. renders skeletons while the list is loading', () => {
    apiMock.get.mockReturnValue(new Promise(() => {})); // never resolves

    renderPage();

    expect(screen.getByTestId('tasks-loading')).toBeInTheDocument();
    expect(screen.queryByText('No tasks yet')).not.toBeInTheDocument();
  });

  it('2. renders the error state with the server message and a retry', async () => {
    apiMock.get.mockRejectedValue({ status: 500, message: 'Database unavailable' });

    renderPage();

    expect(await screen.findByText("Couldn't load tasks")).toBeInTheDocument();
    expect(screen.getByText('Database unavailable')).toBeInTheDocument();

    apiMock.get.mockResolvedValue({ data: { items: TASKS, total: 2 } });
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByText('Read the reference vertical')).toBeInTheDocument();
  });

  it('3. renders the empty state when the list comes back empty', async () => {
    apiMock.get.mockResolvedValue({ data: { items: [], total: 0 } });

    renderPage();

    expect(await screen.findByText('No tasks yet')).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Tasks' })).not.toBeInTheDocument();
  });

  it('4. renders the loaded list with titles, descriptions and statuses', async () => {
    apiMock.get.mockResolvedValue({ data: { items: TASKS, total: 2 } });

    renderPage();

    const list = await screen.findByRole('list', { name: 'Tasks' });
    const items = within(list).getAllByRole('listitem');

    expect(items).toHaveLength(2);
    expect(within(list).getByText('Read the reference vertical')).toBeInTheDocument();
    expect(
      within(list).getByText('Schema → model → repository → routes → client → page.'),
    ).toBeInTheDocument();
    expect(within(list).getByText('To do')).toBeInTheDocument();
    expect(within(list).getByText('Done')).toBeInTheDocument();
  });
});

describe('TasksPage — create', () => {
  it('POSTs the form and refetches the list', async () => {
    apiMock.get.mockResolvedValue({ data: { items: [], total: 0 } });
    apiMock.post.mockResolvedValue({ data: { ...TASKS[0]!, id: 'task_new' } });

    renderPage();
    await screen.findByText('No tasks yet');

    await userEvent.type(screen.getByLabelText('Title'), 'Ship the vertical');
    await userEvent.type(screen.getByLabelText('Description'), 'End to end.');
    await userEvent.click(screen.getByRole('button', { name: /add task/i }));

    await waitFor(() =>
      expect(apiMock.post).toHaveBeenCalledWith('/tasks', {
        title: 'Ship the vertical',
        description: 'End to end.',
      }),
    );

    // onSuccess invalidates taskKeys.all → the list query refetches.
    await waitFor(() => expect(apiMock.get).toHaveBeenCalledTimes(2));
    // Form resets after a successful create.
    await waitFor(() => expect(screen.getByLabelText('Title')).toHaveValue(''));
  });

  it('blocks submit and shows the zod message when the title is empty', async () => {
    apiMock.get.mockResolvedValue({ data: { items: [], total: 0 } });

    renderPage();
    await screen.findByText('No tasks yet');

    await userEvent.click(screen.getByRole('button', { name: /add task/i }));

    expect(await screen.findByText('Title is required')).toBeInTheDocument();
    expect(apiMock.post).not.toHaveBeenCalled();
  });
});

describe('TasksPage — update and delete', () => {
  it('PATCHes a new title from the inline editor', async () => {
    apiMock.get.mockResolvedValue({ data: { items: TASKS, total: 2 } });
    apiMock.patch.mockResolvedValue({ data: { ...TASKS[0]!, title: 'Renamed' } });

    renderPage();
    await screen.findByText('Read the reference vertical');

    await userEvent.click(screen.getByRole('button', { name: 'Edit Read the reference vertical' }));

    const editor = screen.getByLabelText('Edit title of Read the reference vertical');
    await userEvent.clear(editor);
    await userEvent.type(editor, 'Renamed');
    await userEvent.click(screen.getByRole('button', { name: 'Save Read the reference vertical' }));

    await waitFor(() =>
      expect(apiMock.patch).toHaveBeenCalledWith('/tasks/task_1', { title: 'Renamed' }),
    );
  });

  it('PATCHes the next status when the badge is clicked', async () => {
    apiMock.get.mockResolvedValue({ data: { items: TASKS, total: 2 } });
    apiMock.patch.mockResolvedValue({ data: { ...TASKS[0]!, status: 'in_progress' } });

    renderPage();
    await screen.findByText('Read the reference vertical');

    await userEvent.click(
      screen.getByRole('button', { name: 'Advance status of Read the reference vertical' }),
    );

    await waitFor(() =>
      expect(apiMock.patch).toHaveBeenCalledWith('/tasks/task_1', { status: 'in_progress' }),
    );
  });

  it('DELETEs a task and refetches the list', async () => {
    apiMock.get.mockResolvedValue({ data: { items: TASKS, total: 2 } });
    apiMock.delete.mockResolvedValue({ data: undefined });

    renderPage();
    await screen.findByText('Copy the shape');

    await userEvent.click(screen.getByRole('button', { name: 'Delete Copy the shape' }));

    await waitFor(() => expect(apiMock.delete).toHaveBeenCalledWith('/tasks/task_2'));
    await waitFor(() => expect(apiMock.get).toHaveBeenCalledTimes(2));
  });
});

describe('TasksPage — search, sort, optimistic status', () => {
  it('reads q and sort from the URL and sends them to the server', async () => {
    apiMock.get.mockResolvedValue({ data: { items: [TASKS[0]], total: 1 } });
    renderPage(<TasksPage />, '/tasks?q=vertical&sort=title');
    await screen.findByText('Read the reference vertical');
    expect(apiMock.get).toHaveBeenCalledWith('/tasks', {
      params: { q: 'vertical', sort: 'title', dir: 'asc' },
    });
    expect(screen.getByRole('searchbox', { name: 'Search tasks' })).toHaveValue('vertical');
  });

  it('typing writes ?q= to the URL once, after the debounce', async () => {
    apiMock.get.mockResolvedValue({ data: { items: TASKS, total: 2 } });
    renderPage();
    await screen.findByText('Copy the shape');
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search tasks' }), 'copy');
    expect(screen.getByTestId('location')).toHaveTextContent(/^$/); // not per keystroke
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('?q=copy'));
    await waitFor(() =>
      expect(apiMock.get).toHaveBeenLastCalledWith('/tasks', {
        params: { q: 'copy', sort: 'createdAt', dir: 'desc' },
      }),
    );
    // No request for the partial words "c", "co", "cop".
    const sentQs = apiMock.get.mock.calls.map((c) => c[1]?.params?.q).filter(Boolean);
    expect(sentQs).toEqual(['copy']);
  });

  it('a search with no hits says so and offers to clear it (not "No tasks yet")', async () => {
    apiMock.get.mockResolvedValue({ data: { items: [], total: 0 } });
    renderPage(<TasksPage />, '/tasks?q=zzz');
    expect(await screen.findByText('No tasks match “zzz”')).toBeInTheDocument();
    expect(screen.queryByText('No tasks yet')).not.toBeInTheDocument();
    apiMock.get.mockResolvedValue({ data: { items: TASKS, total: 2 } });
    await userEvent.click(screen.getByRole('button', { name: 'Clear search' }));
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(/^$/));
    expect(await screen.findByText('Copy the shape')).toBeInTheDocument();
  });

  it('flips the status badge before the server answers, and rolls back on failure', async () => {
    apiMock.get.mockResolvedValue({ data: { items: [TASKS[0]], total: 1 } });
    let reject!: (e: unknown) => void;
    apiMock.patch.mockImplementation(() => new Promise((_res, rej) => (reject = rej)));
    renderPage();
    const item = (await screen.findByText('Read the reference vertical')).closest('li')!;
    expect(within(item).getByText('To do')).toBeInTheDocument();

    await userEvent.click(within(item).getByRole('button', { name: /Advance status/ }));
    // Optimistic: the server has not answered yet.
    expect(within(item).getByText('In progress')).toBeInTheDocument();

    reject({ status: 500, message: 'Server exploded' });
    await waitFor(() => expect(within(item).getByText('To do')).toBeInTheDocument());
  });
});
