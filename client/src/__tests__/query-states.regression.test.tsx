import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HelmetProvider } from 'react-helmet-async';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Task } from '@shared/types';

const { apiMock } = vi.hoisted(() => ({
  apiMock: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));
vi.mock('@/api/client', () => ({ api: apiMock }));
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), message: vi.fn() },
  Toaster: () => null,
}));

const { TasksPage } = await import('@/pages/TasksPage');
const { queryClient: prodClient } = await import('@/lib/query-client');
const { formatDate } = await import('@/lib/utils');

const T: Task = {
  id: 'task_1',
  title: 'A',
  description: null,
  status: 'todo',
  createdAt: '2026-07-31T00:00:00.000Z',
  updatedAt: '2026-07-31T00:00:00.000Z',
};

function wrap(ui: React.ReactElement, qc: QueryClient) {
  return render(
    <HelmetProvider>
      <QueryClientProvider client={qc}>{ui}</QueryClientProvider>
    </HelmetProvider>,
  );
}
const testClient = () =>
  new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });

beforeEach(() => {
  apiMock.get.mockReset();
  apiMock.patch.mockReset();
});

describe('audit', () => {
  it('production queryClient does not retry a 4xx', async () => {
    apiMock.get.mockRejectedValue({ status: 404, message: 'Task not found' });
    function Probe() {
      const q = useQuery({ queryKey: ['probe404'], queryFn: () => apiMock.get('/x') });
      return <p>{q.isError ? 'err' : 'wait'}</p>;
    }
    wrap(<Probe />, prodClient);
    await screen.findByText('err', {}, { timeout: 3000 });
    expect(apiMock.get).toHaveBeenCalledTimes(1);
  });

  it('two quick status clicks never send the same transition twice', async () => {
    apiMock.get.mockResolvedValue({ data: { items: [T], total: 1 } });
    apiMock.patch.mockImplementation(() => new Promise(() => {})); // slow server
    wrap(<TasksPage />, testClient());
    const btn = await screen.findByRole('button', { name: 'Advance status of A' });
    await userEvent.click(btn);
    await userEvent.click(btn);
    const sent = apiMock.patch.mock.calls.map((c) => c[1].status);
    expect(new Set(sent).size).toBe(sent.length);
  });

  it('a failed background refetch keeps the already-loaded list visible', async () => {
    const qc = testClient();
    apiMock.get.mockResolvedValueOnce({ data: { items: [T], total: 1 } });
    wrap(<TasksPage />, qc);
    await screen.findByText('A');
    apiMock.get.mockRejectedValueOnce({ status: 0, message: 'Network Error' });
    await qc.invalidateQueries({ queryKey: ['tasks'] });
    await waitFor(() => expect(apiMock.get).toHaveBeenCalledTimes(2));
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByText('A')).toBeInTheDocument();
  });

  it('the list says when it is truncated (total > items)', async () => {
    const items = Array.from({ length: 50 }, (_, i) => ({ ...T, id: `t${i}`, title: `T${i}` }));
    apiMock.get.mockResolvedValue({ data: { items, total: 60 } });
    wrap(<TasksPage />, testClient());
    await screen.findByText('T0');
    expect(screen.queryByText(/60/)).toBeInTheDocument();
  });

  it('formatDate keeps a date-only key on its calendar day', () => {
    process.env.TZ = 'America/Los_Angeles';
    expect(formatDate('2026-10-02')).toBe('Oct 2, 2026');
  });
});
