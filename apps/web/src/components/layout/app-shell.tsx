import type { LucideIcon } from 'lucide-react';
import {
  ChevronDown,
  FolderKanban,
  LayoutDashboard,
  ListTodo,
  Menu,
  Settings,
  ShieldCheck,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router';
import { useAuth } from '@/features/auth/auth-context';
import { Brand } from '@/components/brand';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/cn';

interface NavItem {
  label: string;
  icon: LucideIcon;
  to?: string;
  end?: boolean;
  soon?: boolean;
}

const navItems: NavItem[] = [
  { label: 'Dashboard', icon: LayoutDashboard, to: '/app', end: true },
  { label: 'Projects', icon: FolderKanban, soon: true },
  { label: 'My work', icon: ListTodo, soon: true },
  { label: 'Settings', icon: Settings, soon: true },
];

export function AppShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isNavOpen, setIsNavOpen] = useState(false);

  async function handleSignOut() {
    await logout();
    void navigate('/login', { replace: true });
  }

  useEffect(() => {
    if (!isNavOpen) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsNavOpen(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isNavOpen]);

  return (
    <div className="min-h-dvh bg-canvas">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-md focus:bg-surface focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-ink focus:shadow-lg"
      >
        Skip to content
      </a>

      {isNavOpen ? (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-0 z-30 bg-slate-950/30 lg:hidden"
          onClick={() => setIsNavOpen(false)}
        />
      ) : null}

      <div className="flex min-h-dvh">
        <aside
          id="app-sidebar"
          aria-label="Main navigation"
          className={cn(
            'fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-line bg-surface transition-transform lg:static lg:translate-x-0',
            isNavOpen ? 'translate-x-0' : '-translate-x-full',
          )}
        >
          <div className="flex h-16 items-center border-b border-line px-5">
            <Brand />
          </div>

          <nav className="flex-1 space-y-1 px-3 py-4" aria-label="Workspace">
            {navItems.map((item) => {
              const Icon = item.icon;

              if (item.to) {
                return (
                  <NavLink
                    key={item.label}
                    to={item.to}
                    end={item.end ?? false}
                    onClick={() => setIsNavOpen(false)}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-brand-soft text-brand'
                          : 'text-muted hover:bg-surface-muted hover:text-ink',
                      )
                    }
                  >
                    <Icon className="size-4" aria-hidden="true" />
                    <span>{item.label}</span>
                  </NavLink>
                );
              }

              return (
                <span
                  key={item.label}
                  aria-disabled="true"
                  className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted/60"
                >
                  <Icon className="size-4" aria-hidden="true" />
                  <span>{item.label}</span>
                  <Badge variant="neutral" className="ml-auto text-[10px]">
                    Soon
                  </Badge>
                </span>
              );
            })}
          </nav>

          <div className="border-t border-line p-4">
            <div className="flex items-start gap-3 rounded-lg bg-surface-muted/60 p-3">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden="true" />
              <div className="space-y-1">
                <p className="text-xs font-semibold text-ink">Secure foundation</p>
                <p className="text-xs leading-5 text-muted">
                  Auth, workspaces, and projects are added in dependency order.
                </p>
              </div>
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-line bg-surface/95 px-4 backdrop-blur lg:px-8">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              aria-label="Open navigation"
              aria-controls="app-sidebar"
              aria-expanded={isNavOpen}
              onClick={() => setIsNavOpen(true)}
            >
              <Menu className="size-5" aria-hidden="true" />
            </Button>

            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium tracking-wide text-muted uppercase">Workspace</p>
              <p className="truncate text-sm font-semibold text-ink">Foundation workspace</p>
            </div>

            <Badge variant="info" className="hidden sm:inline-flex">
              Foundation
            </Badge>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-2 px-2">
                  <span className="grid size-8 place-items-center rounded-full bg-brand-soft text-xs font-semibold text-brand">
                    TF
                  </span>
                  <span className="hidden text-sm font-medium sm:inline">Account</span>
                  <ChevronDown className="size-4 text-muted" aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>{user?.displayName ?? 'Account'}</DropdownMenuLabel>
                {user?.email ? (
                  <DropdownMenuItem disabled className="text-muted">
                    {user.email}
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => void handleSignOut()}>Sign out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </header>

          <main id="main-content" className="min-w-0 flex-1">
            <div className="mx-auto w-full max-w-6xl px-4 py-8 lg:px-8 lg:py-10">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
