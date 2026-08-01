/**
 * LoginPage — Litografía del Sur.
 *
 * Renders email/password FormFields inside AuthShell. Calls useAuth.login on submit.
 * Surfaces inline error from Cognito on failure (REQ-FF-AUTH-SESSION).
 * On success, navigates to /dashboard via React Router.
 *
 * Pages are the only router-aware layer (REQ-FF-ATOMS-BOUNDARY).
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthShell } from '@/templates/AuthShell';
import { FormField } from '@/molecules/FormField';
import { Button } from '@/atoms/Button';
import { useAuth } from '@/hooks/useAuth';

export interface LoginPageEnv {
  VITE_COGNITO_USER_POOL_CLIENT_ID: string;
  VITE_COGNITO_REGION: string;
  VITE_API_BASE_URL: string;
}

export interface LoginPageProps {
  env: LoginPageEnv;
}

export function LoginPage({ env }: LoginPageProps) {
  const auth = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    try {
      await auth.login({
        email,
        password,
        clientId: env.VITE_COGNITO_USER_POOL_CLIENT_ID,
        region: env.VITE_COGNITO_REGION,
      });
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    }
  };

  return (
    <AuthShell title="Sign in">
      <form onSubmit={onSubmit} className="flex flex-col gap-4" data-testid="login-form">
        <FormField
          id="email"
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="username"
        />
        <FormField
          id="password"
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
        />
        {error ? (
          <p
            role="alert"
            data-testid="login-error"
            className="font-body text-sm text-ink-negativo"
          >
            {error}
          </p>
        ) : null}
        <Button type="submit" disabled={auth.status === 'authenticating'} data-testid="login-submit">
          {auth.status === 'authenticating' ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </AuthShell>
  );
}