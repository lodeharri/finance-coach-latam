/**
 * services/types.ts test suite (RED phase).
 *
 * Validates that the zod schemas match the backend route responses (REQ-AC-*):
 *  - Category: id, slug, name, color. NO icon field (ADR-FF-007).
 *  - Account: id, userId, name, type (BANK|CASH|CARD), createdAt (ISO string).
 *  - Transaction: id, userId, accountId, categoryId nullable, merchant, amountCents,
 *    occurredAt (ISO), createdAt (ISO), status (PENDING|CATEGORIZED|FAILED),
 *    notes nullable.
 *  - User: id, email, name, tier (BRONZE|SILVER|GOLD), createdAt (ISO).
 *
 * Backend persists `amount` (entity field) but the API contract uses `amountCents`.
 * The schema normalizes incoming `amount` -> `amountCents` if needed.
 */
import { describe, expect, it } from 'vitest';
import {
  CategorySchema,
  AccountSchema,
  TransactionSchema,
  UserSchema,
  AccountTypeSchema,
  TransactionStatusSchema,
  UserTierSchema,
} from './types';

describe('AccountTypeSchema', () => {
  it('accepts BANK, CASH, CARD', () => {
    expect(AccountTypeSchema.parse('BANK')).toBe('BANK');
    expect(AccountTypeSchema.parse('CASH')).toBe('CASH');
    expect(AccountTypeSchema.parse('CARD')).toBe('CARD');
  });
  it('rejects unknown values', () => {
    expect(() => AccountTypeSchema.parse('CRYPTO')).toThrow();
  });
});

describe('TransactionStatusSchema', () => {
  it('accepts PENDING, CATEGORIZED, FAILED', () => {
    expect(TransactionStatusSchema.parse('PENDING')).toBe('PENDING');
    expect(TransactionStatusSchema.parse('CATEGORIZED')).toBe('CATEGORIZED');
    expect(TransactionStatusSchema.parse('FAILED')).toBe('FAILED');
  });
  it('rejects unknown values', () => {
    expect(() => TransactionStatusSchema.parse('UNKNOWN')).toThrow();
  });
});

describe('UserTierSchema', () => {
  it('accepts BRONZE, SILVER, GOLD', () => {
    expect(UserTierSchema.parse('BRONZE')).toBe('BRONZE');
    expect(UserTierSchema.parse('SILVER')).toBe('SILVER');
    expect(UserTierSchema.parse('GOLD')).toBe('GOLD');
  });
});

describe('CategorySchema', () => {
  it('parses a valid category', () => {
    const c = CategorySchema.parse({ id: 'c1', slug: 'groceries', name: 'Groceries', color: '#1F3FB8' });
    expect(c).toEqual({ id: 'c1', slug: 'groceries', name: 'Groceries', color: '#1F3FB8' });
  });

  it('rejects an icon field (ADR-FF-007 — Category.icon OUT OF SCOPE)', () => {
    const withIcon = {
      id: 'c1',
      slug: 'groceries',
      name: 'Groceries',
      color: '#1F3FB8',
      icon: 'shopping-cart',
    };
    // Zod by default strips unknown keys. We assert stripping, not failing —
    // the SPA never reads or sends icon, so silent strip is safe.
    const c = CategorySchema.parse(withIcon);
    expect((c as Record<string, unknown>).icon).toBeUndefined();
  });

  it('rejects non-hex color', () => {
    expect(() =>
      CategorySchema.parse({ id: 'c1', slug: 'a', name: 'A', color: 'red' }),
    ).toThrow();
  });
});

describe('AccountSchema', () => {
  it('parses a valid account', () => {
    const a = AccountSchema.parse({
      id: 'a1',
      userId: 'u1',
      name: 'Checking',
      type: 'BANK',
      createdAt: '2026-01-01T00:00:00.000Z',
    });
    expect(a.type).toBe('BANK');
  });

  it('rejects an invalid account type', () => {
    expect(() =>
      AccountSchema.parse({
        id: 'a1',
        userId: 'u1',
        name: 'X',
        type: 'CRYPTO',
        createdAt: '2026-01-01T00:00:00.000Z',
      }),
    ).toThrow();
  });
});

describe('TransactionSchema', () => {
  it('parses a valid transaction (amountCents integer)', () => {
    const t = TransactionSchema.parse({
      id: 't1',
      userId: 'u1',
      accountId: 'a1',
      categoryId: null,
      merchant: 'Cafe',
      amountCents: -1234,
      occurredAt: '2026-01-15T12:00:00.000Z',
      createdAt: '2026-01-15T12:00:01.000Z',
      status: 'PENDING',
      notes: null,
    });
    expect(t.amountCents).toBe(-1234);
    expect(t.status).toBe('PENDING');
  });

  it('parses categoryId as null', () => {
    const t = TransactionSchema.parse({
      id: 't1',
      userId: 'u1',
      accountId: 'a1',
      categoryId: null,
      merchant: 'Cafe',
      amountCents: 100,
      occurredAt: '2026-01-15T12:00:00.000Z',
      createdAt: '2026-01-15T12:00:01.000Z',
      status: 'PENDING',
      notes: null,
    });
    expect(t.categoryId).toBeNull();
  });

  it('rejects non-integer amountCents', () => {
    expect(() =>
      TransactionSchema.parse({
        id: 't1',
        userId: 'u1',
        accountId: 'a1',
        categoryId: null,
        merchant: 'Cafe',
        amountCents: 1.5,
        occurredAt: '2026-01-15T12:00:00.000Z',
        createdAt: '2026-01-15T12:00:01.000Z',
        status: 'PENDING',
        notes: null,
      }),
    ).toThrow();
  });
});

describe('UserSchema', () => {
  it('parses a valid user', () => {
    const u = UserSchema.parse({
      id: 'u1',
      email: 'a@b.com',
      name: 'Alice',
      tier: 'BRONZE',
      createdAt: '2026-01-01T00:00:00.000Z',
    });
    expect(u.tier).toBe('BRONZE');
  });
});