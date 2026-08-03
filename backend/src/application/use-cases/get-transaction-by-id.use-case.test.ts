import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GetTransactionByIdUseCase } from './get-transaction-by-id.use-case';
import type { Transaction } from '../../domain/entities/transaction.entity';
import type { DatabasePort } from '../../domain/ports/database.port';
import { transactionTableRef } from '../../infrastructure/database/drizzle/schema';

const ownerId = '10000000-0000-4000-8000-000000000001';
const otherId = '20000000-0000-4000-8000-000000000001';
const adminId = '30000000-0000-4000-8000-000000000001';
const transactionId = '40000000-0000-4000-8000-000000000001';

const baseTransaction: Transaction = {
  id: transactionId,
  userId: ownerId,
  accountId: '50000000-0000-4000-8000-000000000001',
  categoryId: null,
  merchant: 'PedidosYa',
  amount: 4200000,
  occurredAt: new Date('2026-07-15T12:00:00.000Z'),
  createdAt: new Date('2026-07-15T12:01:00.000Z'),
  status: 'PENDING',
  notes: null,
};

describe('GetTransactionByIdUseCase', () => {
  let database: DatabasePort;
  let useCase: GetTransactionByIdUseCase;

  beforeEach(() => {
    database = {
      insert: vi.fn(),
      select: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };
    useCase = new GetTransactionByIdUseCase(database, transactionTableRef);
  });

  it('returns the row when the owner reads their own transaction', async () => {
    vi.mocked(database.select).mockResolvedValueOnce([baseTransaction]);

    await expect(
      useCase.execute({ actor: { userId: ownerId, role: 'user' }, id: transactionId }),
    ).resolves.toBe(baseTransaction);

    expect(database.select).toHaveBeenCalledWith(transactionTableRef, {
      where: { id: transactionId },
      limit: 1,
    });
  });

  it('returns the row when an admin reads any transaction', async () => {
    vi.mocked(database.select).mockResolvedValueOnce([baseTransaction]);

    await expect(
      useCase.execute({ actor: { userId: adminId, role: 'admin' }, id: transactionId }),
    ).resolves.toBe(baseTransaction);
  });

  it('rejects a non-owner non-admin actor (403 path)', async () => {
    vi.mocked(database.select).mockResolvedValueOnce([baseTransaction]);

    await expect(
      useCase.execute({ actor: { userId: otherId, role: 'user' }, id: transactionId }),
    ).rejects.toThrow('Forbidden: users can only act on their own resources');

    expect(database.select).toHaveBeenCalledWith(transactionTableRef, {
      where: { id: transactionId },
      limit: 1,
    });
  });
});
