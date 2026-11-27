export interface PublicUser {
  id: string;
  email: string;
  displayName: string;
  emailVerifiedAt: string | null;
  createdAt: string;
}

export interface AuthResponse {
  accessToken: string;
  user: PublicUser;
}
