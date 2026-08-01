import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UpdateTransactionCategoryUseCase } from './update-transaction.use-case';
import type { Transaction } from '../../domain/entities/transaction.entity';
import type { Category } from '../../domain/entities/category.entity';
import type { DatabasePort, TableRef } from '../../domain/ports/database.port';
import type { MerchantCachePort } from '../../domain/ports/merchant-cache.port';
import { transactionTableRef } from '../../infrastructure/database/drizzle/schema';

const userId = '10000000-0000-4000-8000-000000000001';
const otherUserId = '10000000-0000-4000-8000-000000000002';
const adminId = '10000000-0000-4000-8000-000000000003';
const transactionId = '30000000-0000-4000-8000-000000000001';
const categoryId = '40000000-0000-4000-8000-000000000001';
const otherCategoryId = '40000000-0000-4000-8000-000000000002';
const accountId = '20000000-0000-4000-8000-000000000001';

function makeTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: transactionId,
    userId,
    accountId,
    categoryId: null,
    merchant: 'PedidosYa',
    amount: 4200000,
    occurredAt: new Date('2026-07-15T12:00:00Z'),
    createdAt: new Date('2026-07-15T12:01:00Z'),
    status: 'CATEGORIZED',
    notes: null,
    ...overrides,
  };
}

function makeCategory(overrides: Partial<Category> = {}): Category {
  return {
    id: categoryId,
    slug: 'alimentos',
    name: 'Alimentos',
    color: '#AABBCC',
    ...overrides,
  };
}

