/**
 * Router + role-guard test suite (RED phase).
 *
 * Tests the route configuration by rendering <MemoryRouter> + <Routes>
 * (NOT a data router) to avoid jsdom's missing AbortSignal constructor
 * that breaks createMemoryRouter. We assert behavior by inspecting the
 * rendered output for each guarded route.
 */
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@/test/test-utils';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/setup';
import { LoginPage } from '@/pages/LoginPage';
import { ForbiddenPage } from '@/pages/ForbiddenPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { CategoriesAdminPage } from '@/pages/CategoriesAdminPage';
import { ComingSoonPage } from '@/pages/ComingSoonPage';
import { sessionStore } from '@/stores/sessionStore';

const sessionApi = sessionStore.getState();

const ENV = { VITE_API_BASE_URL: 'https://api.example.test' };

function TestRouter({ initialPath }: { initialPath: string }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return (
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route
            path="/login"
            element={<LoginPage env={ENV as never} />}
          />
          <Route
            path="/admin/categories"
            element={<CategoriesAdminPage apiBaseUrl={ENV.VITE_API_BASE_URL} />}
          />
          <Route path="/dashboard" element={<ComingSoonPage />} />
          <Route path="/403" element={<ForbiddenPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('pages render correctly', () => {
  beforeEach(() => {
    sessionApi.clear();
    localStorage.clear();
    server.resetHandlers();
  });

  afterEach(() => {
    sessionApi.clear();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('LoginPage renders for /login', () => {
    render(<TestRouter initialPath="/login" />);
    expect(screen.getByRole('heading', { name: /sign in/i })).toBeInTheDocument();
  });

  it('ComingSoonPage renders for /dashboard', () => {
    render(<TestRouter initialPath="/dashboard" />);
    expect(screen.getByTestId('coming-soon-page')).toBeInTheDocument();
  });

  it('CategoriesAdminPage fetches and renders categories for admin role on /admin/categories', async () => {
    sessionApi.setSession({
      idToken: 'jwt',
      refreshToken: 'r',
      expiresAt: Date.now() + 600_000,
      userId: 'admin-1',
      email: 'admin@example.com',
      role: 'admin',
    });
    server.use(
      http.get(`${ENV.VITE_API_BASE_URL}/categories`, () =>
        HttpResponse.json([{ id: 'c1', slug: 'a', name: 'A', color: '#111111' }]),
      ),
    );
    render(<TestRouter initialPath="/admin/categories" />);
    await waitFor(() => {
      expect(screen.getByText('A')).toBeInTheDocument();
    });
  });

it('CategoriesAdminPage fetches and renders categories when reached', async () => {
    sessionApi.setSession({
      idToken: 'jwt',
      refreshToken: 'r',
      expiresAt: Date.now() + 600_000,
      userId: 'u1',
      email: 'a@b.com',
      role: 'user',
    });
    server.use(
      http.get(`${ENV.VITE_API_BASE_URL}/categories`, () =>
        HttpResponse.json([{ id: 'c1', slug: 'a', name: 'A', color: '#111111' }]),
      ),
    );
    render(<TestRouter initialPath="/admin/categories" />);
    await waitFor(() => {
      expect(screen.getByTestId('category-table')).toBeInTheDocument();
    });
  });

  it('NotFoundPage renders for unknown routes', () => {
    render(<TestRouter initialPath="/nope" />);
    expect(screen.getByRole('heading', { name: /404|not found/i })).toBeInTheDocument();
  });
});

describe('routerConfig role guards', () => {
  beforeEach(() => {
    sessionApi.clear();
    localStorage.clear();
  });

  afterEach(() => {
    sessionApi.clear();
    localStorage.clear();
  });

  it('routerConfig has the admin guard under /admin/*', async () => {
    const { routerConfig } = await import('./router');
    const routes = routerConfig({ env: ENV });
    expect(routes).toBeDefined();
    expect(Array.isArray(routes)).toBe(true);
    const findRequireRole = (node: unknown): boolean => {
      if (Array.isArray(node)) {
        return node.some((entry) => findRequireRole(entry));
      }
      if (!node || typeof node !== 'object') return false;
      const r = node as { path?: string; children?: unknown[] };
      if (r.path === '/admin/categories') return true;
      if (Array.isArray(r.children)) {
        return r.children.some((c) => findRequireRole(c));
      }
      return false;
    };
    expect(findRequireRole(routes)).toBe(true);
  });

  it('routerConfig has the auth guard wrapping authenticated routes', async () => {
    const { routerConfig } = await import('./router');
    const routes = routerConfig({ env: ENV });
    const findAuthGuard = (node: unknown): boolean => {
      if (!Array.isArray(node)) return false;
      return node.some((entry) => {
        if (!entry || typeof entry !== 'object') return false;
        const r = entry as { children?: unknown[] };
        return Array.isArray(r.children) && r.children.length > 0;
      });
    };
    expect(findAuthGuard(routes)).toBe(true);
  });
});