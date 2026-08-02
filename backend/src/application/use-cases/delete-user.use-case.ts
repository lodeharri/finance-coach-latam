import type { User } from '../../domain/entities/user.entity';
import type { DatabasePort, TableRef } from '../../domain/ports/database.port';
import { assertIsAdmin, type Actor } from './authorization';

export interface DeleteUserInput {
  readonly actor: Actor;
  readonly id: string;
}

/**
 * Delete a user row from `users`.
 *
 * Flow:
 *  1. assertIsAdmin → 403 on non-admin actor.
 *  2. assertNotSelf → 403 when the actor tries to delete their own account
 *     (a self-delete would log the only admin out and break the admin
 *     surface; the SPA disables the button too, but the route is the
 *     authoritative guard).
 *  3. select(id) → 404 'User not found' when the row is absent.
 *  4. `database.delete(id)` — any driver error propagates unchanged so the
 *     route layer surfaces 500.
 *
 * We only delete the local mirror row here. The Cognito identity lives
 * independently; revoking the identity is a separate concern handled by the
 * identity adapter if/when the admin tool grows that capability. For the
 * MVP scope (portfolio demo) the local row delete is enough — the spec
 * asked for a "similar pattern to category DELETE" which is DB-only.
 */
export class DeleteUserUseCase {
  constructor(
    private readonly database: DatabasePort,
    private readonly userTableRef: TableRef<User>,
  ) {}

  async execute(input: DeleteUserInput): Promise<void> {
    assertIsAdmin(input.actor);

    if (input.actor.userId === input.id) {
      throw new Error('Forbidden: cannot delete your own account');
    }

    const existing = await this.database.select(this.userTableRef, {
      where: { id: input.id },
      limit: 1,
    });
    if (existing.length === 0) {
      // routeError maps 'not found' substring to 404.
      throw new Error('User not found');
    }

    await this.database.delete(this.userTableRef, { id: input.id });
  }
}
