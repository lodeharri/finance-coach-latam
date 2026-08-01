/**
 * App.tsx — bootstraps QueryClientProvider + RouterProvider.
 *
 * Reads VITE_* env from import.meta.env (Vite's typed client env) at runtime.
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

function readEnv(): AppProps['envOverride'] {
  // import.meta.env is provided by Vite. Fall back to defaults for safety.
  return {
    VITE_API_BASE_URL: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000',
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