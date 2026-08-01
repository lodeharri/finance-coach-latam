/**
 * Router — Litografía del Sur.
 *
 * React Router v6 with role-aware guards (REQ-FF-ROLE-SAFE-ROUTING):
 *  - RequireAuth: redirect to /login if no session.
 *  - RequireRole: render ForbiddenPage if role mismatch (NEVER requests admin data).
 *  - 401 from any data loader clears the session and triggers /login redirect.
 */
import {
  createBrowserRouter,
  Navigate,
  Outlet,
  type RouteObject,
} from 'react-router-dom';
import { useSyncExternalStore } from 'react';
import { LoginPage } from '@/pages/LoginPage';
import { ForbiddenPage } from '@/pages/ForbiddenPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { CategoriesAdminPage } from '@/pages/CategoriesAdminPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { TransactionsPage } from '@/pages/TransactionsPage';
import { AccountsPage } from '@/pages/AccountsPage';
import { UsersAdminPage } from '@/pages/UsersAdminPage';
import { InsightsPage } from '@/pages/InsightsPage';
import { sessionStore, type Role } from '@/stores/sessionStore';
import { AppShell } from '@/templates/AppShell';

export interface RouterEnv {
  VITE_API_BASE_URL: string;
  VITE_COGNITO_USER_POOL_CLIENT_ID?: string;
  VITE_COGNITO_REGION?: string;
}

function useSessionSnapshot() {
  // Subscribe to Zustand so RequireAuth/RequireRole re-render on session change.
  return useSyncExternalStore(
    (cb) => sessionStore.subscribe(cb),
    () => sessionStore.getState(),
    () => sessionStore.getState(),
  );
}

function RequireAuth() {
  useSessionSnapshot();
  const session = sessionStore.getState();
  if (!session.idToken || !session.role) return <Navigate to="/login" replace />;
  return <Outlet />;
}

function RequireRole({ role }: { role: Role }) {
  useSessionSnapshot();
  const session = sessionStore.getState();
  if (!session.idToken || !session.role) return <Navigate to="/login" replace />;
  if (session.role !== role) return <ForbiddenPage />;
  return <Outlet />;
}

export function routerConfig({ env }: { env: RouterEnv }) {
  const loginProps = {
    env: {
      VITE_COGNITO_USER_POOL_CLIENT_ID: env.VITE_COGNITO_USER_POOL_CLIENT_ID ?? 'test',
      VITE_COGNITO_REGION: env.VITE_COGNITO_REGION ?? 'us-east-1',
      VITE_API_BASE_URL: env.VITE_API_BASE_URL,
    },
  };

  const routes: RouteObject[] = [
    { path: '/login', element: <LoginPage {...loginProps} /> },
    {
      element: <RequireAuth />,
      children: [
        {
          element: <AppShell />,
          children: [
            { path: '/', element: <Navigate to="/dashboard" replace /> },
            { path: '/dashboard', element: <DashboardPage apiBaseUrl={env.VITE_API_BASE_URL} /> },
            { path: '/transactions', element: <TransactionsPage apiBaseUrl={env.VITE_API_BASE_URL} /> },
            { path: '/accounts', element: <AccountsPage apiBaseUrl={env.VITE_API_BASE_URL} /> },
            { path: '/insights', element: <InsightsPage apiBaseUrl={env.VITE_API_BASE_URL} /> },
            {
              // eslint-disable-next-line jsx-a11y/aria-role -- `role` is a regular prop, not an ARIA role
              element: <RequireRole role="admin" />,
              children: [
                {
                  path: '/admin/categories',
                  element: <CategoriesAdminPage apiBaseUrl={env.VITE_API_BASE_URL} />,
                },
                {
                  path: '/admin/users',
                  element: <UsersAdminPage apiBaseUrl={env.VITE_API_BASE_URL} />,
                },
              ],
            },
            { path: '*', element: <NotFoundPage /> },
          ],
        },
      ],
    },
  ];
  return routes;
}

export function createAppRouter(env: RouterEnv) {
  return createBrowserRouter(routerConfig({ env }));
}