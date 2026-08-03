import { useRouteError, isRouteErrorResponse, useNavigate } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';

import { Button } from '@/components/ui/button';

/**
 * RouteErrorPage — what the router's errorElement renders.
 *
 * This used to be NotFoundPage, which meant that any thrown error inside a
 * route — most commonly a failed API call — told the user "Page not found".
 * Reproduced by running the client without the Express backend: every route
 * that fetches rendered a 404 page. That is the wrong diagnosis shown to the
 * user, and it makes a backend outage look like a broken link.
 *
 * A 404 is "this address does not exist". A thrown error is "something went
 * wrong here" — different message, and it needs a retry, not a link home.
 */
export function RouteErrorPage() {
  const error = useRouteError();
  const navigate = useNavigate();

  // A genuine 404 thrown as a Response still deserves the 404 wording.
  const notFound = isRouteErrorResponse(error) && error.status === 404;
  const detail = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
      ? error.message
      : null;

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <div
        aria-hidden
        className="mb-4 grid size-11 place-items-center rounded-full bg-destructive/10 text-destructive"
      >
        <AlertTriangle className="size-5" />
      </div>
      <h1 className="text-xl font-semibold tracking-tight">
        {notFound ? 'Page not found' : 'Something went wrong'}
      </h1>
      <p className="mt-1.5 max-w-md text-sm text-muted-foreground">
        {notFound
          ? 'That address does not exist.'
          : 'This view failed to load. It is usually a temporary problem with the connection to the server.'}
      </p>
      {detail ? (
        <p className="mt-3 max-w-md truncate font-mono text-xs text-muted-foreground">{detail}</p>
      ) : null}
      <div className="mt-6 flex items-center gap-2">
        {!notFound ? (
          // Reload rather than router-navigate: the failure is usually a dead
          // fetch, and re-running the same route is what the user wants.
          <Button size="sm" onClick={() => window.location.reload()}>
            Try again
          </Button>
        ) : null}
        <Button size="sm" variant="outline" onClick={() => navigate('/')}>
          Back home
        </Button>
      </div>
    </div>
  );
}
