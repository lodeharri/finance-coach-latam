import { describe, expect, it } from 'vitest';
import { assertCanActAs, assertIsAdmin } from './authorization';

describe('assertIsAdmin', () => {
  it('returns void when the actor has the admin role', () => {
    const result = assertIsAdmin({ userId: 'admin-1', role: 'admin' });
    expect(result).toBeUndefined();
  });

  it('throws a Forbidden error when the actor has the user role', () => {
    expect(() => assertIsAdmin({ userId: 'user-1', role: 'user' })).toThrow(
      'Forbidden: admin role required',
    );
  });
});

describe('assertCanActAs', () => {
  it('returns void when an admin acts on another user', () => {
    expect(
      assertCanActAs({ userId: 'admin-1', role: 'admin' }, 'user-2'),
    ).toBeUndefined();
  });

  it('returns void when a user acts on their own resource', () => {
    expect(
      assertCanActAs({ userId: 'user-1', role: 'user' }, 'user-1'),
    ).toBeUndefined();
  });

  it('throws a Forbidden error when a user acts on another user', () => {
    expect(() =>
      assertCanActAs({ userId: 'user-1', role: 'user' }, 'user-2'),
    ).toThrow('Forbidden');
  });
});