import { apiRequest } from '@/lib/api-client';
import type { PublicUser, SessionListResponse } from '@/types/auth';

export interface ProfileResponse {
  profile: PublicUser;
}

export async function getProfile(): Promise<ProfileResponse> {
  return apiRequest<ProfileResponse>('/users/me/profile');
}

export async function updateProfile(input: {
  displayName?: string;
  timeZone?: string;
  locale?: string | null;
  avatarUrl?: string | null;
}): Promise<ProfileResponse> {
  return apiRequest<ProfileResponse>('/users/me/profile', {
    method: 'PATCH',
    body: input,
  });
}

export async function requestEmailChange(email: string): Promise<{ message: string }> {
  const response = await apiRequest<{ message: string }>('/users/me/email-change', {
    method: 'POST',
    body: { email },
  });
  return response;
}

export async function verifyEmailChange(token: string): Promise<{ message: string }> {
  return apiRequest<{ message: string }>('/users/me/email-change/verify', {
    method: 'POST',
    body: { token },
  });
}

export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<{ message: string }> {
  return apiRequest<{ message: string }>('/users/me/password', {
    method: 'POST',
    body: { currentPassword, newPassword },
  });
}

export async function listSessions(cursor?: string | null): Promise<SessionListResponse> {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
  return apiRequest<SessionListResponse>(`/users/me/sessions${query}`);
}

export async function revokeSession(sessionId: string): Promise<void> {
  await apiRequest<void>(`/users/me/sessions/${sessionId}`, { method: 'DELETE' });
}

export async function deactivateAccount(): Promise<{ message: string }> {
  return apiRequest<{ message: string }>('/users/me/deactivate', { method: 'POST' });
}

export async function requestDeletion(): Promise<{ message: string }> {
  return apiRequest<{ message: string }>('/users/me/delete-request', {
    method: 'POST',
    body: { confirmation: 'DELETE' },
  });
}
