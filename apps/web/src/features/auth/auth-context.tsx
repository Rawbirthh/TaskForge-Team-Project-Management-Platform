import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest, configureAuthHooks, setAccessToken } from '@/lib/api-client';
import type { AuthResponse, PublicUser } from '@/types/auth';

interface AuthContextValue {
  accessToken: string | null;
  user: PublicUser | null;
  isLoading: boolean;
  isRestoring: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName?: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [accessToken, setAccessTokenState] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(true);

  const refreshAccessToken = useCallback(async () => {
    try {
      const response = await apiRequest<{ accessToken: string }>('/auth/refresh', {
        method: 'POST',
      });
      setAccessTokenState(response.accessToken);
      setAccessToken(response.accessToken);
      return response.accessToken;
    } catch {
      setAccessTokenState(null);
      setAccessToken(null);
      return null;
    }
  }, []);

  useEffect(() => {
    configureAuthHooks({
      getAccessToken: () => accessToken,
      refreshAccessToken,
    });
  }, [accessToken, refreshAccessToken]);

  useEffect(() => {
    void (async () => {
      await refreshAccessToken();
      setIsRestoring(false);
    })();
  }, [refreshAccessToken]);

  useEffect(() => {
    setAccessToken(accessToken);
  }, [accessToken]);

  const meQuery = useQuery({
    queryKey: ['me'],
    queryFn: () => apiRequest<PublicUser>('/me'),
    enabled: Boolean(accessToken),
  });

  const login = useCallback(
    async (email: string, password: string) => {
      const response = await apiRequest<AuthResponse>('/auth/login', {
        method: 'POST',
        body: { email, password },
      });
      setAccessTokenState(response.accessToken);
      setAccessToken(response.accessToken);
      await queryClient.invalidateQueries({ queryKey: ['me'] });
    },
    [queryClient],
  );

  const register = useCallback(
    async (email: string, password: string, displayName?: string) => {
      const response = await apiRequest<AuthResponse>('/auth/register', {
        method: 'POST',
        body: { email, password, displayName },
      });
      setAccessTokenState(response.accessToken);
      setAccessToken(response.accessToken);
      await queryClient.invalidateQueries({ queryKey: ['me'] });
    },
    [queryClient],
  );

  const logout = useCallback(async () => {
    try {
      await apiRequest<void>('/auth/logout', { method: 'POST' });
    } finally {
      setAccessTokenState(null);
      setAccessToken(null);
      queryClient.removeQueries({ queryKey: ['me'] });
    }
  }, [queryClient]);

  const value = useMemo<AuthContextValue>(
    () => ({
      accessToken,
      user: meQuery.data ?? null,
      isLoading: meQuery.isLoading && Boolean(accessToken),
      isRestoring,
      login,
      register,
      logout,
    }),
    [accessToken, meQuery.data, meQuery.isLoading, isRestoring, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
