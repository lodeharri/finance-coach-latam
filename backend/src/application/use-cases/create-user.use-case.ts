import type { User } from '../../domain/entities/user.entity';
import type { AuthPort, UserRole } from '../../domain/ports/cognito.port';
import type { DatabasePort, TableRef } from '../../domain/ports/database.port';
import { assertIsAdmin } from './authorization';

export interface CreateUserInput {
  readonly actorRole: UserRole;
  readonly email: string;
  readonly name: string;
  readonly role: UserRole;
  readonly tempPassword: string;
}

export class CreateUserUseCase {
  constructor(
    private readonly database: DatabasePort,
    private readonly auth: AuthPort,
    private readonly userTableRef: TableRef<User>,
  ) {}

  async execute(input: CreateUserInput): Promise<User> {
    assertIsAdmin({ userId: 'system', role: input.actorRole });

    const identity = await this.auth.createUser({
      email: input.email,
      name: input.name,
      role: input.role,
      tempPassword: input.tempPassword,
    });
    await this.auth.addUserToGroup(
      identity.userId,
      input.role === 'admin' ? 'admins' : 'users',
    );

    return this.database.insert<User, Record<string, unknown>>(this.userTableRef, {
      id: identity.userId,
      email: input.email,
      name: input.name,
      tier: 'BRONZE',
    });
  }
}
