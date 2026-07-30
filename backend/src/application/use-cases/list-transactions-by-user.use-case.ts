import type { Transaction } from '../../domain/entities/transaction.entity';
import type { DatabasePort, TableRef } from '../../domain/ports/database.port';
import { assertCanActAs, type Actor } from './authorization';

export interface ListTransactionsByUserInput {
  readonly actor: Actor;
  readonly userId: string;
  readonly limit?: number;
}

export class ListTransactionsByUserUseCase {
  constructor(
    private readonly database: DatabasePort,
    private readonly transactionTableRef: TableRef<Transaction>,
  ) {}

  async execute(input: ListTransactionsByUserInput): Promise<Transaction[]> {
    assertCanActAs(input.actor, input.userId);

    return this.database.select(this.transactionTableRef, {
      where: { userId: input.userId },
      orderBy: { field: 'occurredAt', direction: 'desc' },
      limit: input.limit ?? 50,
    });
  }
}
