import { Link, Outlet } from 'react-router';
import { Brand } from '@/components/brand';
import { buttonVariants } from '@/components/ui/button-variants';

export function PublicLayout() {
  return (
    <div className="min-h-dvh bg-canvas">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-md focus:bg-surface focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-ink focus:shadow-lg"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-30 border-b border-line bg-canvas/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 lg:px-8">
          <Brand />
          <nav className="flex items-center gap-2" aria-label="Primary">
            <a
              href="#foundation"
              className="hidden rounded-md px-3 py-2 text-sm font-medium text-muted transition-colors hover:text-ink sm:block"
            >
              Foundation
            </a>
            <Link to="/app" className={buttonVariants({ variant: 'secondary', size: 'sm' })}>
              Open app
            </Link>
          </nav>
        </div>
      </header>

      <main id="main-content">
        <Outlet />
      </main>

      <footer className="border-t border-line bg-surface">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-sm text-muted sm:flex-row sm:items-center sm:justify-between lg:px-8">
          <p>TaskForge foundation — Express, MySQL, Prisma, and React.</p>
          <p>Features ship in dependency order from the product overview.</p>
        </div>
      </footer>
    </div>
  );
}
