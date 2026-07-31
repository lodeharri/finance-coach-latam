import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DeleteCategoryUseCase } from './delete-category.use-case';
import type { Category } from '../../domain/entities/category.entity';
import type { DatabasePort } from '../../domain/ports/database.port';
import type { MerchantCachePort } from '../../domain/ports/merchant-cache.port';
import { categoryTableRef } from '../../infrastructure/database/drizzle/schema';

const adminActor = { userId: 'admin-1', role: 'admin' as const };
const userActor = { userId: 'user-1', role: 'user' as const };

const existingCategory: Category = {
  id: '50000000-0000-4000-8000-000000000001',
  slug: 'transporte',
  name: 'Transporte',
  color: '#1E40AF',
};

describe('DeleteCategoryUseCase', () => {
  let database: DatabasePort;
  let merchantCache: MerchantCachePort;
  let useCase: DeleteCategoryUseCase;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    database = {
      insert: vi.fn(),
      select: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };
    merchantCache = {
      findByMerchant: vi.fn(),
      save: vi.fn(),
      invalidateByCategoryId: vi.fn(),
    };
    useCase = new DeleteCategoryUseCase(database, categoryTableRef, merchantCache);
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('deletes the row and invalidates the cache when the actor is admin', async () => {
    vi.mocked(database.select).mockResolvedValueOnce([existingCategory]);
    vi.mocked(database.delete).mockResolvedValueOnce(undefined);
    vi.mocked(merchantCache.invalidateByCategoryId).mockResolvedValueOnce(undefined);

    await useCase.execute({ actor: adminActor, id: existingCategory.id });

    expect(database.select).toHaveBeenCalledWith(categoryTableRef, {
      where: { id: existingCategory.id },
      limit: 1,
    });
    expect(database.delete).toHaveBeenCalledWith(categoryTableRef, {
      id: existingCategory.id,
    });
    expect(merchantCache.invalidateByCategoryId).toHaveBeenCalledWith(
      existingCategory.id,
    );
  });

  it('rejects a non-admin actor before touching the database or the cache', async () => {
    await expect(
      useCase.execute({ actor: userActor, id: existingCategory.id }),
    ).rejects.toThrow('Forbidden: admin role required');

    expect(database.select).not.toHaveBeenCalled();
    expect(database.delete).not.toHaveBeenCalled();
    expect(merchantCache.invalidateByCategoryId).not.toHaveBeenCalled();
  });

  it('throws a not-found error when the category id does not exist', async () => {
    vi.mocked(database.select).mockResolvedValueOnce([]);

    await expect(
      useCase.execute({
        actor: adminActor,
        id: '60000000-0000-4000-8000-000000000000',
      }),
    ).rejects.toThrow('Category not found');

    expect(database.delete).not.toHaveBeenCalled();
    expect(merchantCache.invalidateByCategoryId).not.toHaveBeenCalled();
  });

  it('re-throws a foreign-key violation from the database as "Category in use by transactions"', async () => {
    const fkError = new Error(
      'update or delete on table "categories" violates foreign key constraint "transactions_category_id_fkey"',
    );
    vi.mocked(database.select).mockResolvedValueOnce([existingCategory]);
    vi.mocked(merchantCache.invalidateByCategoryId).mockResolvedValueOnce(undefined);
    vi.mocked(database.delete).mockRejectedValueOnce(fkError);

    await expect(
      useCase.execute({ actor: adminActor, id: existingCategory.id }),
    ).rejects.toThrow('Category in use by transactions');
  });

  it('completes the delete and logs WARN when cache invalidation fails (best-effort)', async () => {
    vi.mocked(database.select).mockResolvedValueOnce([existingCategory]);
    vi.mocked(database.delete).mockResolvedValueOnce(undefined);
    vi.mocked(merchantCache.invalidateByCategoryId).mockRejectedValueOnce(
      new Error('cache backend offline'),
    );

    await expect(
      useCase.execute({ actor: adminActor, id: existingCategory.id }),
    ).resolves.toBeUndefined();

    expect(database.delete).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(
      'category cache invalidation failed',
      expect.objectContaining({ id: existingCategory.id }),
    );
  });

  it('invalidates the cache BEFORE issuing the DELETE so a downstream FK failure still leaves a clean cache', async () => {
    // The design (§2 / Failure Modes) calls out that cache cleanup runs
    // first. If the FK violation then throws, the category_id has no live
    // cache rows left — over-invalidating is safer than under-invalidating.
    const fkError = new Error('foreign key constraint');
    const callOrder: string[] = [];
    vi.mocked(database.select).mockResolvedValueOnce([existingCategory]);
    vi.mocked(merchantCache.invalidateByCategoryId).mockImplementationOnce(async () => {
      callOrder.push('invalidate');
    });
    vi.mocked(database.delete).mockImplementationOnce(async () => {
      callOrder.push('delete');
      throw fkError;
    });

    await expect(
      useCase.execute({ actor: adminActor, id: existingCategory.id }),
    ).rejects.toThrow('Category in use by transactions');

    expect(callOrder).toEqual(['invalidate', 'delete']);
  });

  it('propagates a non-FK database.delete error unchanged (e.g. driver/connection failures)', async () => {
    const driverError = new Error('connection terminated');
    vi.mocked(database.select).mockResolvedValueOnce([existingCategory]);
    vi.mocked(merchantCache.invalidateByCategoryId).mockResolvedValueOnce(undefined);
    vi.mocked(database.delete).mockRejectedValueOnce(driverError);

    await expect(
      useCase.execute({ actor: adminActor, id: existingCategory.id }),
    ).rejects.toThrow('connection terminated');
  });
});
