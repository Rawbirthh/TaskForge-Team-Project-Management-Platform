import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useSelectedWorkspace } from '@/features/workspaces/selected-workspace-context';
import { getWorkspace } from '@/features/workspaces/workspace-api';
import { createProject } from '@/features/projects/project-api';
import { ProjectForm } from '@/components/projects/project-form';
import {
  emptyProjectFormValues,
  getProjectErrorMessage,
  getProjectFieldErrors,
  type ProjectFormValues,
} from '@/features/projects/project-form-utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ErrorState, LoadingState } from '@/components/ui/page-state';
import type { CreateProjectInput } from '@/types/project';

export function ProjectCreatePage() {
  const { selectedWorkspaceId, setSelectedWorkspaceId } = useSelectedWorkspace();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
  const role = workspaceQuery.data?.membership.role;
  const canManage = role === 'OWNER' || role === 'ADMIN';

  if (!workspaceId) {
    return (
      <ErrorState
        title="Missing workspace"
        description="Open a workspace from the dashboard before creating a project."
      />
    );
  }

  if (workspaceQuery.isLoading) {
    return <LoadingState label="Loading workspace…" />;
  }

  if (workspaceQuery.isError || !workspaceQuery.data) {
    return (
      <ErrorState
        title="Failed to load workspace"
        description="This workspace may be unavailable or you may not have access."
        onRetry={() => void workspaceQuery.refetch()}
      />
    );
  }

  if (!canManage) {
    return (
      <ErrorState
        title="Permission denied"
        description="Only workspace owners and admins can create projects."
      />
    );
  }

  async function handleSubmit(values: ProjectFormValues) {
    setError(null);
    setFieldErrors({});
    setIsSaving(true);

    const input: CreateProjectInput = {
      key: values.key.trim(),
      name: values.name.trim(),
      visibility: values.visibility,
      status: values.status,
      ...(values.description.trim() ? { description: values.description.trim() } : {}),
      ...(values.startDate ? { startDate: values.startDate } : {}),
      ...(values.targetDate ? { targetDate: values.targetDate } : {}),
    };

    try {
      const { project } = await createProject(workspaceId!, input);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['projects', workspaceId!] }),
        queryClient.invalidateQueries({ queryKey: ['workspace', workspaceId!] }),
      ]);
      toast.success('Project created.');
      void navigate(`/app/projects/${project.id}?workspaceId=${encodeURIComponent(workspaceId!)}`);
    } catch (submitError) {
      setError(getProjectErrorMessage(submitError, 'Failed to create project.'));
      setFieldErrors(getProjectFieldErrors(submitError));
      toast.error(getProjectErrorMessage(submitError, 'Failed to create project.'));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">New project</h1>
        <p className="mt-1 text-sm text-muted">
          Create a project in the selected workspace.{' '}
          <Link
            to={`/app/projects?workspaceId=${encodeURIComponent(workspaceId)}`}
            className="text-brand underline-offset-4 hover:underline"
          >
            Back to projects
          </Link>
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Project details</CardTitle>
        </CardHeader>
        <CardContent>
          <ProjectForm
            initialValues={emptyProjectFormValues}
            isKeyEditable
            isPending={isSaving}
            submitLabel="Create project"
            error={error}
            fieldErrors={fieldErrors}
            onSubmit={(values) => void handleSubmit(values)}
          />
        </CardContent>
      </Card>
    </section>
  );
}
