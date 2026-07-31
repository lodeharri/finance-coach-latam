import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UpdateCategoryUseCase } from './update-category.use-case';
import type { Category } from '../../domain/entities/category.entity';
import type { DatabasePort } from '../../domain/ports/database.port';
import type { LLMPort } from '../../domain/ports/llm.port';
import type { MerchantCachePort } from '../../domain/ports/merchant-cache.port';
import { categoryTableRef } from '../../infrastructure/database/drizzle/schema';

const adminActor = { userId: 'admin-1', role: 'admin' as const };

const existingCategory: Category = {
  id: '50000000-0000-4000-8000-000000000001',
  slug: 'transporte',
  name: 'Transporte',
  color: '#1E40AF',
};

const updatedCategory: Category = {
  ...existingCategory,
  name: 'Transporte público',
  color: '#10B981',
};

describe('UpdateCategoryUseCase', () => {
  let database: DatabasePort;
  let llm: LLMPort;
  let merchantCache: MerchantCachePort;
  let useCase: UpdateCategoryUseCase;

  beforeEach(() => {
    database = {
      insert: vi.fn(),
      select: vi.fn(),
      update: vi.fn(),
      query: vi.fn(),
    };
    llm = {
      generateText: vi.fn(),
      embed: vi.fn(),
    };
    merchantCache = {
      findByMerchant: vi.fn(),
      save: vi.fn(),
      invalidateByCategoryId: vi.fn(),
    };
    useCase = new UpdateCategoryUseCase(database, categoryTableRef, llm, merchantCache);
  });

  it('updates name and color, recomputes the embedding with the new name, and invalidates the cache', async () => {
    vi.mocked(database.select).mockResolvedValueOnce([existingCategory]);
    vi.mocked(database.update).mockResolvedValueOnce(updatedCategory);
    vi.mocked(llm.embed).mockResolvedValueOnce([0.4, 0.5, 0.6]);
    vi.mocked(merchantCache.invalidateByCategoryId).mockResolvedValueOnce(undefined);

    const result = await useCase.execute({
      actor: adminActor,
      id: existingCategory.id,
      patch: { name: updatedCategory.name, color: updatedCategory.color },
    });

    expect(database.select).toHaveBeenCalledWith(categoryTableRef, {
      where: { id: existingCategory.id },
      limit: 1,
    });
    expect(database.update).toHaveBeenCalledWith(
      categoryTableRef,
      { id: existingCategory.id },
      { name: updatedCategory.name, color: updatedCategory.color },
    );
    expect(result).toBe(updatedCategory);

    // Embedding recompute + cache invalidation are both kicked off after
    // update; let microtasks settle before we observe them.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(llm.embed).toHaveBeenCalledWith('Transporte público transporte');
    expect(database.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE categories SET embedding = $1::vector WHERE id = $2'),
      [JSON.stringify([0.4, 0.5, 0.6]), existingCategory.id],
    );
    expect(merchantCache.invalidateByCategoryId).toHaveBeenCalledWith(
      existingCategory.id,
    );
  });
});
