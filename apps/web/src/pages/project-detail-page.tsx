import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useSelectedWorkspace } from '@/features/workspaces/selected-workspace-context';
import { getWorkspace } from '@/features/workspaces/workspace-api';
import {
  archiveProject,
  getProject,
  restoreProject,
  updateProject,
} from '@/features/projects/project-api';
import { ProjectForm } from '@/components/projects/project-form';
import {
  getProjectErrorMessage,
  getProjectFieldErrors,
  type ProjectFormValues,
} from '@/features/projects/project-form-utils';
import { ProjectStatusBadge, ProjectVisibilityBadge } from '@/components/projects/project-badges';
import { Button } from '@/components/ui/button';
import { buttonVariants } from '@/components/ui/button-variants';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ErrorState, LoadingState } from '@/components/ui/page-state';
import type { EditableProjectStatus, UpdateProjectInput } from '@/types/project';

type LifecycleAction = 'archive' | 'restore' | EditableProjectStatus;

export function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { selectedWorkspaceId, setSelectedWorkspaceId } = useSelectedWorkspace();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // A workspaceId in the URL makes deep links reliable; selection remains navigation state.
  const routeWorkspaceId = searchParams.get('workspaceId');
  const workspaceId = routeWorkspaceId ?? selectedWorkspaceId ?? undefined;

  useEffect(() => {
    if (routeWorkspaceId && routeWorkspaceId !== selectedWorkspaceId) {
      setSelectedWorkspaceId(routeWorkspaceId);
    }
  }, [routeWorkspaceId, selectedWorkspaceId, setSelectedWorkspaceId]);

  const workspaceQuery = useQuery({
    queryKey: ['workspace', workspaceId],
    queryFn: () => getWorkspace(workspaceId!),
    enabled: Boolean(workspaceId),
  });
  const projectQuery = useQuery({
    queryKey: ['project', workspaceId, projectId],
    queryFn: () => getProject(workspaceId!, projectId!),
    enabled: Boolean(workspaceId && projectId),
  });

  async function invalidateProject() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['project', workspaceId, projectId] }),
      queryClient.invalidateQueries({ queryKey: ['projects', workspaceId] }),
    ]);
  }

  const updateMutation = useMutation({
    mutationFn: (input: UpdateProjectInput) => updateProject(workspaceId!, projectId!, input),
    onSuccess: async () => {
      setUpdateError(null);
      setFieldErrors({});
      await invalidateProject();
      toast.success('Project saved.');
    },
    onError: (error: unknown) => {
      setUpdateError(getProjectErrorMessage(error, 'Failed to save project.'));
      setFieldErrors(getProjectFieldErrors(error));
      toast.error(getProjectErrorMessage(error, 'Failed to save project.'));
    },
  });

  const lifecycleMutation = useMutation({
    mutationFn: (action: LifecycleAction) => {
      if (action === 'archive') return archiveProject(workspaceId!, projectId!);
      if (action === 'restore') return restoreProject(workspaceId!, projectId!);
      return updateProject(workspaceId!, projectId!, { status: action });
    },
    onSuccess: async (_result, action) => {
      await invalidateProject();
      toast.success(action === 'archive' ? 'Project archived.' : 'Project updated.');
    },
    onError: (error: unknown) => {
      toast.error(getProjectErrorMessage(error, 'Failed to update project.'));
    },
  });

  if (!workspaceId || !projectId) {
    return (
      <ErrorState title="Missing project" description="Open a project from the project list." />
    );
  }

  if (projectQuery.isLoading) {
    return <LoadingState label="Loading project…" />;
  }

  if (projectQuery.isError || !projectQuery.data) {
    return (
      <ErrorState
        title="Project not found"
        description="This project may be unavailable or you may not have access."
        onRetry={() => void projectQuery.refetch()}
      />
    );
  }

  const project = projectQuery.data.project;
  const role = workspaceQuery.data?.membership.role;
  const canManage = role === 'OWNER' || role === 'ADMIN';
  const isArchived = project.status === 'ARCHIVED';

  const initialValues: ProjectFormValues = {
    key: project.key,
    name: project.name,
    description: project.description ?? '',
    visibility: project.visibility,
    startDate: project.startDate ?? '',
    targetDate: project.targetDate ?? '',
    status: project.status === 'ARCHIVED' ? 'ACTIVE' : project.status,
  };

  function handleSave(values: ProjectFormValues) {
    const input: UpdateProjectInput = {
      name: values.name.trim(),
      visibility: values.visibility,
      status: values.status,
      description: values.description.trim() ? values.description.trim() : null,
      startDate: values.startDate || null,
      targetDate: values.targetDate || null,
    };
    updateMutation.mutate(input);
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">{project.name}</h1>
          <p className="mt-1 text-sm text-muted">
            <span className="font-mono">{project.key}</span> · Created by{' '}
            {project.createdBy.displayName} · Updated {project.updatedAt}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ProjectStatusBadge status={project.status} />
          <ProjectVisibilityBadge visibility={project.visibility} />
          <Link
            to={`/app/projects?workspaceId=${encodeURIComponent(workspaceId)}`}
            className={buttonVariants({ variant: 'secondary', size: 'sm' })}
          >
            Back to projects
          </Link>
        </div>
      </div>

      {isArchived ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p>This project is archived and read-only.</p>
          {canManage ? (
            <Button
              size="sm"
              disabled={lifecycleMutation.isPending}
              onClick={() => lifecycleMutation.mutate('restore')}
            >
              Restore project
            </Button>
          ) : null}
        </div>
      ) : null}

      {canManage && !isArchived ? (
        <Card>
          <CardHeader>
            <CardTitle>Lifecycle</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {project.status !== 'ACTIVE' ? (
              <Button
                variant="secondary"
                size="sm"
                disabled={lifecycleMutation.isPending}
                onClick={() => lifecycleMutation.mutate('ACTIVE')}
              >
                Reopen
              </Button>
            ) : null}
            {project.status !== 'PAUSED' ? (
              <Button
                variant="secondary"
                size="sm"
                disabled={lifecycleMutation.isPending}
                onClick={() => lifecycleMutation.mutate('PAUSED')}
              >
                Pause
              </Button>
            ) : null}
            {project.status !== 'COMPLETED' ? (
              <Button
                variant="secondary"
                size="sm"
                disabled={lifecycleMutation.isPending}
                onClick={() => lifecycleMutation.mutate('COMPLETED')}
              >
                Complete
              </Button>
            ) : null}
            <Button
              variant="danger"
              size="sm"
              disabled={lifecycleMutation.isPending}
              onClick={() => lifecycleMutation.mutate('archive')}
            >
              Archive
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {canManage && !isArchived ? (
        <Card>
          <CardHeader>
            <CardTitle>Project details</CardTitle>
          </CardHeader>
          <CardContent>
            <ProjectForm
              key={`${project.id}-${project.updatedAt}`}
              initialValues={initialValues}
              isKeyEditable={false}
              isPending={updateMutation.isPending}
              submitLabel="Save project"
              error={updateError}
              fieldErrors={fieldErrors}
              onSubmit={handleSave}
            />
          </CardContent>
        </Card>
      ) : null}
    </section>
  );
}
