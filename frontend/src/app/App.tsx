/**
 * App.tsx — bootstraps QueryClientProvider + RouterProvider.
 *
 * Reads VITE_* env from import.meta.env (Vite's typed client env) at runtime.
 * `VITE_API_BASE_URL` is required and fails fast at startup when missing —
 * the SPA would otherwise fall back to a localhost URL that no real backend
 * serves. The two Cognito vars keep their safe defaults because they are
 * optional in dev (mock auth) and only matter once real auth is wired.
 * For tests, the env is passed explicitly to LoginPage via props.
 */
import { useMemo } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';
import { createAppRouter } from './router';

export interface AppProps {
  /** Allow tests to inject env; production reads from import.meta.env. */
  envOverride?: {
    VITE_API_BASE_URL: string;
    VITE_COGNITO_USER_POOL_CLIENT_ID?: string;
    VITE_COGNITO_REGION?: string;
  };
}

function requireEnv(name: 'VITE_API_BASE_URL'): string {
  const value = import.meta.env[name];
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(
      `[App] Missing required env var ${name}. ` +
      `Copy frontend/.env.example to frontend/.env.local and set it. ` +
      `For deployed environments, the value is injected by .github/workflows/deploy-*.yml.`,
    );
  }
  return value;
}

function readEnv(): AppProps['envOverride'] {
  // import.meta.env is provided by Vite. Fail fast on the API URL; defaults
  // remain for the optional Cognito vars (see header comment).
  return {
    VITE_API_BASE_URL: requireEnv('VITE_API_BASE_URL'),
    VITE_COGNITO_USER_POOL_CLIENT_ID:
      import.meta.env.VITE_COGNITO_USER_POOL_CLIENT_ID ?? 'test-client-id',
    VITE_COGNITO_REGION: import.meta.env.VITE_COGNITO_REGION ?? 'us-east-1',
  };
}

export function App({ envOverride }: AppProps = {}) {
  const env = envOverride ?? readEnv();
  const client = useMemo(
    () =>
      new QueryClient({
        defaultOptions: { queries: { retry: 1 }, mutations: { retry: 0 } },
      }),
    [],
  );
  const router = useMemo(() => createAppRouter(env!), [env]);
  return (
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}
