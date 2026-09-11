import { createBrowserRouter, RouterProvider, Outlet } from 'react-router-dom';
import { Toaster } from 'sonner';

import { AppShell } from '@/components/layout/AppShell';
import { HomePage } from '@/pages/HomePage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { TasksPage } from '@/pages/TasksPage';

/**
 * Route table. Authenticated pages are children of the AppShell layout route
 * (AppShell composes the shell from LAYOUT in @/config/site). PUBLIC routes
 * (sign in / sign up / marketing) go OUTSIDE this layout route and use
 * AuthLayout — see @/components/layout/AuthLayout — so a signed-out user is
 * never shown a sidebar full of links that 401.
 *
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
