/**
 * LoginPage — Litografía del Sur.
 *
 * Renders email/password FormFields inside AuthShell. Calls useAuth.login on submit.
 * Surfaces inline error from Cognito on failure (REQ-FF-AUTH-SESSION).
 * On success, navigates to /dashboard via React Router.
 *
 * Cognito's `AdminCreateUserCommand` with `TemporaryPassword` puts a freshly
 * created user into the FORCE_CHANGE_PASSWORD state. The first sign-in of that
 * user returns `ChallengeName: NEW_PASSWORD_REQUIRED` instead of
 * `AuthenticationResult`. We detect that and transform the same page into a
 * "Set new password" form, then call Cognito's `RespondToAuthChallenge` to
 * finish the flow. No new route is added.
 *
 * Pages are the only router-aware layer (REQ-FF-ATOMS-BOUNDARY).
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthShell } from '@/templates/AuthShell';
import { FormField } from '@/molecules/FormField';
import { Button } from '@/atoms/Button';
import { authService } from '@/services/auth';

export interface LoginPageEnv {
  VITE_COGNITO_USER_POOL_CLIENT_ID: string;
  VITE_COGNITO_REGION: string;
  VITE_API_BASE_URL: string;
}

export interface LoginPageProps {
  env: LoginPageEnv;
}

interface ChallengeState {
  session: string;
  email: string;
}

// Mirrors infra/lib/finance-coach-stack.ts passwordPolicy:
//   minLength: 8, requireDigits: true, requireSymbols: true.
function validatePasswordPolicy(pw: string): string | null {
  if (pw.length < 8) {
    return 'La contraseña debe tener al menos 8 caracteres.';
  }
  if (!/\d/.test(pw)) {
    return 'La contraseña debe incluir al menos un dígito.';
  }
  if (!/[^A-Za-z0-9]/.test(pw)) {
    return 'La contraseña debe incluir al menos un símbolo.';
  }
  return null;
}

export function LoginPage({ env }: LoginPageProps) {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [challenge, setChallenge] = useState<ChallengeState | null>(null);

  const onLoginSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await authService.login({
        email,
        password,
        clientId: env.VITE_COGNITO_USER_POOL_CLIENT_ID,
        region: env.VITE_COGNITO_REGION,
      });
      if (result && result.kind === 'NEW_PASSWORD_REQUIRED') {
        setChallenge({ session: result.session, email: result.email });
        setPassword('');
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setSubmitting(false);
    }
  };

  const onNewPasswordSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!challenge) return;
    setError(null);
    if (newPassword !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    const policyError = validatePasswordPolicy(newPassword);
    if (policyError) {
      setError(policyError);
      return;
    }
    setSubmitting(true);
    try {
      await authService.completeNewPasswordChallenge({
        email: challenge.email,
        session: challenge.session,
        newPassword,
        clientId: env.VITE_COGNITO_USER_POOL_CLIENT_ID,
        region: env.VITE_COGNITO_REGION,
      });
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cambiar la contraseña.');
    } finally {
      setSubmitting(false);
    }
  };

  const cancelChallenge = () => {
    setChallenge(null);
    setNewPassword('');
    setConfirmPassword('');
    setError(null);
  };

  if (challenge) {
    return (
      <AuthShell title="Elegí tu nueva contraseña">
        <form
          onSubmit={onNewPasswordSubmit}
          noValidate
          className="flex flex-col gap-5"
          data-testid="new-password-form"
        >
          <p className="font-body text-sm text-ink-tinta-soft" data-testid="new-password-intro">
            Tu cuenta fue creada con una contraseña temporal. Elegí una nueva para continuar.
          </p>
          <FormField
            id="new-password"
            label="Nueva contraseña"
            type="password"
            variant="editorial"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            autoComplete="new-password"
          />
          <FormField
            id="confirm-password"
            label="Confirmar contraseña"
            type="password"
            variant="editorial"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            autoComplete="new-password"
          />
          {error ? (
            <p role="alert" data-testid="login-error" className="font-body text-sm text-ink-negativo">
              {error}
            </p>
          ) : null}
          <Button
            type="submit"
            disabled={submitting}
            data-testid="new-password-submit"
          >
            {submitting ? 'Cambiando…' : 'Cambiar contraseña'}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={cancelChallenge}
            disabled={submitting}
            data-testid="new-password-cancel"
          >
            Cancelar
          </Button>
        </form>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Iniciar sesión">
      <form onSubmit={onLoginSubmit} noValidate className="flex flex-col gap-5" data-testid="login-form">
        <FormField
          id="email"
          label="Correo"
          type="email"
          variant="editorial"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="username"
        />
        <FormField
          id="password"
          label="Contraseña"
          type="password"
          variant="editorial"
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
        <Button type="submit" disabled={submitting} data-testid="login-submit">
          {submitting ? 'Ingresando…' : 'Iniciar sesión'}
        </Button>
      </form>
    </AuthShell>
  );
}
