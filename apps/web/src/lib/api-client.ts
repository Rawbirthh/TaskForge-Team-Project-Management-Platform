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
}

interface ApiErrorPayload {
  error?: {
    code?: unknown;
    message?: unknown;
    requestId?: unknown;
    details?: unknown;
  };
}

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

async function parseResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get('content-type') ?? '';

  if (response.status === 204) {
    return undefined as T;
  }

  if (!contentType.includes('application/json')) {
    if (!response.ok) {
      throw new ApiError(response.status, 'UNKNOWN_ERROR', 'The request failed. Please try again.');
    }
    return undefined as T;
  }

  const payload: unknown = await response.json();

  if (!response.ok) {
    throw toApiError(response.status, payload);
  }

  return (payload as { data: T }).data;
}

function buildUrl(path: string): string {
  return `${apiBaseUrl}${path.startsWith('/') ? path : `/${path}`}`;
}

async function sendRequest(
  url: string,
  options: ApiRequestOptions,
  token: string | null,
): Promise<Response> {
  const { body, headers, ...init } = options;

  const requestHeaders = new Headers(headers);
  requestHeaders.set('Accept', 'application/json');

  if (body !== undefined) {
    requestHeaders.set('Content-Type', 'application/json');
  }

  if (token) {
    requestHeaders.set('Authorization', `Bearer ${token}`);
  }

  return fetch(url, {
    ...init,
    credentials: 'include',
    headers: requestHeaders,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

/**
 * Typed fetch wrapper for the TaskForge API.
 *
 * - Sends the in-memory access token when present.
 * - Uses the refresh cookie once on a 401, then retries the original request.
 * - Parses the shared `{ data }` / `{ error }` API envelope into typed values.
 */
export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const url = buildUrl(path);
  let response = await sendRequest(url, options, authHooks.getAccessToken());

  if (response.status === 401) {
    const refreshedToken = await authHooks.refreshAccessToken();
    if (refreshedToken) {
      setAccessToken(refreshedToken);
      response = await sendRequest(url, options, refreshedToken);
    }
  }

  return parseResponse<T>(response);
}
