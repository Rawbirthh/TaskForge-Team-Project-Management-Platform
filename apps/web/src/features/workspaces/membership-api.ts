import { apiRequest } from '@/lib/api-client';
import type {
  AcceptInvitationResponse,
  CreateInvitationInput,
  InvitationListResponse,
  MemberListResponse,
  UpdateMemberInput,
} from '@/types/membership';

export function listMembers(
  workspaceId: string,
  page = 1,
  limit = 20,
): Promise<MemberListResponse> {
  return apiRequest<MemberListResponse>(
    `/workspaces/${workspaceId}/members?page=${page}&limit=${limit}`,
  );
}

export function updateMember(
  workspaceId: string,
  membershipId: string,
  input: UpdateMemberInput,
): Promise<{ membership: MemberListResponse['items'][number]['membership'] }> {
  return apiRequest(`/workspaces/${workspaceId}/members/${membershipId}`, {
    method: 'PATCH',
    body: input,
  });
}

export function removeMember(workspaceId: string, membershipId: string): Promise<void> {
  return apiRequest<void>(`/workspaces/${workspaceId}/members/${membershipId}`, {
    method: 'DELETE',
  });
}

export function listInvitations(
  workspaceId: string,
  page = 1,
  limit = 20,
): Promise<InvitationListResponse> {
  return apiRequest<InvitationListResponse>(
    `/workspaces/${workspaceId}/invitations?page=${page}&limit=${limit}`,
  );
}

export function createInvitation(
  workspaceId: string,
  input: CreateInvitationInput,
): Promise<{ invitation: InvitationListResponse['items'][number] }> {
  return apiRequest(`/workspaces/${workspaceId}/invitations`, {
    method: 'POST',
    body: input,
  });
}

export function resendInvitation(
  workspaceId: string,
  invitationId: string,
): Promise<{ invitation: InvitationListResponse['items'][number] }> {
  return apiRequest(`/workspaces/${workspaceId}/invitations/${invitationId}/resend`, {
    method: 'POST',
  });
}

export function revokeInvitation(workspaceId: string, invitationId: string): Promise<void> {
  return apiRequest<void>(`/workspaces/${workspaceId}/invitations/${invitationId}`, {
    method: 'DELETE',
  });
}

export function acceptInvitation(token: string): Promise<AcceptInvitationResponse> {
  return apiRequest<AcceptInvitationResponse>('/invitations/accept', {
    method: 'POST',
    body: { token },
  });
}

export function declineInvitation(token: string): Promise<void> {
  return apiRequest<void>('/invitations/decline', {
    method: 'POST',
    body: { token },
  });
}
