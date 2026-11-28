import { useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, Plus } from 'lucide-react';
import { listWorkspaces } from '@/features/workspaces/workspace-api';
import { useSelectedWorkspace } from '@/features/workspaces/selected-workspace-context';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/cn';

export function WorkspaceSwitcher() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { selectedWorkspaceId, setSelectedWorkspaceId } = useSelectedWorkspace();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['workspaces', { scope: 'switcher' }],
    queryFn: () => listWorkspaces(1, 50),
  });

  // Keep the selected workspace in sync with the available list.
  useEffect(() => {
    if (!data) return;
    const ids = new Set(data.items.map((item) => item.workspace.id));
    if (selectedWorkspaceId && ids.has(selectedWorkspaceId)) {
      return;
    }
    if (data.items.length === 0) {
      setSelectedWorkspaceId(null);
      return;
    }
    const first = data.items[0]?.workspace.id;
    if (first) setSelectedWorkspaceId(first);
  }, [data, selectedWorkspaceId, setSelectedWorkspaceId]);

  const selected =
    data?.items.find((item) => item.workspace.id === selectedWorkspaceId) ?? data?.items[0];

  function handleSelect(workspaceId: string) {
    setSelectedWorkspaceId(workspaceId);
    const match = location.pathname.match(/^\/app\/workspaces\/[^/]+(\/.*)?$/);
    if (match) {
      const suffix = match[1] ?? '';
      void navigate(`/app/workspaces/${workspaceId}${suffix}`, { replace: true });
    }
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
                item.workspace.id === selectedWorkspaceId && 'font-semibold',
              )}
            >
              <span className="truncate">{item.workspace.name}</span>
              <span className="text-xs text-muted">{item.membership.role}</span>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          {selectedWorkspaceId ? (
            <DropdownMenuItem
              onSelect={() => void navigate(`/app/workspaces/${selectedWorkspaceId}/members`)}
            >
              Members
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem onSelect={() => void navigate('/app/workspaces/new')}>
            <Plus className="size-4" aria-hidden="true" />
            Create workspace
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
