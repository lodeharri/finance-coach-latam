import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ListUsersUseCase } from './list-users.use-case';
import type { User } from '../../domain/entities/user.entity';
import type { DatabasePort } from '../../domain/ports/database.port';
import { userTableRef } from '../../infrastructure/database/drizzle/schema';

describe('ListUsersUseCase', () => {
  let database: DatabasePort;
  let useCase: ListUsersUseCase;

  beforeEach(() => {
    database = {
      insert: vi.fn(),
      select: vi.fn(),
      update: vi.fn(),
    };
    useCase = new ListUsersUseCase(database, userTableRef);
  });

  it('returns all users for an administrator', async () => {
    const users: User[] = [
      {
        id: '11111111-1111-4111-8111-111111111111',
        email: 'user@example.com',
        name: 'User',
        tier: 'BRONZE',
        createdAt: new Date('2026-07-01T00:00:00Z'),
      },
    ];
    vi.mocked(database.select).mockResolvedValueOnce(users);

    await expect(useCase.execute({ actorRole: 'admin' })).resolves.toBe(users);
    expect(database.select).toHaveBeenCalledWith(userTableRef);
  });

  it('rejects regular users', async () => {
    await expect(useCase.execute({ actorRole: 'user' })).rejects.toThrow(
      'Forbidden: only admins can list users',
    );
    expect(database.select).not.toHaveBeenCalled();
  });
});
