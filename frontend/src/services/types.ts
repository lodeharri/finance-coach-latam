/**
 * services/types.ts — zod schemas mirroring the backend API contract.
 *
 * These mirror the domain entities in `backend/src/domain/entities/` plus the
 * API shape returned by the route layer:
 *  - Category: id, slug, name, color. NO icon (ADR-FF-007).
 *  - Account: id, userId, name, type, createdAt.
 *  - Transaction: id, userId, accountId, categoryId (nullable), merchant,
 *    amountCents (integer), occurredAt, createdAt, status, notes (nullable).
 *  - User: id, email, name, tier, createdAt.
 *
 * The SPA only uses `amountCents` (integer). The backend entity field is `amount`
 * — if it ever leaks, `TransactionSchema` normalizes it via a `z.preprocess`
 * step that copies the legacy `amount` value into `amountCents` before the
 * integer check runs. This is the single source of truth for the fix at the
 * schema layer; `apiClient` ALSO runs responses through these schemas so we
 * get defense in depth.
 */
import { z } from 'zod';

export const AccountTypeSchema = z.enum(['BANK', 'CASH', 'CARD']);
export type AccountType = z.infer<typeof AccountTypeSchema>;

export const TransactionStatusSchema = z.enum(['PENDING', 'CATEGORIZED', 'FAILED']);
export type TransactionStatus = z.infer<typeof TransactionStatusSchema>;

export const UserTierSchema = z.enum(['BRONZE', 'SILVER', 'GOLD']);
export type UserTier = z.infer<typeof UserTierSchema>;

const HexColor = z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Expected hex color like #AABBCC');

export const CategorySchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  color: HexColor,
});
export type Category = z.infer<typeof CategorySchema>;

const IsoDateString = z.string().refine((s) => !Number.isNaN(Date.parse(s)), {
  message: 'Expected ISO date string',
});

export const AccountSchema = z.object({
  id: z.string(),
  userId: z.string(),
  name: z.string(),
  type: AccountTypeSchema,
  createdAt: IsoDateString,
});
export type Account = z.infer<typeof AccountSchema>;

export const TransactionSchema = z.preprocess(
  (val) => {
    // Normalize the legacy backend `amount` field into `amountCents` BEFORE
    // the strict integer check. z.object strips unknown keys by default, so
    // any surviving `amount` field is automatically dropped from the parsed
    // output — no explicit strip needed.
    if (val && typeof val === 'object' && val !== null) {
      const obj = val as Record<string, unknown>;
      if (obj.amountCents === undefined && typeof obj.amount === 'number') {
        const { amount, ...rest } = obj;
        return { ...rest, amountCents: amount };
      }
    }
    return val;
  },
  z.object({
    id: z.string(),
    userId: z.string(),
    accountId: z.string(),
    categoryId: z.string().nullable(),
    merchant: z.string(),
    amountCents: z.number().int(),
    occurredAt: IsoDateString,
    createdAt: IsoDateString,
    status: TransactionStatusSchema,
    notes: z.string().nullable(),
  }),
);
export type Transaction = z.infer<typeof TransactionSchema>;

export const UserSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  tier: UserTierSchema,
  createdAt: IsoDateString,
});
export type User = z.infer<typeof UserSchema>;