import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';

import { SITE } from '@/config/site';
import { Button } from '@/components/ui/button';

export function NotFoundPage() {
  return (
    <>
      <Helmet>
        <title>Not found — {SITE.name}</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <div className="container py-24 text-center">
        <p className="text-sm text-muted-foreground uppercase tracking-wide">404</p>
        <h1 className="mt-2 text-4xl font-heading font-semibold">Page not found</h1>
        <p className="mt-3 text-muted-foreground">
          The page you're looking for doesn't exist or moved.
        </p>
        <Button asChild className="mt-8">
          <Link to="/">Back home</Link>
        </Button>
      </div>
    </>
  );
}
