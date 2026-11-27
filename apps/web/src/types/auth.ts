export interface PublicUser {
  id: string;
  email: string;
  displayName: string;
  timeZone: string;
  locale: string | null;
  avatarUrl: string | null;
  pendingEmail: string | null;
  emailVerifiedAt: string | null;
  deactivatedAt: string | null;
  deletionRequestedAt: string | null;
  createdAt: string;
}

export interface SessionSummary {
  id: string;
  createdAt: string;
  expiresAt: string;
  revokedAt: string | null;
  userAgent: string | null;
  ipAddress: string | null;
  current: boolean;
}

export interface SessionListResponse {
  sessions: SessionSummary[];
  nextCursor: string | null;
}

export interface AuthResponse {
  accessToken: string;
  user: PublicUser;
}
