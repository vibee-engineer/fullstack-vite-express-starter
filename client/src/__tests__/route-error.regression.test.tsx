import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { HelmetProvider } from 'react-helmet-async';
import { expect, it, vi } from 'vitest';

vi.mock('@/pages/TasksPage', () => ({
  TasksPage: () => {
    throw new TypeError("Cannot read properties of undefined (reading 'map')");
  },
}));

it('a crashing page is not reported to the user as a 404', async () => {
  window.history.pushState({}, '', '/tasks');
  vi.spyOn(console, 'error').mockImplementation(() => {});
  const { default: App } = await import('@/App');
  render(
    <HelmetProvider>
      <QueryClientProvider client={new QueryClient()}>
        <App />
      </QueryClientProvider>
    </HelmetProvider>,
  );
  await screen.findByRole('heading', { level: 1 });
  expect(screen.queryByText('Page not found')).not.toBeInTheDocument();
});
