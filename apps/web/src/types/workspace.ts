export type WorkspaceRole = 'OWNER' | 'ADMIN' | 'MEMBER' | 'GUEST';
export type WorkspaceMembershipStatus = 'ACTIVE' | 'INVITED' | 'SUSPENDED' | 'REMOVED';

export interface WorkspaceSummary {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logoUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceMembershipSummary {
  id: string;
  role: WorkspaceRole;
  status: WorkspaceMembershipStatus;
  createdAt: string;
}

export interface WorkspaceListItem {
  workspace: WorkspaceSummary;
  membership: WorkspaceMembershipSummary;
}

export interface WorkspaceListResponse {
  items: WorkspaceListItem[];
  page: number;
  limit: number;
  total: number;
}

export interface WorkspaceDetailResponse {
  workspace: WorkspaceSummary;
  membership: Pick<WorkspaceMembershipSummary, 'id' | 'role' | 'status'>;
}

export interface CreateWorkspaceInput {
  name: string;
  slug?: string;
}

export interface SlugAvailabilityResponse {
  slug: string;
  available: boolean;
}

export interface UpdateWorkspaceSettingsInput {
  name?: string;
  slug?: string;
  description?: string | null;
  logoUrl?: string | null;
}

export interface TransferOwnershipInput {
  targetMembershipId: string;
  currentPassword: string;
}
