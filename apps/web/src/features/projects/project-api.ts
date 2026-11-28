import { apiRequest } from '@/lib/api-client';
import type {
  CreateProjectInput,
  ProjectListFilters,
  ProjectListResponse,
  ProjectSummary,
  UpdateProjectInput,
} from '@/types/project';

export function listProjects(
  workspaceId: string,
  filters: ProjectListFilters = {},
): Promise<ProjectListResponse> {
  const params = new URLSearchParams();
  if (filters.page !== undefined) params.set('page', String(filters.page));
  if (filters.limit !== undefined) params.set('limit', String(filters.limit));
  if (filters.status !== undefined) params.set('status', filters.status);
  if (filters.visibility !== undefined) params.set('visibility', filters.visibility);
  if (filters.q !== undefined && filters.q.trim() !== '') params.set('q', filters.q.trim());
  const query = params.toString();
  return apiRequest<ProjectListResponse>(
    `/workspaces/${workspaceId}/projects${query ? `?${query}` : ''}`,
  );
}

export function createProject(
  workspaceId: string,
  input: CreateProjectInput,
): Promise<{ project: ProjectSummary }> {
  return apiRequest<{ project: ProjectSummary }>(`/workspaces/${workspaceId}/projects`, {
    method: 'POST',
    body: input,
  });
}

export function getProject(
  workspaceId: string,
  projectId: string,
): Promise<{ project: ProjectSummary }> {
  return apiRequest<{ project: ProjectSummary }>(
    `/workspaces/${workspaceId}/projects/${projectId}`,
  );
}

export function updateProject(
  workspaceId: string,
  projectId: string,
  input: UpdateProjectInput,
): Promise<{ project: ProjectSummary }> {
  return apiRequest<{ project: ProjectSummary }>(
    `/workspaces/${workspaceId}/projects/${projectId}`,
    { method: 'PATCH', body: input },
  );
}

export function archiveProject(
  workspaceId: string,
  projectId: string,
): Promise<{ project: ProjectSummary }> {
  return apiRequest<{ project: ProjectSummary }>(
    `/workspaces/${workspaceId}/projects/${projectId}/archive`,
    { method: 'POST' },
  );
}

export function restoreProject(
  workspaceId: string,
  projectId: string,
): Promise<{ project: ProjectSummary }> {
  return apiRequest<{ project: ProjectSummary }>(
    `/workspaces/${workspaceId}/projects/${projectId}/restore`,
    { method: 'POST' },
  );
}
