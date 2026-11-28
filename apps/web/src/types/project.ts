export type ProjectVisibility = 'WORKSPACE' | 'PRIVATE';
export type ProjectStatus = 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'ARCHIVED';
export type EditableProjectStatus = Exclude<ProjectStatus, 'ARCHIVED'>;

export interface ProjectSummary {
  id: string;
  workspaceId: string;
  key: string;
  name: string;
  description: string | null;
  visibility: ProjectVisibility;
  status: ProjectStatus;
  startDate: string | null;
  targetDate: string | null;
  createdBy: { id: string; displayName: string };
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
}

export interface ProjectListResponse {
  items: ProjectSummary[];
  page: number;
  limit: number;
  total: number;
}

export interface ProjectListFilters {
  page?: number;
  limit?: number;
  status?: ProjectStatus;
  visibility?: ProjectVisibility;
  q?: string;
}

export interface CreateProjectInput {
  key: string;
  name: string;
  description?: string;
  visibility: ProjectVisibility;
  startDate?: string;
  targetDate?: string;
  status: EditableProjectStatus;
}

export interface UpdateProjectInput {
  name?: string;
  description?: string | null;
  visibility?: ProjectVisibility;
  status?: EditableProjectStatus;
  startDate?: string | null;
  targetDate?: string | null;
}
