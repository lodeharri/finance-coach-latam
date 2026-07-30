import type { Account } from '../../domain/entities/account.entity';
import type { Transaction } from '../../domain/entities/transaction.entity';
import type { DatabasePort, TableRef } from '../../domain/ports/database.port';
import type { QueueMessage, QueuePublisherPort } from '../../domain/ports/queue.port';
import { assertCanActAs, type Actor } from './authorization';

export interface CreateTransactionInput {
  readonly actor: Actor;
  readonly userId: string;
  readonly accountId: string;
  readonly merchant: string;
  readonly amountCents: number;
  readonly occurredAt: Date;
  readonly notes?: string;
}

export class CreateTransactionUseCase {
  constructor(
    private readonly database: DatabasePort,
    private readonly transactionTableRef: TableRef<Transaction>,
    private readonly accountTableRef: TableRef<Account>,
    private readonly queuePublisher: QueuePublisherPort,
    private readonly queueUrl: string,
  ) {}

  async execute(input: CreateTransactionInput): Promise<Transaction> {
    assertCanActAs(input.actor, input.userId);

    const [account] = await this.database.select(this.accountTableRef, {
      where: { id: input.accountId, userId: input.userId },
      limit: 1,
    });
    if (!account) {
      throw new Error('Account not found');
    }

    const transaction = await this.database.insert<Transaction, Record<string, unknown>>(
      this.transactionTableRef,
      {
        userId: input.userId,
        accountId: input.accountId,
        categoryId: null,
        merchant: input.merchant,
        amount: input.amountCents,
        occurredAt: input.occurredAt,
        status: 'PENDING',
        notes: input.notes ?? null,
      },
    );

    const message: QueueMessage = {
      body: { transactionId: transaction.id, userId: transaction.userId },
    };
    try {
      await this.queuePublisher.publish(this.queueUrl, message);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      console.warn(
        `CreateTransactionUseCase: queue publish failed for transaction ${transaction.id}: ${detail}`,
      );
    }

    return transaction;
  }
}