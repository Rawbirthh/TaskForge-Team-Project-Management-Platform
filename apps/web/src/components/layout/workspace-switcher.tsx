import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, Plus } from 'lucide-react';
import { listWorkspaces } from '@/features/workspaces/workspace-api';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/cn';

const SELECTED_WORKSPACE_KEY = 'taskforge:selectedWorkspaceId';

export function WorkspaceSwitcher() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useQuery({
    queryKey: ['workspaces', { scope: 'switcher' }],
    queryFn: () => listWorkspaces(1, 50),
  });

  const [selectedId, setSelectedId] = useState<string | null>(() =>
    window.localStorage.getItem(SELECTED_WORKSPACE_KEY),
  );

  useEffect(() => {
    if (!data) return;
    const ids = new Set(data.items.map((item) => item.workspace.id));
    const stored = window.localStorage.getItem(SELECTED_WORKSPACE_KEY);

    if (stored && ids.has(stored)) {
      setSelectedId(stored);
      return;
    }

    if (data.items.length === 0) {
      window.localStorage.removeItem(SELECTED_WORKSPACE_KEY);
      setSelectedId(null);
      return;
    }

    if (!selectedId) {
      const first = data.items[0]?.workspace.id;
      if (first) {
        window.localStorage.setItem(SELECTED_WORKSPACE_KEY, first);
        setSelectedId(first);
      }
    }
  }, [data, selectedId]);

  const selected = data?.items.find((item) => item.workspace.id === selectedId) ?? data?.items[0];

  function handleSelect(workspaceId: string) {
    window.localStorage.setItem(SELECTED_WORKSPACE_KEY, workspaceId);
    setSelectedId(workspaceId);
    void queryClient.invalidateQueries();
  }

  if (isLoading) {
    return (
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium tracking-wide text-muted uppercase">Workspace</p>
        <p className="truncate text-sm font-semibold text-ink">Loading…</p>
      </div>
    );
  }

  if (isError || !data || data.items.length === 0) {
    return (
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium tracking-wide text-muted uppercase">Workspace</p>
        <Link
          to="/app/workspaces/new"
          className="truncate text-sm font-semibold text-brand hover:underline"
        >
          Create your first workspace
        </Link>
      </div>
    );
  }

  return (
    <div className="min-w-0 flex-1">
      <p className="text-xs font-medium tracking-wide text-muted uppercase">Workspace</p>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={cn(
              'flex w-full items-center gap-2 truncate text-left text-sm font-semibold text-ink',
              'rounded-md px-1 py-0.5 hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none',
            )}
            aria-label="Switch workspace"
          >
            <span className="truncate">{selected?.workspace.name ?? 'Select workspace'}</span>
            <ChevronDown className="size-4 shrink-0 text-muted" aria-hidden="true" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
          {data.items.map((item) => (
            <DropdownMenuItem
              key={item.workspace.id}
              onSelect={() => handleSelect(item.workspace.id)}
              className={cn(
                'flex items-center justify-between gap-2',
                item.workspace.id === selectedId && 'font-semibold',
              )}
            >
              <span className="truncate">{item.workspace.name}</span>
              <span className="text-xs text-muted">{item.membership.role}</span>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => void navigate('/app/workspaces/new')}>
            <Plus className="size-4" aria-hidden="true" />
            Create workspace
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
