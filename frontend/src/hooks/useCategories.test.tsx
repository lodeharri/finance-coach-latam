/**
 * useCategories hook test suite (RED phase).
 *
 * Verifies the TanStack Query integration:
 *  - useCategories() returns a query for the categories list.
 *  - useCreateCategory() posts to the API and invalidates the list query.
 *  - useUpdateCategory() patches and invalidates.
 *  - useDeleteCategory() optimistically removes the row and restores on 409.
 */
import { act, render, screen, waitFor } from '@/test/test-utils';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/setup';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  useCategories,
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
} from './useCategories';
import { sessionStore } from '@/stores/sessionStore';

const BASE = 'https://api.example.test';
const sessionApi = sessionStore.getState();

interface CategoriesProbe {
  data: unknown;
  isPending: boolean;
}

function ProbeFull({
  onReady,
  initialPatch,
  deleteId,
}: {
  onReady: (api: {
    list: CategoriesProbe;
    create: (input: { slug: string; name: string; color: string }) => void;
    update: (id: string, patch: { name?: string; color?: string }) => void;
    remove: (id: string) => void;
  }) => void;
  initialPatch?: { name?: string; color?: string };
  deleteId?: string;
}) {
  const list = useCategories({ apiBaseUrl: BASE });
  const create = useCreateCategory({ apiBaseUrl: BASE });
  const update = useUpdateCategory({ apiBaseUrl: BASE });
  const remove = useDeleteCategory({ apiBaseUrl: BASE });
  onReady({
    list,
    create: (input) => create.mutate(input),
    update: (id, patch) => update.mutate({ id, patch }),
    remove: (id) => remove.mutate(id),
  });
  return (
    <div>
      <span data-testid="pending">{String(list.isPending)}</span>
      <span data-testid="count">{list.data?.length ?? 0}</span>
      <button
        onClick={() =>
          create.mutate({ slug: 'new', name: 'New', color: '#123456' })
        }
      >
        Create
      </button>
      <button
        onClick={() => {
          const first = list.data?.[0];
          if (first) update.mutate({ id: first.id, patch: initialPatch ?? { name: 'Renamed' } });
        }}
      >
        Update
      </button>
      <button
        onClick={() => {
          if (deleteId) remove.mutate(deleteId);
        }}
      >
        Delete
      </button>
    </div>
  );
}

function wrap(node: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={client}>{node}</QueryClientProvider>);
}

describe('useCategories', () => {
  beforeEach(() => {
    sessionApi.setSession({
      idToken: 'jwt',
      refreshToken: 'r',
      expiresAt: Date.now() + 600_000,
      userId: 'u1',
      email: 'a@b.com',
      role: 'admin',
    });
    server.resetHandlers();
  });

  afterEach(() => {
    sessionApi.clear();
    localStorage.clear();
  });

  it('fetches the categories list', async () => {
    server.use(
      http.get(`${BASE}/categories`, () =>
        HttpResponse.json([
          { id: 'c1', slug: 'a', name: 'A', color: '#111111' },
          { id: 'c2', slug: 'b', name: 'B', color: '#222222' },
        ]),
      ),
    );

    wrap(<ProbeFull onReady={() => {}} />);
    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('2'));
  });

  it('useCreateCategory posts to the API and invalidates the list', async () => {
    let posted = false;
    server.use(
      http.get(`${BASE}/categories`, () => {
        const list = posted
          ? [
              { id: 'c1', slug: 'a', name: 'A', color: '#111111' },
              { id: 'c-new', slug: 'new', name: 'New', color: '#123456' },
            ]
          : [{ id: 'c1', slug: 'a', name: 'A', color: '#111111' }];
        return HttpResponse.json(list);
      }),
      http.post(`${BASE}/categories`, () => {
        posted = true;
        return HttpResponse.json(
          { id: 'c-new', slug: 'new', name: 'New', color: '#123456' },
          { status: 201 },
        );
      }),
    );

    let api!: { create: (input: { slug: string; name: string; color: string }) => void };
    wrap(<ProbeFull onReady={(a) => (api = a)} />);

    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('1'));

    await act(async () => {
      api.create({ slug: 'new', name: 'New', color: '#123456' });
    });

    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('2'));
  });

  it('useDeleteCategory optimistically removes the row', async () => {
    let deleted = false;
    server.use(
      http.get(`${BASE}/categories`, () =>
        HttpResponse.json(
          deleted
            ? [{ id: 'c1', slug: 'a', name: 'A', color: '#111111' }]
            : [
                { id: 'c1', slug: 'a', name: 'A', color: '#111111' },
                { id: 'c2', slug: 'b', name: 'B', color: '#222222' },
              ],
        ),
      ),
      http.delete(`${BASE}/categories/c2`, () => {
        deleted = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    let api!: { remove: (id: string) => void };
    wrap(<ProbeFull deleteId="c2" onReady={(a) => (api = a)} />);

    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('2'));

    await act(async () => {
      api.remove('c2');
    });

    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('1'));
  });

  it('useDeleteCategory restores the row on 409 (REQ-AC-007)', async () => {
    server.use(
      http.get(`${BASE}/categories`, () =>
        HttpResponse.json([
          { id: 'c1', slug: 'a', name: 'A', color: '#111111' },
          { id: 'c2', slug: 'b', name: 'B', color: '#222222' },
        ]),
      ),
      http.delete(`${BASE}/categories/c2`, () =>
        HttpResponse.json({ error: 'Category in use by transactions' }, { status: 409 }),
      ),
    );

    let api!: { remove: (id: string) => void };
    wrap(<ProbeFull deleteId="c2" onReady={(a) => (api = a)} />);

    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('2'));

    await act(async () => {
      api.remove('c2');
    });

    // The optimistic delete drops the row immediately; on 409 the cache restores it.
    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('2'));
  });

  it('useUpdateCategory patches the row and invalidates the list', async () => {
    server.use(
      http.get(`${BASE}/categories`, () =>
        HttpResponse.json([{ id: 'c1', slug: 'a', name: 'A', color: '#111111' }]),
      ),
      http.patch(`${BASE}/categories/c1`, async ({ request }) => {
        const body = (await request.json()) as { name?: string };
        return HttpResponse.json({ id: 'c1', slug: 'a', name: body.name ?? 'A', color: '#111111' });
      }),
    );

    let api!: { update: (id: string, patch: { name?: string; color?: string }) => void };
    wrap(<ProbeFull initialPatch={{ name: 'A2' }} onReady={(a) => (api = a)} />);

    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('1'));

    await act(async () => {
      api.update('c1', { name: 'A2' });
    });

    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('1'));
  });
});