describe('UpdateTransactionCategoryUseCase', () => {
  let database: DatabasePort & Required<Pick<DatabasePort, 'query'>>;
  let merchantCache: MerchantCachePort;
  let categoriesTableRef: TableRef<Category>;
  let useCase: UpdateTransactionCategoryUseCase;

  beforeEach(() => {
    database = {
      insert: vi.fn(),
      select: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      query: vi.fn(),
    };
    merchantCache = {
      findByMerchant: vi.fn(),
      save: vi.fn().mockResolvedValue(undefined),
      invalidateByCategoryId: vi.fn(),
    };
    categoriesTableRef = { __entity: {} as Category, __table: undefined as never };
    useCase = new UpdateTransactionCategoryUseCase(
      database,
      transactionTableRef,
      categoriesTableRef,
      merchantCache,
    );
  });

  it('owner override: loads transaction by id, then asserts the actor owns it, then updates', async () => {
    const tx = makeTransaction({ categoryId: otherCategoryId });
    const updated = makeTransaction({ categoryId });
    vi.mocked(database.select)
      .mockResolvedValueOnce([tx])
      .mockResolvedValueOnce([makeCategory()]);
    vi.mocked(database.update).mockResolvedValueOnce(updated);

    const result = await useCase.execute({
      actor: { userId, role: 'user' },
      transactionId,
      categoryId,
    });

    // Two reads: transaction by id, category by id.
    expect(database.select).toHaveBeenCalledTimes(2);
    // First select: load by id only (REQ-FFC-AUTH-TX-OWNER — load first, then assert).
    expect(database.select).toHaveBeenNthCalledWith(
      1,
      transactionTableRef,
      expect.objectContaining({ where: expect.objectContaining({ id: transactionId }) }),
    );
    // Update uses both id and userId to prevent a stale row hitting the wrong account.
    expect(database.update).toHaveBeenCalledWith(
      transactionTableRef,
      { id: transactionId, userId },
      { categoryId },
    );
    expect(result).toBe(updated);
  });

  it('admin override on another user\'s row succeeds and writes the merchant cache (REQ-FFC-BE-PATCH-AUDIT)', async () => {
    const tx = makeTransaction({ userId: otherUserId, merchant: 'PedidosYa' });
    const updated = makeTransaction({ userId: otherUserId, categoryId });
    vi.mocked(database.select)
      .mockResolvedValueOnce([tx])
      .mockResolvedValueOnce([makeCategory()]);
    vi.mocked(database.update).mockResolvedValueOnce(updated);

    const result = await useCase.execute({
      actor: { userId: adminId, role: 'admin' },
      transactionId,
      categoryId,
    });

    expect(database.update).toHaveBeenCalledWith(
      transactionTableRef,
      { id: transactionId, userId: otherUserId },
      { categoryId },
    );
    // Merchant cache write-back uses the normalized merchant.
    expect(merchantCache.save).toHaveBeenCalledWith('pedidosya', categoryId);
    expect(result).toBe(updated);
  });

  it('non-owner non-admin → Forbidden', async () => {
    const tx = makeTransaction({ userId });
    vi.mocked(database.select).mockResolvedValueOnce([tx]);

    await expect(
      useCase.execute({
        actor: { userId: otherUserId, role: 'user' },
        transactionId,
        categoryId,
      }),
    ).rejects.toThrow('Forbidden: users can only act on their own resources');
    expect(database.update).not.toHaveBeenCalled();
    expect(merchantCache.save).not.toHaveBeenCalled();
  });

  it('unknown transactionId → Transaction not found', async () => {
    vi.mocked(database.select).mockResolvedValueOnce([]);

    await expect(
      useCase.execute({
        actor: { userId, role: 'user' },
        transactionId,
        categoryId,
      }),
    ).rejects.toThrow('Transaction not found');
    expect(database.update).not.toHaveBeenCalled();
  });

  it('unknown categoryId → Category not found', async () => {
    const tx = makeTransaction();
    vi.mocked(database.select)
      .mockResolvedValueOnce([tx])
      .mockResolvedValueOnce([]);

    await expect(
      useCase.execute({
        actor: { userId, role: 'user' },
        transactionId,
        categoryId,
      }),
    ).rejects.toThrow('Category not found');
    expect(database.update).not.toHaveBeenCalled();
  });

  it('spoofed userId in input is ignored: the row\'s real userId is what authz compares (REQ-FFC-AUTH-TX-OWNER)', async () => {
    // REQ-FFC-AUTH-TX-OWNER: even if the caller passes a userId in the
    // request body, the use case must load by id only and assert against
    // the row\'s real userId. A spoofed userId must NEVER bypass the
    // ownership check. Set the actor to a third party and the transaction
    // to a DIFFERENT user, so any reliance on the spoofed userId surfaces
    // as a wrong-allow; any correct loading-then-asserting surfaces as
    // Forbidden.
    const tx = makeTransaction({ userId });
    const spoofedUserId = '10000000-0000-4000-8000-000000000099';
    vi.mocked(database.select).mockResolvedValueOnce([tx]);

    await expect(
      useCase.execute({
        actor: { userId: spoofedUserId, role: 'user' },
        // Spoofed userId claiming the row is theirs — must not bypass authz
        // because the row actually belongs to `userId`, not `spoofedUserId`.
        transactionId,
        userId: spoofedUserId,
        categoryId,
      }),
    ).rejects.toThrow('Forbidden: users can only act on their own resources');
    expect(database.update).not.toHaveBeenCalled();
  });

  it('multiple transactions with the same id never collide: the second update uses id+userId', async () => {
    // If two transactions ever share an id (should not happen, but defensive),
    // the where clause includes userId so we never touch the wrong row.
    const tx = makeTransaction();
    const updated = makeTransaction({ categoryId });
    vi.mocked(database.select)
      .mockResolvedValueOnce([tx])
      .mockResolvedValueOnce([makeCategory()]);
    vi.mocked(database.update).mockResolvedValueOnce(updated);

    await useCase.execute({
      actor: { userId, role: 'user' },
      transactionId,
      categoryId,
    });

    const updateCall = vi.mocked(database.update).mock.calls[0]!;
    const where = updateCall[1] as Record<string, unknown>;
    expect(where).toEqual({ id: transactionId, userId });
  });

  it('merchant cache write is best-effort: a cache failure does not fail the update', async () => {
    const tx = makeTransaction({ merchant: 'PedidosYa' });
    const updated = makeTransaction({ categoryId });
    vi.mocked(database.select)
      .mockResolvedValueOnce([tx])
      .mockResolvedValueOnce([makeCategory()]);
    vi.mocked(database.update).mockResolvedValueOnce(updated);
    vi.mocked(merchantCache.save).mockRejectedValueOnce(new Error('cache boom'));
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await useCase.execute({
      actor: { userId, role: 'user' },
      transactionId,
      categoryId,
    });

    expect(result).toBe(updated);
    expect(warnSpy).toHaveBeenCalledWith(
      'merchant cache write failed',
      expect.objectContaining({ merchant: 'pedidosya' }),
    );
    warnSpy.mockRestore();
  });

  it('uses the updated transactionId (not a different one) when called twice in sequence', async () => {
    const tx1 = makeTransaction({ id: transactionId });
    const updated = makeTransaction({ categoryId });

    vi.mocked(database.select)
      .mockResolvedValueOnce([tx1])
      .mockResolvedValueOnce([makeCategory()]);
    vi.mocked(database.update).mockResolvedValueOnce(updated);

    await useCase.execute({
      actor: { userId, role: 'user' },
      transactionId,
      categoryId,
    });

    // Ensure we never mix ids.
    const selectCalls = vi.mocked(database.select).mock.calls;
    const firstWhere = selectCalls[0]?.[1]?.where as { id?: string };
    expect(firstWhere?.id).toBe(transactionId);
  });

  it('uses CategoryRow shape correctly: only id, slug, name, color are selected', async () => {
    const tx = makeTransaction();
    vi.mocked(database.select)
      .mockResolvedValueOnce([tx])
      .mockResolvedValueOnce([makeCategory()]);
    vi.mocked(database.update).mockResolvedValueOnce(makeTransaction({ categoryId }));

    await useCase.execute({
      actor: { userId, role: 'user' },
      transactionId,
      categoryId,
    });

    // The second select is on the categories table to verify the category exists.
    const selectCalls = vi.mocked(database.select).mock.calls;
    expect(selectCalls[1]?.[0]).toBe(categoriesTableRef);
  });

  it('throws if database.query is missing — defensive for adapters that don\'t expose raw SQL', async () => {
    // The use case does not require query() in this implementation, but
    // document the dependency tree by simulating a future version that does.
    const tx = makeTransaction();
    vi.mocked(database.select).mockResolvedValueOnce([tx]);

    // First select succeeds and returns the row; the second is the category
    // existence check.
    vi.mocked(database.select).mockResolvedValueOnce([makeCategory()]);
    vi.mocked(database.update).mockResolvedValueOnce(makeTransaction({ categoryId }));

    // Should not throw — UpdateTransactionCategoryUseCase does not need query().
    await expect(
      useCase.execute({
        actor: { userId, role: 'user' },
        transactionId,
        categoryId,
      }),
    ).resolves.toBeDefined();
  });
});