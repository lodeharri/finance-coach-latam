import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ListCategoriesUseCase } from './list-categories.use-case';
import type { Category } from '../../domain/entities/category.entity';
import type { DatabasePort } from '../../domain/ports/database.port';
import { categoryTableRef } from '../../infrastructure/database/drizzle/schema';

describe('ListCategoriesUseCase', () => {
  let database: DatabasePort;
  let useCase: ListCategoriesUseCase;

  beforeEach(() => {
    database = {
      insert: vi.fn(),
      select: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };
    useCase = new ListCategoriesUseCase(database, categoryTableRef);
  });

  it('returns all categories ordered by name', async () => {
    const rows: Category[] = [
      {
        id: '40000000-0000-4000-8000-000000000001',
        slug: 'alimentos',
        name: 'Alimentos',
        color: '#F59E0B',
      },
    ];
    vi.mocked(database.select).mockResolvedValueOnce(rows);

    await expect(useCase.execute()).resolves.toBe(rows);
    expect(database.select).toHaveBeenCalledWith(categoryTableRef, {
      orderBy: { field: 'name', direction: 'asc' },
    });
  });
});
