import { createBrowserRouter, RouterProvider, Outlet } from 'react-router-dom';
import { Toaster } from 'sonner';

import { AppShell } from '@/components/layout/AppShell';
import { HomePage } from '@/pages/HomePage';
import { NotFoundPage } from '@/pages/NotFoundPage';

/**
 * Route table. Add new routes here as children of the AppShell layout route.
 * The `errorElement` catches thrown responses (React Router v7 error boundary
 * semantics) so a bad fetch inside a loader doesn't blank the whole app.
 */
const router = createBrowserRouter([
  {
    element: (
      <AppShell>
        <Outlet />
      </AppShell>
    ),
    errorElement: (
      <AppShell>
        <NotFoundPage />
      </AppShell>
    ),
    children: [
      { path: '/', element: <HomePage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);

export default function App() {
  return (
    <>
      <RouterProvider router={router} />
      <Toaster position="top-right" richColors closeButton />
    </>
  );
}
