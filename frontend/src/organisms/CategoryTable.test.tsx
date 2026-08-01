/**
 * CategoryTable organism test suite (RED phase).
 *
 * Lists categories via useCategories. Each row shows a CategoryPill + Delete button.
 * On 409 from delete, surfaces inline conflict message and restores the row.
 */
import { act, render, screen, waitFor } from '@/test/test-utils';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/setup';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CategoryTable } from './CategoryTable';
import { sessionStore } from '@/stores/sessionStore';

const BASE = 'https://api.example.test';
const sessionApi = sessionStore.getState();

function wrap(node: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={client}>{node}</QueryClientProvider>);
}

describe('CategoryTable', () => {
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
    vi.restoreAllMocks();
  });

  it('renders a list of categories from the API', async () => {
    server.use(
      http.get(`${BASE}/categories`, () =>
        HttpResponse.json([
          { id: 'c1', slug: 'groceries', name: 'Groceries', color: '#1F3FB8' },
          { id: 'c2', slug: 'dining', name: 'Dining', color: '#E8D8B0' },
        ]),
      ),
    );
    wrap(<CategoryTable apiBaseUrl={BASE} />);
    expect(await screen.findByText('Groceries')).toBeInTheDocument();
    expect(screen.getByText('Dining')).toBeInTheDocument();
  });

  it('renders an empty-state when the list is empty', async () => {
    server.use(http.get(`${BASE}/categories`, () => HttpResponse.json([])));
    wrap(<CategoryTable apiBaseUrl={BASE} />);
    expect(await screen.findByText(/aún no hay categorías/i)).toBeInTheDocument();
  });

  it('renders a loading state while fetching', () => {
    server.use(
      http.get(`${BASE}/categories`, async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return HttpResponse.json([]);
      }),
    );
    wrap(<CategoryTable apiBaseUrl={BASE} />);
    // Loading state shows the Spinner atom — its role is 'status'.
    expect(screen.getAllByRole('status')[0]).toBeInTheDocument();
  });

  it('clicking Eliminar removes the row (optimistic) and confirms 204 success', async () => {
    let deleted = false;
    server.use(
      http.get(`${BASE}/categories`, () =>
        HttpResponse.json(
          deleted
            ? [{ id: 'c1', slug: 'groceries', name: 'Groceries', color: '#1F3FB8' }]
            : [
                { id: 'c1', slug: 'groceries', name: 'Groceries', color: '#1F3FB8' },
                { id: 'c2', slug: 'dining', name: 'Dining', color: '#E8D8B0' },
              ],
        ),
      ),
      http.delete(`${BASE}/categories/c2`, () => {
        deleted = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    wrap(<CategoryTable apiBaseUrl={BASE} />);
    await screen.findByText('Groceries');
    const diningDelete = screen.getAllByRole('button', { name: /eliminar/i })[1]!;
    await act(async () => {
      diningDelete.click();
    });
    await waitFor(() => expect(screen.queryByText('Dining')).not.toBeInTheDocument());
  });

  it('restores the row and shows inline conflict message on 409', async () => {
    server.use(
      http.get(`${BASE}/categories`, () =>
        HttpResponse.json([
          { id: 'c1', slug: 'groceries', name: 'Groceries', color: '#1F3FB8' },
          { id: 'c2', slug: 'dining', name: 'Dining', color: '#E8D8B0' },
        ]),
      ),
      http.delete(`${BASE}/categories/c2`, () =>
        HttpResponse.json({ error: 'Category in use by transactions' }, { status: 409 }),
      ),
    );

    wrap(<CategoryTable apiBaseUrl={BASE} />);
    await screen.findByText('Dining');
    const diningDelete = screen.getAllByRole('button', { name: /eliminar/i })[1]!;
    await act(async () => {
      diningDelete.click();
    });
    await waitFor(() => expect(screen.getByText(/in use by transactions/i)).toBeInTheDocument());
    expect(screen.getByText('Dining')).toBeInTheDocument();
  });
});