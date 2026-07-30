import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CreateCategoryUseCase } from './create-category.use-case';
import type { Category } from '../../domain/entities/category.entity';
import type { DatabasePort } from '../../domain/ports/database.port';
import type { LLMPort } from '../../domain/ports/llm.port';
import { categoryTableRef } from '../../infrastructure/database/drizzle/schema';

const adminActor = { userId: 'admin-1', role: 'admin' as const };
const userActor = { userId: 'user-1', role: 'user' as const };

const insertedCategory: Category = {
  id: '50000000-0000-4000-8000-000000000001',
  slug: 'transporte',
  name: 'Transporte',
  color: '#1E40AF',
};

describe('CreateCategoryUseCase', () => {
  let database: DatabasePort;
  let llm: LLMPort;
  let useCase: CreateCategoryUseCase;

  beforeEach(() => {
    database = {
      insert: vi.fn(),
      select: vi.fn(),
      update: vi.fn(),
    };
    llm = {
      generateText: vi.fn(),
      embed: vi.fn(),
    };
    useCase = new CreateCategoryUseCase(database, categoryTableRef, llm);
  });

  it('inserts the category with embedding unset and returns it for an admin actor', async () => {
    vi.mocked(database.select).mockResolvedValueOnce([]);
    vi.mocked(database.insert).mockResolvedValueOnce(insertedCategory);
    vi.mocked(llm.embed).mockResolvedValueOnce([0.1, 0.2, 0.3]);

    const result = await useCase.execute({
      actor: adminActor,
      slug: insertedCategory.slug,
      name: insertedCategory.name,
      color: insertedCategory.color,
    });

    expect(database.select).toHaveBeenCalledWith(categoryTableRef, {
      where: { slug: insertedCategory.slug },
      limit: 1,
    });
    expect(database.insert).toHaveBeenCalledWith(categoryTableRef, {
      slug: insertedCategory.slug,
      name: insertedCategory.name,
      color: insertedCategory.color,
    });
    expect(result).toBe(insertedCategory);

    // The fire-and-forget embed kicks off after insert — let it settle so
    // the llm.embed call is observable (REQ-AC-003 / REQ-AC-004).
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(llm.embed).toHaveBeenCalledWith('Transporte transporte');
  });

  it('rejects non-admin actors before touching the database or the LLM', async () => {
    await expect(
      useCase.execute({
        actor: userActor,
        slug: 'transporte',
        name: 'Transporte',
        color: '#1E40AF',
      }),
    ).rejects.toThrow('Forbidden: admin role required');

    expect(database.select).not.toHaveBeenCalled();
    expect(database.insert).not.toHaveBeenCalled();
    expect(llm.embed).not.toHaveBeenCalled();
  });

  it('throws a duplicate-slug error when the slug already exists', async () => {
    vi.mocked(database.select).mockResolvedValueOnce([insertedCategory]);

    await expect(
      useCase.execute({
        actor: adminActor,
        slug: insertedCategory.slug,
        name: 'Otra categoria',
        color: '#10B981',
      }),
    ).rejects.toThrow('Category slug already exists: transporte');

    expect(database.insert).not.toHaveBeenCalled();
    expect(llm.embed).not.toHaveBeenCalled();
  });

  it('throws an invalid-color error referencing the color field', async () => {
    await expect(
      useCase.execute({
        actor: adminActor,
        slug: 'transporte',
        name: 'Transporte',
        color: 'red',
      }),
    ).rejects.toThrow('Field "color" must be a hex color like #AABBCC');

    expect(database.select).not.toHaveBeenCalled();
    expect(database.insert).not.toHaveBeenCalled();
    expect(llm.embed).not.toHaveBeenCalled();
  });

  it('throws an invalid-color error for short hex codes', async () => {
    await expect(
      useCase.execute({
        actor: adminActor,
        slug: 'transporte',
        name: 'Transporte',
        color: '#FFF',
      }),
    ).rejects.toThrow('Field "color" must be a hex color like #AABBCC');
  });

  it('keeps the inserted row and logs a warning when the embedding call fails', async () => {
    vi.mocked(database.select).mockResolvedValueOnce([]);
    vi.mocked(database.insert).mockResolvedValueOnce(insertedCategory);
    vi.mocked(llm.embed).mockRejectedValueOnce(new Error('quota exceeded'));
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await useCase.execute({
      actor: adminActor,
      slug: insertedCategory.slug,
      name: insertedCategory.name,
      color: insertedCategory.color,
    });

    expect(result).toBe(insertedCategory);
    expect(database.insert).toHaveBeenCalledTimes(1);

    // Let the fire-and-forget promise settle, then assert the warn was logged.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(warnSpy).toHaveBeenCalledWith(
      'category embedding failed',
      expect.objectContaining({
        id: insertedCategory.id,
        slug: insertedCategory.slug,
      }),
    );
    warnSpy.mockRestore();
  });

  it('returns before the embedding resolves (execute resolves immediately)', async () => {
    vi.mocked(database.select).mockResolvedValueOnce([]);
    vi.mocked(database.insert).mockResolvedValueOnce(insertedCategory);
    // llm.embed returns a promise that never resolves within the test window.
    vi.mocked(llm.embed).mockImplementationOnce(
      () => new Promise(() => {}),
    );

    const start = Date.now();
    const result = await useCase.execute({
      actor: adminActor,
      slug: insertedCategory.slug,
      name: insertedCategory.name,
      color: insertedCategory.color,
    });
    const elapsed = Date.now() - start;

    expect(result).toBe(insertedCategory);
    expect(elapsed).toBeLessThan(50); // synchronous insert window only
  });
});