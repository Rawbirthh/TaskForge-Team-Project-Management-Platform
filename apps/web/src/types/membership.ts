export type WorkspaceRole = 'OWNER' | 'ADMIN' | 'MEMBER' | 'GUEST';
export type WorkspaceMembershipStatus = 'ACTIVE' | 'INVITED' | 'SUSPENDED' | 'REMOVED';

export interface MemberListItem {
  membership: {
    id: string;
    userId: string;
    role: WorkspaceRole;
    status: WorkspaceMembershipStatus;
    createdAt: string;
    updatedAt: string;
  };
  user: { id: string; displayName: string; email: string };
}

export interface MemberListResponse {
  items: MemberListItem[];
  page: number;
  limit: number;
  total: number;
}

export interface UpdateMemberInput {
  role?: 'ADMIN' | 'MEMBER' | 'GUEST';
  status?: 'ACTIVE' | 'SUSPENDED';
}

export type InvitationStatus = 'PENDING' | 'ACCEPTED' | 'REVOKED' | 'EXPIRED';

export interface InvitationSummary {
  id: string;
  workspaceId: string;
  email: string;
  role: WorkspaceRole;
  status: InvitationStatus;
  expiresAt: string;
  createdAt: string;
}

export interface InvitationListResponse {
  items: InvitationSummary[];
  page: number;
  limit: number;
  total: number;
}

export interface CreateInvitationInput {
  email: string;
  role: 'ADMIN' | 'MEMBER' | 'GUEST';
}

export interface AcceptInvitationResponse {
  workspace: {
    id: string;
    name: string;
    slug: string;
    createdAt: string;
    updatedAt: string;
  };
  membership: { id: string; role: string; status: string };
}
