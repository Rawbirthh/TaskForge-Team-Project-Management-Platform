import { Link } from 'react-router';
import { buttonVariants } from '@/components/ui/button-variants';

export function NotFoundPage() {
  return (
    <main className="grid min-h-dvh place-items-center bg-canvas px-4">
      <div className="max-w-md text-center">
        <p className="text-sm font-semibold text-brand">404</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink">Page not found</h1>
        <p className="mt-3 text-sm leading-6 text-muted">
          The page you requested does not exist. Check the address or return to the workspace.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link to="/" className={buttonVariants({ variant: 'secondary' })}>
            Home
          </Link>
          <Link to="/app" className={buttonVariants()}>
            Open app
          </Link>
        </div>
      </div>
    </main>
  );
}
