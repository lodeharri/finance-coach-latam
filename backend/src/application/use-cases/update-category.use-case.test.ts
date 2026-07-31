import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UpdateCategoryUseCase } from './update-category.use-case';
import type { Category } from '../../domain/entities/category.entity';
import type { DatabasePort } from '../../domain/ports/database.port';
import type { LLMPort } from '../../domain/ports/llm.port';
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
  let warnSpy: ReturnType<typeof vi.spyOn>;

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
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
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

  it('updates name only — embedding recompute fires, cache invalidates', async () => {
    const nameOnlyUpdate: Category = { ...existingCategory, name: 'Movilidad' };
    vi.mocked(database.select).mockResolvedValueOnce([existingCategory]);
    vi.mocked(database.update).mockResolvedValueOnce(nameOnlyUpdate);
    vi.mocked(llm.embed).mockResolvedValueOnce([0.7, 0.8, 0.9]);
    vi.mocked(merchantCache.invalidateByCategoryId).mockResolvedValueOnce(undefined);

    const result = await useCase.execute({
      actor: adminActor,
      id: existingCategory.id,
      patch: { name: 'Movilidad' },
    });

    expect(database.update).toHaveBeenCalledWith(
      categoryTableRef,
      { id: existingCategory.id },
      { name: 'Movilidad' },
    );
    expect(result).toBe(nameOnlyUpdate);

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(llm.embed).toHaveBeenCalledWith('Movilidad transporte');
    expect(merchantCache.invalidateByCategoryId).toHaveBeenCalledWith(
      existingCategory.id,
    );
  });

  it('updates color only — embedding does NOT recompute, cache invalidates', async () => {
    const colorOnlyUpdate: Category = { ...existingCategory, color: '#10B981' };
    vi.mocked(database.select).mockResolvedValueOnce([existingCategory]);
    vi.mocked(database.update).mockResolvedValueOnce(colorOnlyUpdate);
    vi.mocked(merchantCache.invalidateByCategoryId).mockResolvedValueOnce(undefined);

    const result = await useCase.execute({
      actor: adminActor,
      id: existingCategory.id,
      patch: { color: '#10B981' },
    });

    expect(database.update).toHaveBeenCalledWith(
      categoryTableRef,
      { id: existingCategory.id },
      { color: '#10B981' },
    );
    expect(result).toBe(colorOnlyUpdate);
    expect(merchantCache.invalidateByCategoryId).toHaveBeenCalledWith(
      existingCategory.id,
    );
    // No name change → no embedding recompute, no query UPDATE.
    expect(llm.embed).not.toHaveBeenCalled();
    expect(database.query).not.toHaveBeenCalled();
  });

  it('rejects non-admin actors before touching the database, the LLM, or the cache', async () => {
    await expect(
      useCase.execute({
        actor: userActor,
        id: existingCategory.id,
        patch: { name: 'Otro nombre' },
      }),
    ).rejects.toThrow('Forbidden: admin role required');

    expect(database.select).not.toHaveBeenCalled();
    expect(database.update).not.toHaveBeenCalled();
    expect(llm.embed).not.toHaveBeenCalled();
    expect(merchantCache.invalidateByCategoryId).not.toHaveBeenCalled();
  });

  it('rejects an empty name with a 400-style error before touching the database', async () => {
    await expect(
      useCase.execute({
        actor: adminActor,
        id: existingCategory.id,
        patch: { name: '   ' },
      }),
    ).rejects.toThrow('Field "name" must be a non-empty string');

    expect(database.select).not.toHaveBeenCalled();
    expect(database.update).not.toHaveBeenCalled();
    expect(llm.embed).not.toHaveBeenCalled();
    expect(merchantCache.invalidateByCategoryId).not.toHaveBeenCalled();
  });

  it('rejects an invalid color with a 400-style error before touching the database', async () => {
    await expect(
      useCase.execute({
        actor: adminActor,
        id: existingCategory.id,
        patch: { color: 'red' },
      }),
    ).rejects.toThrow('Field "color" must be a hex color like #AABBCC');

    expect(database.select).not.toHaveBeenCalled();
    expect(database.update).not.toHaveBeenCalled();
    expect(llm.embed).not.toHaveBeenCalled();
    expect(merchantCache.invalidateByCategoryId).not.toHaveBeenCalled();
  });

  it('rejects a short hex color with a 400-style error before touching the database', async () => {
    await expect(
      useCase.execute({
        actor: adminActor,
        id: existingCategory.id,
        patch: { color: '#FFF' },
      }),
    ).rejects.toThrow('Field "color" must be a hex color like #AABBCC');
  });

  it('throws a not-found error when the category id does not exist', async () => {
    vi.mocked(database.select).mockResolvedValueOnce([]);

    await expect(
      useCase.execute({
        actor: adminActor,
        id: '60000000-0000-4000-8000-000000000000',
        patch: { name: 'Nuevo' },
      }),
    ).rejects.toThrow('Category not found');

    expect(database.update).not.toHaveBeenCalled();
    expect(llm.embed).not.toHaveBeenCalled();
    expect(merchantCache.invalidateByCategoryId).not.toHaveBeenCalled();
  });

  it('treats a same-name update as a normal update — cache invalidates, embedding recomputes', async () => {
    // Patch.name equals current.name: still treated as a user-initiated update,
    // so the cache and embedding side-effects fire as if the value changed.
    // This keeps the contract simple: "patch.name provided" means recompute.
    const sameNameUpdate: Category = { ...existingCategory };
    vi.mocked(database.select).mockResolvedValueOnce([existingCategory]);
    vi.mocked(database.update).mockResolvedValueOnce(sameNameUpdate);
    vi.mocked(llm.embed).mockResolvedValueOnce([0.1, 0.2, 0.3]);
    vi.mocked(merchantCache.invalidateByCategoryId).mockResolvedValueOnce(undefined);

    const result = await useCase.execute({
      actor: adminActor,
      id: existingCategory.id,
      patch: { name: existingCategory.name },
    });

    expect(database.update).toHaveBeenCalledWith(
      categoryTableRef,
      { id: existingCategory.id },
      { name: existingCategory.name },
    );
    expect(result).toBe(sameNameUpdate);

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(llm.embed).toHaveBeenCalledWith('Transporte transporte');
    expect(merchantCache.invalidateByCategoryId).toHaveBeenCalledWith(
      existingCategory.id,
    );
  });

  it('keeps the update result and logs WARN when llm.embed throws — cache still invalidates', async () => {
    vi.mocked(database.select).mockResolvedValueOnce([existingCategory]);
    vi.mocked(database.update).mockResolvedValueOnce(updatedCategory);
    vi.mocked(llm.embed).mockRejectedValueOnce(new Error('quota exceeded'));
    vi.mocked(merchantCache.invalidateByCategoryId).mockResolvedValueOnce(undefined);

    const result = await useCase.execute({
      actor: adminActor,
      id: existingCategory.id,
      patch: { name: updatedCategory.name, color: updatedCategory.color },
    });

    expect(result).toBe(updatedCategory);

    // Cache invalidation runs synchronously around the update, so it's
    // observable without flushing microtasks.
    expect(merchantCache.invalidateByCategoryId).toHaveBeenCalledWith(
      existingCategory.id,
    );

    // Embedding fire-and-forget is async — let the rejection propagate to
    // the catch inside persistEmbedding before asserting the WARN.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(warnSpy).toHaveBeenCalledWith(
      'category embedding failed',
      expect.objectContaining({
        id: existingCategory.id,
        slug: existingCategory.slug,
      }),
    );
  });

  it('keeps the update result and logs WARN when cache invalidation throws', async () => {
    vi.mocked(database.select).mockResolvedValueOnce([existingCategory]);
    vi.mocked(database.update).mockResolvedValueOnce(updatedCategory);
    vi.mocked(llm.embed).mockResolvedValueOnce([0.4, 0.5, 0.6]);
    vi.mocked(merchantCache.invalidateByCategoryId).mockRejectedValueOnce(
      new Error('cache backend offline'),
    );

    const result = await useCase.execute({
      actor: adminActor,
      id: existingCategory.id,
      patch: { name: updatedCategory.name, color: updatedCategory.color },
    });

    expect(result).toBe(updatedCategory);
    expect(warnSpy).toHaveBeenCalledWith(
      'category cache invalidation failed',
      expect.objectContaining({ id: existingCategory.id }),
    );

    // Embedding should still fire — cache failure is non-blocking.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(llm.embed).toHaveBeenCalledWith('Transporte público transporte');
  });

  it('re-throws a database.update failure (e.g. FK or constraint error) without swallowing it', async () => {
    const dbError = new Error(
      'update or delete on table "categories" violates foreign key constraint',
    );
    vi.mocked(database.select).mockResolvedValueOnce([existingCategory]);
    vi.mocked(database.update).mockRejectedValueOnce(dbError);

    await expect(
      useCase.execute({
        actor: adminActor,
        id: existingCategory.id,
        patch: { name: 'Otro' },
      }),
    ).rejects.toThrow('foreign key constraint');

    // Cache invalidation never runs because update threw first; the row may
    // not have been changed, so leaving the cache alone is the right move.
    expect(merchantCache.invalidateByCategoryId).not.toHaveBeenCalled();
    expect(llm.embed).not.toHaveBeenCalled();
  });
});
