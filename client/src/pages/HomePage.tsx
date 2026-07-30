import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';

import { SITE } from '@/config/site';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * Blank welcome page. The agent replaces this entirely on turn 1 — it's
 * intentionally uninspiring so nothing here leaks into the generated app.
 */
export function HomePage() {
  return (
    <>
      <Helmet>
        <title>{SITE.name}</title>
        <meta name="description" content={SITE.tagline} />
      </Helmet>
      <div className="container py-16">
        <Card className="max-w-xl mx-auto">
          <CardHeader>
            <CardTitle>Ready to build</CardTitle>
            <CardDescription>
              This is the fullstack starter. Edit{' '}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">
                client/src/pages/HomePage.tsx
              </code>{' '}
              to replace this page, or hand the brief to founding.dev and let the agent rewrite
              everything.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
              <li>Vite dev server: http://localhost:5173</li>
              <li>Express API: http://localhost:3001/api/health</li>
              <li>Public entrypoint (via nginx): http://localhost:8888</li>
              <li>
                Reference CRUD vertical:{' '}
                <Link to="/tasks" className="text-primary underline-offset-4 hover:underline">
                  /tasks
                </Link>{' '}
                — copy that shape for every new resource.
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
