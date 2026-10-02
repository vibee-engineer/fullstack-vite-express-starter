import { Helmet } from 'react-helmet-async';
import { isRouteErrorResponse, Link, useRouteError } from 'react-router-dom';

import { SITE } from '@/config/site';
import { Button } from '@/components/ui/button';
import { NotFoundPage } from '@/pages/NotFoundPage';

/** Router errorElement: a thrown 404 is "not found"; anything else is a crash. */
export function RouteErrorPage() {
  const error = useRouteError();
  if (isRouteErrorResponse(error) && error.status === 404) return <NotFoundPage />;
  if (import.meta.env.DEV) console.error(error);
  return (
    <>
      <Helmet>
        <title>Something went wrong — {SITE.name}</title>
      </Helmet>
      <div className="container py-24 text-center">
        <h1 className="text-4xl font-heading font-semibold">Something went wrong</h1>
        <p className="mt-3 text-muted-foreground">
          This page hit an unexpected error. Try reloading, or head back home.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Button onClick={() => window.location.reload()}>Reload</Button>
          <Button asChild variant="outline">
            <Link to="/">Back home</Link>
          </Button>
        </div>
      </div>
    </>
  );
}
