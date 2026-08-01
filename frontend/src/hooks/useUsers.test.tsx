/**
 * useUsers hook tests (REQ-FFC-USR-LIST-ADMIN, REQ-FFC-TDD-INTEGRATION).
 *
 * TanStack Query bindings + joinUrl URL construction.
 */
import { render, screen, waitFor } from '@/test/test-utils';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/setup';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useUsers } from './useUsers';
import { sessionStore } from '@/stores/sessionStore';

const BASE = 'https://api.example.test/';

function Probe() {
  const list = useUsers({ apiBaseUrl: BASE });
  return (
    <div>
      <span data-testid="pending">{String(list.isPending)}</span>
      <span data-testid="count">{list.data?.length ?? 0}</span>
    </div>
  );
}

function wrap(node: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={client}>{node}</QueryClientProvider>);
}

describe('useUsers', () => {
  beforeEach(() => {
    sessionStore.getState().setSession({
      idToken: 'jwt',
      refreshToken: 'r',
      expiresAt: Date.now() + 600_000,
      userId: 'u1',
      email: 'admin@b.com',
      role: 'admin',
    });
    server.resetHandlers();
  });

  afterEach(() => {
    sessionStore.getState().clear();
    localStorage.clear();
  });

  it('fetches users with single-slash URL', async () => {
    let hit = '';
    server.use(
      http.get('https://api.example.test/users', ({ request }) => {
        hit = request.url;
        return HttpResponse.json([]);
      }),
    );

    wrap(<Probe />);
    await waitFor(() => expect(hit).toBe('https://api.example.test/users'));
    expect(hit).not.toContain('//users');
  });

  it('returns the user list when the API returns rows', async () => {
    server.use(
      http.get('https://api.example.test/users', () =>
        HttpResponse.json([
          { id: 'u1', email: 'a@b.com', name: 'A', tier: 'GOLD', createdAt: new Date().toISOString() },
          { id: 'u2', email: 'c@d.com', name: 'C', tier: 'BRONZE', createdAt: new Date().toISOString() },
        ]),
      ),
    );

    wrap(<Probe />);
    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('2'));
  });
});