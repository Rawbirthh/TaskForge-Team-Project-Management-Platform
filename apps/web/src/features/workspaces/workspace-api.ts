import { apiRequest } from '@/lib/api-client';
import type {
  CreateWorkspaceInput,
  SlugAvailabilityResponse,
  WorkspaceDetailResponse,
  WorkspaceListResponse,
  WorkspaceSummary,
} from '@/types/workspace';

export function listWorkspaces(page = 1, limit = 20): Promise<WorkspaceListResponse> {
  return apiRequest<WorkspaceListResponse>(`/workspaces?page=${page}&limit=${limit}`);
}

export function getWorkspace(workspaceId: string): Promise<WorkspaceDetailResponse> {
  return apiRequest<WorkspaceDetailResponse>(`/workspaces/${workspaceId}`);
}

export function createWorkspace(
  input: CreateWorkspaceInput,
): Promise<{ workspace: WorkspaceSummary }> {
  return apiRequest<{ workspace: WorkspaceSummary }>('/workspaces', {
    method: 'POST',
    body: input,
  });
}

export function checkSlugAvailability(slug: string): Promise<SlugAvailabilityResponse> {
  return apiRequest<SlugAvailabilityResponse>(
    `/workspaces/slug-availability?slug=${encodeURIComponent(slug)}`,
  );
}
