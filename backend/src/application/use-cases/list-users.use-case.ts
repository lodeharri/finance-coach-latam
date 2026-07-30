import type { User } from '../../domain/entities/user.entity';
import type { UserRole } from '../../domain/ports/cognito.port';
import type { DatabasePort, TableRef } from '../../domain/ports/database.port';

export class ListUsersUseCase {
  constructor(
    private readonly database: DatabasePort,
    private readonly userTableRef: TableRef<User>,
  ) {}

  async execute(input: { readonly actorRole: UserRole }): Promise<User[]> {
    if (input.actorRole !== 'admin') {
      throw new Error('Forbidden: only admins can list users');
    }

    return this.database.select(this.userTableRef);
  }
}
