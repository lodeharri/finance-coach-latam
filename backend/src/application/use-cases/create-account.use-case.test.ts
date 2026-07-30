import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CreateAccountUseCase } from './create-account.use-case';
import type { Account } from '../../domain/entities/account.entity';
import type { DatabasePort } from '../../domain/ports/database.port';
import { accountTableRef } from '../../infrastructure/database/drizzle/schema';

const userId = '10000000-0000-4000-8000-000000000001';
const account: Account = {
  id: '20000000-0000-4000-8000-000000000001',
  userId,
  name: 'Banco Demo',
  type: 'BANK',
  createdAt: new Date('2026-07-01T00:00:00Z'),
};

describe('CreateAccountUseCase', () => {
  let database: DatabasePort;
  let useCase: CreateAccountUseCase;

  beforeEach(() => {
    database = {
      insert: vi.fn(),
      select: vi.fn(),
      update: vi.fn(),
    };
    useCase = new CreateAccountUseCase(database, accountTableRef);
  });

  it('creates an account for its owner', async () => {
    vi.mocked(database.insert).mockResolvedValueOnce(account);

    await expect(
      useCase.execute({
        actor: { userId, role: 'user' },
        userId,
        name: account.name,
        type: account.type,
      }),
    ).resolves.toBe(account);
    expect(database.insert).toHaveBeenCalledWith(accountTableRef, {
      userId,
      name: account.name,
      type: account.type,
    });
  });

  it('allows an administrator to create an account for another user', async () => {
    vi.mocked(database.insert).mockResolvedValueOnce(account);

    await useCase.execute({
      actor: { userId: 'admin-id', role: 'admin' },
      userId,
      name: account.name,
      type: account.type,
    });

    expect(database.insert).toHaveBeenCalledOnce();
  });

  it('rejects a regular user creating an account for another user', async () => {
    await expect(
      useCase.execute({
        actor: { userId: 'other-user', role: 'user' },
        userId,
        name: account.name,
        type: account.type,
      }),
    ).rejects.toThrow('Forbidden: users can only act on their own resources');
    expect(database.insert).not.toHaveBeenCalled();
  });
});
