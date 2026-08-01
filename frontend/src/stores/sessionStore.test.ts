/**
 * sessionStore test suite (RED phase).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { sessionStore } from './sessionStore';

const sessionApi = sessionStore.getState();

describe('sessionStore', () => {
  beforeEach(() => {
    sessionApi.clear();
    localStorage.clear();
  });

  afterEach(() => {
    sessionApi.clear();
    localStorage.clear();
  });

  it('starts empty', () => {
    const s = sessionStore.getState();
    expect(s.idToken).toBeUndefined();
    expect(s.role).toBeUndefined();
    expect(s.email).toBeUndefined();
  });

  it('setSession stores tokens and identity', () => {
    sessionApi.setSession({
      idToken: 'abc',
      refreshToken: 'refresh-abc',
      expiresAt: 12345,
      userId: 'u1',
      email: 'a@b.com',
      role: 'user',
    });
    const s = sessionStore.getState();
    expect(s.idToken).toBe('abc');
    expect(s.refreshToken).toBe('refresh-abc');
    expect(s.expiresAt).toBe(12345);
    expect(s.userId).toBe('u1');
    expect(s.email).toBe('a@b.com');
    expect(s.role).toBe('user');
  });

  it('setSession persists to localStorage so reloads keep the session', () => {
    sessionApi.setSession({
      idToken: 'abc',
      refreshToken: 'refresh-abc',
      expiresAt: 12345,
      userId: 'u1',
      email: 'a@b.com',
      role: 'admin',
    });
    const raw = localStorage.getItem('finance-coach-latam:session');
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!) as Record<string, unknown>;
    expect(parsed.idToken).toBe('abc');
    expect(parsed.role).toBe('admin');
  });

  it('clear() removes all session fields', () => {
    sessionApi.setSession({
      idToken: 'abc',
      refreshToken: 'refresh-abc',
      expiresAt: 12345,
      userId: 'u1',
      email: 'a@b.com',
      role: 'user',
    });
    sessionApi.clear();
    expect(sessionStore.getState().idToken).toBeUndefined();
    expect(sessionStore.getState().role).toBeUndefined();
  });

  it('clear() removes the localStorage entry', () => {
    sessionApi.setSession({
      idToken: 'abc',
      refreshToken: 'refresh-abc',
      expiresAt: 12345,
      userId: 'u1',
      email: 'a@b.com',
      role: 'user',
    });
    sessionApi.clear();
    expect(localStorage.getItem('finance-coach-latam:session')).toBeNull();
  });

  it('resolves role from cognito:groups admins', () => {
    const role = sessionApi.roleFromGroups(['admins']);
    expect(role).toBe('admin');
  });

  it('resolves role from cognito:groups users', () => {
    const role = sessionApi.roleFromGroups(['users']);
    expect(role).toBe('user');
  });

  it('returns admin when both admins and other groups present', () => {
    expect(sessionApi.roleFromGroups(['admins', 'beta-testers'])).toBe('admin');
    expect(sessionApi.roleFromGroups(['users', 'beta-testers'])).toBe('user');
  });

  it('returns undefined when no recognized group is present', () => {
    expect(sessionApi.roleFromGroups(['beta-testers'])).toBeUndefined();
    expect(sessionApi.roleFromGroups([])).toBeUndefined();
  });
});