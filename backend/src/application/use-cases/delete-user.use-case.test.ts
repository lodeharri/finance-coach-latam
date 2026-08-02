import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DeleteUserUseCase } from './delete-user.use-case';
import type { User } from '../../domain/entities/user.entity';
import type { DatabasePort } from '../../domain/ports/database.port';
import { userTableRef } from '../../infrastructure/database/drizzle/schema';

const adminActor = { userId: 'admin-1', role: 'admin' as const };
const userActor = { userId: 'user-1', role: 'user' as const };
const targetUser: User = {
  id: '22222222-2222-4222-8222-222222222222',
  email: 'target@example.com',
  name: 'Target',
  tier: 'BRONZE',
  createdAt: new Date('2026-07-01T00:00:00Z'),
};

describe('DeleteUserUseCase', () => {
  let database: DatabasePort;
  let useCase: DeleteUserUseCase;

  beforeEach(() => {
    database = {
      insert: vi.fn(),
      select: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };
    useCase = new DeleteUserUseCase(database, userTableRef);
  });

  it('deletes the user row when the actor is admin and the target is not self', async () => {
    vi.mocked(database.select).mockResolvedValueOnce([targetUser]);
    vi.mocked(database.delete).mockResolvedValueOnce(undefined);

    await useCase.execute({ actor: adminActor, id: targetUser.id });

    expect(database.select).toHaveBeenCalledWith(userTableRef, {
      where: { id: targetUser.id },
      limit: 1,
    });
    expect(database.delete).toHaveBeenCalledWith(userTableRef, { id: targetUser.id });
  });

  it('rejects a non-admin actor before touching the database', async () => {
    await expect(
      useCase.execute({ actor: userActor, id: targetUser.id }),
    ).rejects.toThrow('Forbidden: admin role required');

    expect(database.select).not.toHaveBeenCalled();
    expect(database.delete).not.toHaveBeenCalled();
  });

  it('rejects an admin actor who tries to delete their own account', async () => {
    await expect(
      useCase.execute({ actor: adminActor, id: adminActor.userId }),
    ).rejects.toThrow('Forbidden: cannot delete your own account');

    expect(database.select).not.toHaveBeenCalled();
    expect(database.delete).not.toHaveBeenCalled();
  });

  it('throws a not-found error when the user id does not exist', async () => {
    vi.mocked(database.select).mockResolvedValueOnce([]);

    await expect(
      useCase.execute({
        actor: adminActor,
        id: '99999999-9999-4999-8999-999999999999',
      }),
    ).rejects.toThrow('User not found');

    expect(database.delete).not.toHaveBeenCalled();
  });

  it('propagates database.delete errors unchanged', async () => {
    const driverError = new Error('connection terminated');
    vi.mocked(database.select).mockResolvedValueOnce([targetUser]);
    vi.mocked(database.delete).mockRejectedValueOnce(driverError);

    await expect(
      useCase.execute({ actor: adminActor, id: targetUser.id }),
    ).rejects.toThrow('connection terminated');
  });
});
