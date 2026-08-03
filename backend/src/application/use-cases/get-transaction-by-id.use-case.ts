import type { Transaction } from '../../domain/entities/transaction.entity';
import type { DatabasePort, TableRef } from '../../domain/ports/database.port';
import { assertCanActAs, type Actor } from './authorization';

export interface GetTransactionByIdInput {
  readonly actor: Actor;
  readonly id: string;
}

/**
 * REQ-FFC-BE-GET-TRANSACTION: read a single transaction by id. Loads the
 * row first and asserts the actor is the owner or an admin against the
 * row's real userId. A non-existent id surfaces as `Transaction not found`
 * (mapped to 404 by the route layer).
 *
 * Used by the per-transaction polling endpoint (GET /transactions/{id}) —
 * the categorizer worker writes a CATEGORIZED row back, and the SPA polls
 * the row every few seconds to detect resolution without re-querying the
 * full list.
 */
export class GetTransactionByIdUseCase {
  constructor(
    private readonly database: DatabasePort,
    private readonly transactionTableRef: TableRef<Transaction>,
  ) {}

  async execute(input: GetTransactionByIdInput): Promise<Transaction> {
    const [transaction] = await this.database.select(this.transactionTableRef, {
      where: { id: input.id },
      limit: 1,
    });
    if (!transaction) {
      throw new Error('Transaction not found');
    }

    assertCanActAs(input.actor, transaction.userId);

    return transaction;
  }
}
