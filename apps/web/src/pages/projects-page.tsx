import { useEffect } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { useSelectedWorkspace } from '@/features/workspaces/selected-workspace-context';
import { getWorkspace } from '@/features/workspaces/workspace-api';
import { listProjects } from '@/features/projects/project-api';
import { Button } from '@/components/ui/button';
import { buttonVariants } from '@/components/ui/button-variants';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/page-state';
import { ProjectStatusBadge, ProjectVisibilityBadge } from '@/components/projects/project-badges';
import type { ProjectListFilters, ProjectStatus, ProjectVisibility } from '@/types/project';

const STATUSES: ProjectStatus[] = ['ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED'];
const VISIBILITIES: ProjectVisibility[] = ['WORKSPACE', 'PRIVATE'];
const PAGE_SIZE = 20;

function allowlistedStatus(value: string | null): ProjectStatus | undefined {
  return STATUSES.find((status) => status === value);
}

function allowlistedVisibility(value: string | null): ProjectVisibility | undefined {
  return VISIBILITIES.find((visibility) => visibility === value);
}

export function ProjectsPage() {
  const { workspaceId: routeWorkspaceId } = useParams<{ workspaceId: string }>();
  const { selectedWorkspaceId, setSelectedWorkspaceId } = useSelectedWorkspace();
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    if (routeWorkspaceId && routeWorkspaceId !== selectedWorkspaceId) {
      setSelectedWorkspaceId(routeWorkspaceId);
    }
  }, [routeWorkspaceId, selectedWorkspaceId, setSelectedWorkspaceId]);

  const workspaceId = routeWorkspaceId ?? selectedWorkspaceId ?? undefined;
  const q = searchParams.get('q') ?? '';
  const status = allowlistedStatus(searchParams.get('status'));
  const visibility = allowlistedVisibility(searchParams.get('visibility'));
  const page = Math.max(1, Number(searchParams.get('page') ?? '1') || 1);

  function updateParams(patch: Record<string, string | undefined>) {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined || value === '') next.delete(key);
      else next.set(key, value);
    }
    setSearchParams(next);
  }

  const filters: ProjectListFilters = {
    page,
    limit: PAGE_SIZE,
    ...(q ? { q } : {}),
    ...(status ? { status } : {}),
    ...(visibility ? { visibility } : {}),
  };

  const projectsQuery = useQuery({
    queryKey: ['projects', workspaceId, filters],
    queryFn: () => listProjects(workspaceId!, filters),
    enabled: Boolean(workspaceId),
  });

  const workspaceQuery = useQuery({
    queryKey: ['workspace', workspaceId],
    queryFn: () => getWorkspace(workspaceId!),
    enabled: Boolean(workspaceId),
  });
  const role = workspaceQuery.data?.membership.role;
  const canManage = role === 'OWNER' || role === 'ADMIN';

  if (!workspaceId) {
    return (
      <ErrorState title="Missing workspace" description="Open a workspace from the dashboard." />
    );
  }

  const items = projectsQuery.data?.items ?? [];
  const total = projectsQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Projects</h1>
          <p className="mt-1 text-sm text-muted">Browse and manage projects in this workspace.</p>
        </div>
        {canManage ? (
          <Link
            to={`new?workspaceId=${encodeURIComponent(workspaceId)}`}
            className={buttonVariants()}
          >
            New project
          </Link>
        ) : null}
      </div>

      <Card>
        <CardHeader className="gap-3">
          <CardTitle>Filters</CardTitle>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label htmlFor="project-search" className="mb-1 block text-sm font-medium text-ink">
                Search
              </label>
              <Input
                id="project-search"
                value={q}
                placeholder="Name or key"
                maxLength={100}
                onChange={(event) => updateParams({ q: event.target.value, page: undefined })}
              />
            </div>
            <div>
              <label htmlFor="status-filter" className="mb-1 block text-sm font-medium text-ink">
                Status
              </label>
              <select
                id="status-filter"
                value={status ?? ''}
                onChange={(event) => updateParams({ status: event.target.value, page: undefined })}
                className="h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink"
              >
                <option value="">All statuses</option>
                {STATUSES.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="visibility-filter"
                className="mb-1 block text-sm font-medium text-ink"
              >
                Visibility
              </label>
              <select
                id="visibility-filter"
                value={visibility ?? ''}
                onChange={(event) =>
                  updateParams({ visibility: event.target.value, page: undefined })
                }
                className="h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink"
              >
                <option value="">All visibility</option>
                {VISIBILITIES.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {projectsQuery.isLoading ? <LoadingState label="Loading projects…" /> : null}
          {projectsQuery.isError ? (
            <ErrorState
              title="Failed to load projects"
              description="Projects may be unavailable or you may not have access."
              onRetry={() => void projectsQuery.refetch()}
            />
          ) : null}
          {!projectsQuery.isLoading && !projectsQuery.isError && items.length === 0 ? (
            <EmptyState
              title={
                q || status || visibility ? 'No projects match these filters' : 'No projects yet'
              }
              description={
                canManage
                  ? 'Create a project to get started.'
                  : 'Ask a workspace owner or admin to create a project.'
              }
              action={
                canManage ? (
                  <Link
                    to={`new?workspaceId=${encodeURIComponent(workspaceId)}`}
                    className={buttonVariants({ size: 'sm' })}
                  >
                    New project
                  </Link>
                ) : undefined
              }
            />
          ) : null}
          {!projectsQuery.isLoading && !projectsQuery.isError && items.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <caption className="sr-only">Projects in this workspace</caption>
                <thead className="text-xs tracking-wide text-muted uppercase">
                  <tr>
                    <th scope="col" className="px-3 py-2">
                      Key
                    </th>
                    <th scope="col" className="px-3 py-2">
                      Name
                    </th>
                    <th scope="col" className="px-3 py-2">
                      Status
                    </th>
                    <th scope="col" className="px-3 py-2">
                      Visibility
                    </th>
                    <th scope="col" className="px-3 py-2">
                      Target date
                    </th>
                    <th scope="col" className="px-3 py-2">
                      Created by
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {items.map((project) => (
                    <tr key={project.id} className="hover:bg-surface-muted/60">
                      <td className="px-3 py-3 font-mono text-xs text-muted">{project.key}</td>
                      <td className="px-3 py-3">
                        <Link
                          to={`${project.id}?workspaceId=${encodeURIComponent(workspaceId)}`}
                          className="font-medium text-ink underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-brand"
                        >
                          {project.name}
                        </Link>
                      </td>
                      <td className="px-3 py-3">
                        <ProjectStatusBadge status={project.status} />
                      </td>
                      <td className="px-3 py-3">
                        <ProjectVisibilityBadge visibility={project.visibility} />
                      </td>
                      <td className="px-3 py-3 text-muted">{project.targetDate ?? '—'}</td>
                      <td className="px-3 py-3 text-muted">{project.createdBy.displayName}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {totalPages > 1 ? (
            <div className="flex items-center justify-between gap-3 text-sm text-muted">
              <span>
                Page {page} of {totalPages}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => updateParams({ page: String(page - 1) })}
                >
                  Previous
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => updateParams({ page: String(page + 1) })}
                >
                  Next
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </section>
  );
}
