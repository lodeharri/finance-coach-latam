import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ListAccountsByUserUseCase } from './list-accounts-by-user.use-case';
import type { Account } from '../../domain/entities/account.entity';
import type { DatabasePort } from '../../domain/ports/database.port';
import { accountTableRef } from '../../infrastructure/database/drizzle/schema';

const userId = '10000000-0000-4000-8000-000000000001';

describe('ListAccountsByUserUseCase', () => {
  let database: DatabasePort;
  let useCase: ListAccountsByUserUseCase;

  beforeEach(() => {
    database = {
      insert: vi.fn(),
      select: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };
    useCase = new ListAccountsByUserUseCase(database, accountTableRef);
  });

  it('lists accounts for their owner', async () => {
    const rows: Account[] = [];
    vi.mocked(database.select).mockResolvedValueOnce(rows);

    await expect(
      useCase.execute({ actor: { userId, role: 'user' }, userId }),
    ).resolves.toBe(rows);
    expect(database.select).toHaveBeenCalledWith(accountTableRef, {
      where: { userId },
      orderBy: { field: 'createdAt', direction: 'desc' },
    });
  });

  it('allows an administrator to list another user accounts', async () => {
    vi.mocked(database.select).mockResolvedValueOnce([]);

    await useCase.execute({
      actor: { userId: 'admin-id', role: 'admin' },
      userId,
    });

    expect(database.select).toHaveBeenCalledOnce();
  });
});
