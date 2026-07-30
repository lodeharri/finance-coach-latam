import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ListTransactionsByUserUseCase } from './list-transactions-by-user.use-case';
import type { Transaction } from '../../domain/entities/transaction.entity';
import type { DatabasePort } from '../../domain/ports/database.port';
import { transactionTableRef } from '../../infrastructure/database/drizzle/schema';

const userId = '10000000-0000-4000-8000-000000000001';

describe('ListTransactionsByUserUseCase', () => {
  let database: DatabasePort;
  let useCase: ListTransactionsByUserUseCase;

  beforeEach(() => {
    database = {
      insert: vi.fn(),
      select: vi.fn(),
      update: vi.fn(),
    };
    useCase = new ListTransactionsByUserUseCase(database, transactionTableRef);
  });

  it('returns the latest 50 transactions by default for the owner', async () => {
    const rows: Transaction[] = [];
    vi.mocked(database.select).mockResolvedValueOnce(rows);

    await expect(
      useCase.execute({ actor: { userId, role: 'user' }, userId }),
    ).resolves.toBe(rows);
    expect(database.select).toHaveBeenCalledWith(transactionTableRef, {
      where: { userId },
      orderBy: { field: 'occurredAt', direction: 'desc' },
      limit: 50,
    });
  });

  it('uses a caller-provided limit and permits admin access', async () => {
    vi.mocked(database.select).mockResolvedValueOnce([]);

    await useCase.execute({
      actor: { userId: 'admin-id', role: 'admin' },
      userId,
      limit: 10,
    });

    expect(database.select).toHaveBeenCalledWith(
      transactionTableRef,
      expect.objectContaining({ limit: 10 }),
    );
  });
});
