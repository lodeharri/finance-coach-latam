import type { Account } from '../../domain/entities/account.entity';
import type { DatabasePort, TableRef } from '../../domain/ports/database.port';
import { assertCanActAs, type Actor } from './authorization';

export interface ListAccountsByUserInput {
  readonly actor: Actor;
  readonly userId: string;
}

export class ListAccountsByUserUseCase {
  constructor(
    private readonly database: DatabasePort,
    private readonly accountTableRef: TableRef<Account>,
  ) {}

  async execute(input: ListAccountsByUserInput): Promise<Account[]> {
    assertCanActAs(input.actor, input.userId);

    return this.database.select(this.accountTableRef, {
      where: { userId: input.userId },
      orderBy: { field: 'createdAt', direction: 'desc' },
    });
  }
}
