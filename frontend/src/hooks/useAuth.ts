/**
 * useAuth — React-friendly wrapper around authService.
 *
 * Exposes:
 *  - status: 'idle' | 'authenticating' | 'authenticated' | 'error'
 *  - role: 'admin' | 'user' | undefined
 *  - userId, email
 *  - error: string | null
 *  - login(args), logout(), refreshIfNeeded(args)
 */
import { useCallback, useEffect, useState } from 'react';
import { authService } from '@/services/auth';
import { sessionStore, type Role } from '@/stores/sessionStore';

export interface LoginArgs {
  email: string;
  password: string;
  clientId: string;
  region: string;
}

export interface RefreshArgs {
  clientId: string;
  region: string;
}

export type AuthStatus = 'idle' | 'authenticating' | 'authenticated' | 'error';

export interface UseAuth {
  status: AuthStatus;
  role: Role | undefined;
  userId: string | undefined;
  email: string | undefined;
  error: string | null;
  login: (args: LoginArgs) => Promise<void>;
  logout: () => void;
  refreshIfNeeded: (args: RefreshArgs) => Promise<void>;
}

export function useAuth(): UseAuth {
  const [status, setStatus] = useState<AuthStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0); // re-read after session changes

  // Subscribe to session changes so we reflect the current role/idToken.
  useEffect(() => {
    const unsub = sessionStore.subscribe(() => setTick((t) => t + 1));
    return unsub;
  }, []);

  const session = sessionStore.getState();
  const isAuthed = Boolean(session.idToken) && Boolean(session.userId) && Boolean(session.role);

  // Derive `status` from session shape on each tick.
  const effectiveStatus: AuthStatus = (() => {
    if (status === 'authenticating') return 'authenticating';
    if (status === 'error') return 'error';
    if (isAuthed) return 'authenticated';
    return 'idle';
  })();

  const login = useCallback(async (args: LoginArgs) => {
    setStatus('authenticating');
    setError(null);
    try {
      await authService.login(args);
      setStatus('authenticated');
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Login failed');
      throw err;
    }
  }, []);

  const logout = useCallback(() => {
    authService.logout();
    setStatus('idle');
    setError(null);
  }, []);

  const refreshIfNeeded = useCallback(async (args: RefreshArgs) => {
    if (!isAuthed) return;
    try {
      await authService.refreshIfNeeded(args);
    } catch {
      // Refresh failed — clear and let the next 401 drive /login.
      authService.logout();
      setStatus('idle');
    }
  }, [isAuthed]);

  // Reference tick to silence lint warnings about unused state; subscription keeps us fresh.
  void tick;

  return {
    status: effectiveStatus,
    role: session.role,
    userId: session.userId,
    email: session.email,
    error,
    login,
    logout,
    refreshIfNeeded,
  };
}