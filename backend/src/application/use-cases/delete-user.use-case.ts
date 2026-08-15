import type { User } from '../../domain/entities/user.entity';
import type { AuthPort } from '../../domain/ports/cognito.port';
import type { DatabasePort, TableRef } from '../../domain/ports/database.port';
import { assertIsAdmin, type Actor } from './authorization';

export interface DeleteUserInput {
  readonly actor: Actor;
  readonly id: string;
}

/**
 * Delete a user row from `users` and revoke the matching Cognito identity.
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
 *  5. `auth.deleteUser(id)` — a Cognito API failure is intentionally
 *     swallowed. The local DB row is the source of truth for this app;
 *     losing it is unrecoverable, while an orphaned Cognito identity can
 *     be reaped by a follow-up admin sweep. Preserving the prior
 *     invariant is more important than a clean cross-system delete.
 */
export class DeleteUserUseCase {
  constructor(
    private readonly database: DatabasePort,
    private readonly auth: AuthPort,
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
    await this.auth.deleteUser(input.id).catch(() => undefined);
  }
}
