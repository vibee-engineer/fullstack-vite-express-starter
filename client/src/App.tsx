import { createBrowserRouter, RouterProvider, Outlet } from 'react-router-dom';
import { Toaster } from 'sonner';

import { AppShell } from '@/components/layout/AppShell';
import { HomePage } from '@/pages/HomePage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { RouteErrorPage } from '@/pages/RouteErrorPage';
import { TasksPage } from '@/pages/TasksPage';

/**
 * Route table. Add new routes here as children of the AppShell layout route.
 * The `errorElement` catches thrown responses (React Router v7 error boundary
 * semantics) so a bad fetch inside a loader doesn't blank the whole app.
 *
 * It renders RouteErrorPage, NOT NotFoundPage. Those are different diagnoses: a
 * 404 means the address does not exist, a thrown error means this view failed.
 * Pointing errorElement at NotFoundPage made every failed API call tell the user
 * "Page not found", which is both wrong and unactionable.
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
        <RouteErrorPage />
      </AppShell>
    ),
    children: [
      { path: '/', element: <HomePage /> },
      // Reference CRUD vertical — delete once you have real resources.
      { path: '/tasks', element: <TasksPage /> },
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
