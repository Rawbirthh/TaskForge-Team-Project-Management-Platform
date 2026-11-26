import { isRouteErrorResponse, Link, useRouteError } from 'react-router';
import { Button } from '@/components/ui/button';
import { buttonVariants } from '@/components/ui/button-variants';

export function RouteErrorPage() {
  const error = useRouteError();
  const status = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`.trim()
    : 'Unexpected error';

  return (
    <main className="grid min-h-dvh place-items-center bg-canvas px-4">
      <div className="max-w-md text-center">
        <p className="text-sm font-semibold text-brand">{status}</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink">
          Something went wrong
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted">
          The page could not be rendered. Reload the application or return to the workspace.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button variant="secondary" onClick={() => window.location.reload()}>
            Reload
          </Button>
          <Link to="/" className={buttonVariants()}>
            Home
          </Link>
        </div>
      </div>
    </main>
  );
}
