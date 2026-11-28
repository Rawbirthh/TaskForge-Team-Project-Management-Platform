import axios, { type AxiosError } from 'axios';

const DEFAULT_API_BASE_URL = '/api/v1';

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL).replace(/\/$/, '');

let accessToken: string | null = null;

export interface AuthHooks {
  getAccessToken: () => string | null;
  refreshAccessToken: () => Promise<string | null>;
}

const defaultAuthHooks: AuthHooks = {
  getAccessToken: () => accessToken,
  refreshAccessToken: () => Promise.resolve(null),
};

let authHooks: AuthHooks = { ...defaultAuthHooks };

let refreshPromise: Promise<string | null> | null = null;

export interface ApiErrorOptions {
  requestId?: string | undefined;
  details?: unknown;
}

export class ApiError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly requestId: string | undefined;
  public readonly details: unknown;

  constructor(status: number, code: string, message: string, options: ApiErrorOptions = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.requestId = options.requestId;
    this.details = options.details;
  }
}

export interface ApiRequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  method?: string;
  signal?: AbortSignal;
}

interface ApiErrorPayload {
  error?: {
    code?: unknown;
    message?: unknown;
    requestId?: unknown;
    details?: unknown;
  };
}

const instance = axios.create({
  baseURL: apiBaseUrl,
  withCredentials: true,
  headers: { Accept: 'application/json' },
});

/**
 * Stores the short-lived access token in memory only. The refresh token remains
 * in the HttpOnly cookie and is never readable by this module.
 */
export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function configureAuthHooks(hooks: Partial<AuthHooks>): void {
  authHooks = { ...authHooks, ...hooks };
}

export function resetAuthHooks(): void {
  accessToken = null;
  authHooks = { ...defaultAuthHooks };
  refreshPromise = null;
}

function toApiError(status: number, payload: unknown): ApiError {
  if (typeof payload === 'object' && payload !== null && 'error' in payload) {
    const error = (payload as ApiErrorPayload).error;

    if (error && typeof error.code === 'string' && typeof error.message === 'string') {
      return new ApiError(status, error.code, error.message, {
        requestId: typeof error.requestId === 'string' ? error.requestId : undefined,
        details: error.details,
      });
    }
  }

  return new ApiError(status, 'UNKNOWN_ERROR', 'The request failed. Please try again.');
}

async function refreshAccessTokenOnce(): Promise<string | null> {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const refreshedToken = await authHooks.refreshAccessToken();
      if (refreshedToken) {
        setAccessToken(refreshedToken);
      }
      return refreshedToken;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

function isAuthEndpoint(path: string): boolean {
  return path === '/auth/refresh' || path === '/auth/login' || path === '/auth/register';
}

function buildPath(path: string): string {
  return path.startsWith('/') ? path : `/${path}`;
}

/**
 * Typed request wrapper for the TaskForge API, backed by Axios.
 *
 * - Sends the in-memory access token when present.
 * - Uses the refresh cookie once on a 401, then retries the original request.
 * - Parses the shared `{ data }` / `{ error }` API envelope into typed values.
 */
export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const url = buildPath(path);
  const method = (options.method ?? 'GET').toUpperCase();

  const headers: Record<string, string> = {};
  if (options.headers) {
    const h = new Headers(options.headers);
    h.forEach((value, key) => {
      headers[key] = value;
    });
  }

  const token = authHooks.getAccessToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const config: Record<string, unknown> = {
    url,
    method,
    headers,
    data: options.body,
    withCredentials: true,
  };
  if (options.signal) {
    config.signal = options.signal;
  }

  try {
    const response = await instance.request(config as never);
    const payload = response.data as { data?: T };
    return (payload?.data ?? undefined) as T;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      if (axiosError.response?.status === 401 && !isAuthEndpoint(path)) {
        const refreshedToken = await refreshAccessTokenOnce();
        if (refreshedToken) {
          const retryHeaders = { ...headers, Authorization: `Bearer ${refreshedToken}` };
          const retryConfig: Record<string, unknown> = { ...config, headers: retryHeaders };
          const retryResponse = await instance.request(retryConfig as never);
          const retryPayload = retryResponse.data as { data?: T };
          return (retryPayload?.data ?? undefined) as T;
        }
      }

      const status = axiosError.response?.status ?? 0;
      throw toApiError(status, axiosError.response?.data);
    }

    throw error;
  }
}
