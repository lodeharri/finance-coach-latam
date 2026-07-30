import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CreateUserUseCase } from './create-user.use-case';
import type { User } from '../../domain/entities/user.entity';
import type { AuthPort } from '../../domain/ports/cognito.port';
import type { DatabasePort } from '../../domain/ports/database.port';
import { userTableRef } from '../../infrastructure/database/drizzle/schema';

describe('CreateUserUseCase', () => {
  let database: DatabasePort;
  let auth: AuthPort;
  let useCase: CreateUserUseCase;

  beforeEach(() => {
    database = {
      insert: vi.fn(),
      select: vi.fn(),
      update: vi.fn(),
    };
    auth = {
      createUser: vi.fn(),
      addUserToGroup: vi.fn(),
      getUserByEmail: vi.fn(),
    };
    useCase = new CreateUserUseCase(database, auth, userTableRef);
  });

  it('creates a regular user, assigns the users group, and stores the profile', async () => {
    const created: User = {
      id: '11111111-1111-4111-8111-111111111111',
      email: 'new@example.com',
      name: 'New User',
      tier: 'BRONZE',
      createdAt: new Date('2026-07-01T00:00:00Z'),
    };
    vi.mocked(auth.createUser).mockResolvedValueOnce({ userId: created.id });
    vi.mocked(database.insert).mockResolvedValueOnce(created);

    const result = await useCase.execute({
      actorRole: 'admin',
      email: created.email,
      name: created.name,
      role: 'user',
      tempPassword: 'Temp#2026!',
    });

    expect(auth.createUser).toHaveBeenCalledWith({
      email: created.email,
      name: created.name,
      role: 'user',
      tempPassword: 'Temp#2026!',
    });
    expect(auth.addUserToGroup).toHaveBeenCalledWith(created.id, 'users');
    expect(database.insert).toHaveBeenCalledWith(userTableRef, {
      id: created.id,
      email: created.email,
      name: created.name,
      tier: 'BRONZE',
    });
    expect(result).toBe(created);
  });

  it('assigns administrators to the admins group', async () => {
    const created: User = {
      id: '22222222-2222-4222-8222-222222222222',
      email: 'admin2@example.com',
      name: 'Second Admin',
      tier: 'BRONZE',
      createdAt: new Date('2026-07-02T00:00:00Z'),
    };
    vi.mocked(auth.createUser).mockResolvedValueOnce({ userId: created.id });
    vi.mocked(database.insert).mockResolvedValueOnce(created);

    await useCase.execute({
      actorRole: 'admin',
      email: created.email,
      name: created.name,
      role: 'admin',
      tempPassword: 'Temp#2026!',
    });

    expect(auth.addUserToGroup).toHaveBeenCalledWith(created.id, 'admins');
  });

  it('rejects non-admin callers before invoking Cognito or the database', async () => {
    await expect(
      useCase.execute({
        actorRole: 'user',
        email: 'blocked@example.com',
        name: 'Blocked',
        role: 'user',
        tempPassword: 'Temp#2026!',
      }),
    ).rejects.toThrow('Forbidden: admin role required');

    expect(auth.createUser).not.toHaveBeenCalled();
    expect(database.insert).not.toHaveBeenCalled();
  });
});
