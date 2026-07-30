import type { Account, AccountType } from '../../domain/entities/account.entity';
import type { DatabasePort, TableRef } from '../../domain/ports/database.port';
import { assertCanActAs, type Actor } from './authorization';

export interface CreateAccountInput {
  readonly actor: Actor;
  readonly userId: string;
  readonly name: string;
  readonly type: AccountType;
}

export class CreateAccountUseCase {
  constructor(
    private readonly database: DatabasePort,
    private readonly accountTableRef: TableRef<Account>,
  ) {}

  async execute(input: CreateAccountInput): Promise<Account> {
    assertCanActAs(input.actor, input.userId);

    return this.database.insert<Account, Record<string, unknown>>(
      this.accountTableRef,
      {
        userId: input.userId,
        name: input.name,
        type: input.type,
      },
    );
  }
}
