import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CreateTransactionUseCase } from './create-transaction.use-case';
import type { Account } from '../../domain/entities/account.entity';
import type { Transaction } from '../../domain/entities/transaction.entity';
import type { DatabasePort } from '../../domain/ports/database.port';
import type { QueuePublisherPort } from '../../domain/ports/queue.port';
import {
  accountTableRef,
  transactionTableRef,
} from '../../infrastructure/database/drizzle/schema';

const occurredAt = new Date('2026-07-15T12:00:00Z');
const queueUrl = 'https://sqs.us-east-1.amazonaws.com/123456789012/categorizer';

function transaction(notes: string | null): Transaction {
  return {
    id: '30000000-0000-4000-8000-000000000001',
    userId: '10000000-0000-4000-8000-000000000001',
    accountId: '20000000-0000-4000-8000-000000000001',
    categoryId: null,
    merchant: 'Café Martínez',
    amount: 850000,
    occurredAt,
    createdAt: occurredAt,
    status: 'PENDING',
    notes,
  };
}

function ownedAccount(item: Transaction): Account {
  return {
    id: item.accountId,
    userId: item.userId,
    name: 'Banco Demo',
    type: 'BANK',
    createdAt: occurredAt,
  };
}

describe('CreateTransactionUseCase', () => {
  let database: DatabasePort;
  let queuePublisher: QueuePublisherPort;
  let useCase: CreateTransactionUseCase;

  beforeEach(() => {
    database = {
      insert: vi.fn(),
      select: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };
    queuePublisher = {
      publish: vi.fn().mockResolvedValue(undefined),
    };
    useCase = new CreateTransactionUseCase(
      database,
      transactionTableRef,
      accountTableRef,
      queuePublisher,
      queueUrl,
    );
  });

  it('creates a pending transaction for its owner and publishes a categorization message', async () => {
    const created = transaction(null);
    vi.mocked(database.select).mockResolvedValueOnce([ownedAccount(created)]);
    vi.mocked(database.insert).mockResolvedValueOnce(created);

    const result = await useCase.execute({
      actor: { userId: created.userId, role: 'user' },
      userId: created.userId,
      accountId: created.accountId,
      merchant: created.merchant,
      amountCents: created.amount,
      occurredAt,
    });

    expect(database.select).toHaveBeenCalledWith(accountTableRef, {
      where: { id: created.accountId, userId: created.userId },
      limit: 1,
    });
    expect(database.insert).toHaveBeenCalledWith(transactionTableRef, {
      userId: created.userId,
      accountId: created.accountId,
      categoryId: null,
      merchant: created.merchant,
      amount: created.amount,
      occurredAt,
      status: 'PENDING',
      notes: null,
    });
    expect(queuePublisher.publish).toHaveBeenCalledWith(queueUrl, {
      body: { transactionId: created.id, userId: created.userId },
    });
    expect(result).toBe(created);
  });

  it('allows an admin to create a transaction with notes for another user', async () => {
    const created = transaction('Client lunch');
    vi.mocked(database.select).mockResolvedValueOnce([ownedAccount(created)]);
    vi.mocked(database.insert).mockResolvedValueOnce(created);

    await useCase.execute({
      actor: { userId: 'admin-id', role: 'admin' },
      userId: created.userId,
      accountId: created.accountId,
      merchant: created.merchant,
      amountCents: created.amount,
      occurredAt,
      notes: 'Client lunch',
    });

    expect(database.insert).toHaveBeenCalledWith(
      transactionTableRef,
      expect.objectContaining({ notes: 'Client lunch' }),
    );
    expect(queuePublisher.publish).toHaveBeenCalledWith(queueUrl, {
      body: { transactionId: created.id, userId: created.userId },
    });
  });

  it('rejects a transaction when the account does not belong to the target user', async () => {
    vi.mocked(database.select).mockResolvedValueOnce([]);

    await expect(
      useCase.execute({
        actor: { userId: 'target-user', role: 'user' },
        userId: 'target-user',
        accountId: 'foreign-account',
        merchant: 'Merchant',
        amountCents: 100,
        occurredAt,
      }),
    ).rejects.toThrow('Account not found');
    expect(database.insert).not.toHaveBeenCalled();
    expect(queuePublisher.publish).not.toHaveBeenCalled();
  });

  it('rejects a user acting on another user', async () => {
    await expect(
      useCase.execute({
        actor: { userId: 'other-user', role: 'user' },
        userId: 'target-user',
        accountId: 'account-id',
        merchant: 'Merchant',
        amountCents: 100,
        occurredAt,
      }),
    ).rejects.toThrow('Forbidden: users can only act on their own resources');
    expect(database.insert).not.toHaveBeenCalled();
    expect(queuePublisher.publish).not.toHaveBeenCalled();
  });

  it('still returns the created transaction if the queue publish fails', async () => {
    const created = transaction(null);
    vi.mocked(database.select).mockResolvedValueOnce([ownedAccount(created)]);
    vi.mocked(database.insert).mockResolvedValueOnce(created);
    vi.mocked(queuePublisher.publish).mockRejectedValueOnce(
      new Error('SQS unavailable'),
    );
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await useCase.execute({
      actor: { userId: created.userId, role: 'user' },
      userId: created.userId,
      accountId: created.accountId,
      merchant: created.merchant,
      amountCents: created.amount,
      occurredAt,
    });

    expect(result).toBe(created);
    expect(warn).toHaveBeenCalled();
  });
});