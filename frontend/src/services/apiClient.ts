/**
 * apiClient — typed fetch wrapper with interceptor chain.
 *
 * Contract (REQ-FF-AUTH-SESSION, REQ-FF-NETWORK-ERRORS, REQ-FF-ROLE-SAFE-ROUTING):
 *  - Every request includes `Authorization: Bearer <IdToken>` from sessionStore.
 *  - 401 -> clears the session (logout flow triggers /login redirect elsewhere).
 *  - 403 -> surfaces `forbidden` code (page templates handle 403).
 *  - 5xx -> returns `server_error` (retryable toast).
 *  - Network failure -> returns `network_error` (retryable toast).
 *  - Successful JSON -> parses + returns `{ok:true, data}`.
 *
 * Notes:
 *  - We never re-validate the JWT in the SPA — the API Gateway already did.
 *  - We never retry mutating requests (POST/PATCH/DELETE) automatically.
 *    GETs are not retried here either; TanStack Query handles retries at the
 *    higher cache layer for idempotent reads.
 */
import { sessionStore } from '@/stores/sessionStore';

// Pull the synchronous session state — apiClient is called from imperative code
// (TanStack Query fetcher, auth actions) so we read from the Zustand store
// directly instead of going through a hook.
const sessionApi = sessionStore.getState();

export interface ApiSuccess<T> {
  ok: true;
  data: T;
  status: number;
}

export interface ApiFailure {
  ok: false;
  code: ApiErrorCode;
  status: number;
  message: string;
}

export type ApiResult<T> = ApiSuccess<T> | ApiFailure;

export type ApiErrorCode =
  | 'bad_request'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'server_error'
  | 'network_error'
  | 'unknown';

export function isSuccess<T>(r: ApiResult<T>): r is ApiSuccess<T> {
  return r.ok === true;
}

export function isFailure<T>(r: ApiResult<T>): r is ApiFailure {
  return r.ok === false;
}

export class ApiError extends Error {
  constructor(
    readonly code: ApiErrorCode,
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface RequestOptions {
  headers?: Record<string, string>;
}

async function send<T>(method: string, url: string, body?: unknown, opts?: RequestOptions): Promise<ApiResult<T>> {
  const session = sessionStore.getState();
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(opts?.headers ?? {}),
  };
  if (session.idToken) {
    headers.Authorization = `Bearer ${session.idToken}`;
  }
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  let response: Response;
  try {
    const init: RequestInit = {
      method,
      headers,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    };
    response = await fetch(url, init);
  } catch (error) {
    // Network / DNS / CORS failure.
    return {
      ok: false,
      code: 'network_error',
      status: 0,
      message: error instanceof Error ? error.message : 'Network error',
    };
  }

  // 401 — clear session so useAuth/router can route to /login.
  if (response.status === 401) {
    sessionApi.clear();
    const message = await readErrorMessage(response);
    return { ok: false, code: 'unauthorized', status: 401, message };
  }

  if (response.status === 204) {
    return { ok: true, data: null as T, status: 204 };
  }

  const isJson = (response.headers.get('content-type') ?? '').includes('application/json');

  if (response.ok) {
    if (!isJson) {
      return { ok: true, data: null as T, status: response.status };
    }
    const data = (await response.json()) as T;
    return { ok: true, data, status: response.status };
  }

  // Error path
  const message = await readErrorMessage(response);
  const code = mapStatusToCode(response.status);
  return { ok: false, code, status: response.status, message };
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const ct = response.headers.get('content-type') ?? '';
    if (ct.includes('application/json')) {
      const body = (await response.json()) as { error?: string };
      return body.error ?? response.statusText;
    }
  } catch {
    // fall through
  }
  return response.statusText;
}

function mapStatusToCode(status: number): ApiErrorCode {
  if (status === 400) return 'bad_request';
  if (status === 401) return 'unauthorized';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'not_found';
  if (status === 409) return 'conflict';
  if (status >= 500) return 'server_error';
  return 'unknown';
}

export const apiClient = {
  get: <T>(url: string, opts?: RequestOptions) => send<T>('GET', url, undefined, opts),
  post: <T>(url: string, body?: unknown, opts?: RequestOptions) => send<T>('POST', url, body, opts),
  patch: <T>(url: string, body?: unknown, opts?: RequestOptions) => send<T>('PATCH', url, body, opts),
  del: <T>(url: string, opts?: RequestOptions) => send<T>('DELETE', url, undefined, opts),
};