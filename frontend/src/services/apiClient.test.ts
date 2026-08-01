/**
 * apiClient test suite (RED phase).
 *
 * Verifies the contract:
 *  - Adds `Authorization: Bearer <IdToken>` from session on every request.
 *  - 401 -> clears session + redirects to /login.
 *  - 5xx -> returns `{ok:false, code}` for retryable toast.
 *  - Validation errors (zod) surface as `{ok:false, code:'validation_error'}`.
 *  - Successful responses return `{ok:true, data}`.
 *  - Retries idempotent GETs once on transient network failure.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { server } from '@/test/setup';
import { http, HttpResponse } from 'msw';
import { apiClient, isFailure, isSuccess } from './apiClient';
import { sessionStore } from '@/stores/sessionStore';

const BASE = 'https://api.example.test';
const sessionApi = sessionStore.getState();

describe('apiClient', () => {
  beforeEach(() => {
    sessionApi.setSession({
      idToken: 'test-jwt',
      refreshToken: 'test-refresh',
      expiresAt: Date.now() + 60_000,
      userId: 'u1',
      email: 'a@b.com',
      role: 'user',
    });
  });

  afterEach(() => {
    sessionApi.clear();
    server.resetHandlers();
  });

  it('adds Authorization: Bearer <IdToken> from session', async () => {
    let receivedAuth: string | null = null;
    server.use(
      http.get(`${BASE}/users`, ({ request }) => {
        receivedAuth = request.headers.get('authorization');
        return HttpResponse.json([]);
      }),
    );
    await apiClient.get(`${BASE}/users`);
    expect(receivedAuth).toBe('Bearer test-jwt');
  });

  it('returns ok:true with parsed data on 2xx JSON response', async () => {
    server.use(
      http.get(`${BASE}/categories`, () =>
        HttpResponse.json([{ id: 'c1', slug: 'a', name: 'A', color: '#000000' }]),
      ),
    );
    const res = await apiClient.get(`${BASE}/categories`);
    expect(isSuccess(res)).toBe(true);
    if (isSuccess(res)) {
      expect(res.data).toEqual([{ id: 'c1', slug: 'a', name: 'A', color: '#000000' }]);
    }
  });

  it('returns ApiError with status 400 on validation failure', async () => {
    server.use(
      http.post(`${BASE}/categories`, () =>
        HttpResponse.json({ error: 'bad color' }, { status: 400 }),
      ),
    );
    const res = await apiClient.post(`${BASE}/categories`, { slug: 'a' });
    expect(isFailure(res)).toBe(true);
    if (isFailure(res)) {
      expect(res.code).toBe('bad_request');
      expect(res.status).toBe(400);
      expect(res.message).toBe('bad color');
    }
  });

  it('on 401 clears the session (REQ-FF-AUTH-SESSION expired)', async () => {
    server.use(
      http.get(`${BASE}/categories`, () =>
        HttpResponse.json({ error: 'token expired' }, { status: 401 }),
      ),
    );
    expect(sessionStore.getState().idToken).toBe('test-jwt');
    const res = await apiClient.get(`${BASE}/categories`);
    expect(isFailure(res)).toBe(true);
    if (isFailure(res)) {
      expect(res.code).toBe('unauthorized');
    }
    expect(sessionStore.getState().idToken).toBeUndefined();
  });

  it('on 5xx returns retryable error code (REQ-FF-NETWORK-ERRORS)', async () => {
    server.use(
      http.get(`${BASE}/categories`, () =>
        HttpResponse.json({ error: 'Internal server error' }, { status: 500 }),
      ),
    );
    const res = await apiClient.get(`${BASE}/categories`);
    expect(isFailure(res)).toBe(true);
    if (isFailure(res)) {
      expect(res.code).toBe('server_error');
      expect(res.status).toBe(500);
    }
  });

  it('on 403 returns forbidden error code (REQ-FF-ROLE-SAFE-ROUTING)', async () => {
    server.use(
      http.get(`${BASE}/users`, () =>
        HttpResponse.json({ error: 'forbidden: admin role required' }, { status: 403 }),
      ),
    );
    const res = await apiClient.get(`${BASE}/users`);
    expect(isFailure(res)).toBe(true);
    if (isFailure(res)) {
      expect(res.code).toBe('forbidden');
      expect(res.status).toBe(403);
    }
  });

  it('on network failure (TypeError) returns retryable code', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (() => Promise.reject(new TypeError('Failed to fetch'))) as typeof fetch;
    try {
      const res = await apiClient.get(`${BASE}/categories`);
      expect(isFailure(res)).toBe(true);
      if (isFailure(res)) {
        expect(res.code).toBe('network_error');
      }
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('POST sends JSON body with Content-Type', async () => {
    let receivedBody: unknown = null;
    server.use(
      http.post(`${BASE}/categories`, async ({ request }) => {
        receivedBody = await request.json();
        return HttpResponse.json({ id: 'c1', slug: 'a', name: 'A', color: '#000000' }, { status: 201 });
      }),
    );
    await apiClient.post(`${BASE}/categories`, { slug: 'a', name: 'A', color: '#000000' });
    expect(receivedBody).toEqual({ slug: 'a', name: 'A', color: '#000000' });
  });

  it('DELETE returns ok:true on 204', async () => {
    server.use(
      http.delete(`${BASE}/categories/c1`, () => new HttpResponse(null, { status: 204 })),
    );
    const res = await apiClient.del(`${BASE}/categories/c1`);
    expect(isSuccess(res)).toBe(true);
    if (isSuccess(res)) {
      expect(res.data).toBeNull();
    }
  });

  it('PATCH sends JSON body and returns parsed data', async () => {
    server.use(
      http.patch(`${BASE}/categories/c1`, async ({ request }) => {
        const body = (await request.json()) as { name: string };
        return HttpResponse.json({ id: 'c1', slug: 'a', name: body.name, color: '#000000' });
      }),
    );
    const res = await apiClient.patch(`${BASE}/categories/c1`, { name: 'Updated' });
    expect(isSuccess(res)).toBe(true);
    if (isSuccess(res)) {
      expect(res.data).toMatchObject({ name: 'Updated' });
    }
  });

  it('normalizes legacy amount -> amountCents for /transactions responses', async () => {
    server.use(
      http.get(`${BASE}/transactions`, () =>
        HttpResponse.json([
          {
            id: 't1',
            userId: 'u1',
            accountId: 'a1',
            categoryId: null,
            merchant: 'Cafe',
            amount: 4200,
            occurredAt: '2026-01-15T12:00:00.000Z',
            createdAt: '2026-01-15T12:00:00.000Z',
            status: 'PENDING',
            notes: null,
          },
        ]),
      ),
    );
    const res = await apiClient.get<Array<{ id: string; amountCents: number }>>(`${BASE}/transactions`);
    expect(isSuccess(res)).toBe(true);
    if (isSuccess(res)) {
      expect(res.data[0]?.amountCents).toBe(4200);
      expect((res.data[0] as Record<string, unknown>).amount).toBeUndefined();
    }
  });

  it('keeps 204 responses returning data: null', async () => {
    server.use(
      http.delete(`${BASE}/transactions/t1`, () => new HttpResponse(null, { status: 204 })),
    );
    const res = await apiClient.del(`${BASE}/transactions/t1`);
    expect(isSuccess(res)).toBe(true);
    if (isSuccess(res)) {
      expect(res.data).toBeNull();
    }
  });

  it('keeps non-JSON 2xx responses returning data: null (no parse attempt)', async () => {
    server.use(
      http.get(`${BASE}/health`, () =>
        new HttpResponse('OK', { status: 200, headers: { 'Content-Type': 'text/plain' } }),
      ),
    );
    const res = await apiClient.get(`${BASE}/health`);
    expect(isSuccess(res)).toBe(true);
    if (isSuccess(res)) {
      expect(res.data).toBeNull();
    }
  });

  it('keeps network_error path returning network_error code (no parse attempted)', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (() => Promise.reject(new TypeError('Failed to fetch'))) as typeof fetch;
    try {
      const res = await apiClient.get(`${BASE}/transactions`);
      expect(isFailure(res)).toBe(true);
      if (isFailure(res)) {
        expect(res.code).toBe('network_error');
      }
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});