/**
 * sessionStore — Zustand slice for the Cognito session.
 *
 * Persists idToken, refreshToken, expiresAt, userId, email, role to localStorage
 * so a page reload keeps the user signed in.
 *
 * The SPA never re-validates the JWT — the API Gateway's HttpJwtAuthorizer has
 * already done that. We just read identity claims out of the token for UI.
 *
 * Role is resolved from `cognito:groups`: `admins` -> 'admin', `users` -> 'user',
 * anything else (or absent) -> undefined (the API will reject with 401).
 */
import { create } from 'zustand';

export type Role = 'admin' | 'user';

export interface SessionState {
  idToken?: string | undefined;
  refreshToken?: string | undefined;
  expiresAt?: number | undefined;
  userId?: string | undefined;
  email?: string | undefined;
  role?: Role | undefined;
}

export interface SessionStore extends SessionState {
  setSession: (next: SessionState) => void;
  clear: () => void;
  roleFromGroups: (groups: readonly string[]) => Role | undefined;
}

const STORAGE_KEY = 'finance-coach-latam:session';

function readPersisted(): SessionState {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as SessionState;
    return parsed;
  } catch {
    return {};
  }
}

function persist(state: SessionState) {
  if (typeof window === 'undefined') return;
  if (state.idToken) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } else {
    window.localStorage.removeItem(STORAGE_KEY);
  }
}

const EMPTY_STATE: SessionState = {};

export const sessionStore = create<SessionStore>((set) => ({
  ...readPersisted(),
  setSession: (next) => {
    persist(next);
    set(next);
  },
  clear: () => {
    persist(EMPTY_STATE);
    // Explicit field reset — Zustand merges shallowly, so setting {} leaves
    // existing fields. exactOptionalPropertyTypes forbids us from passing
    // `{idToken: undefined, ...}` so we drop to undefined via `delete` semantics
    // by setting each field one at a time inside a single object spread.
    set((s) => ({
      ...s,
      idToken: undefined,
      refreshToken: undefined,
      expiresAt: undefined,
      userId: undefined,
      email: undefined,
      role: undefined,
    }));
  },
  roleFromGroups: (groups) => {
    if (groups.includes('admins')) return 'admin';
    if (groups.includes('users')) return 'user';
    return undefined;
  },
}));

// Convenience getter for non-React consumers (apiClient, services).
export const getSession = () => sessionStore.getState();