import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CategorizeTransactionUseCase } from './categorize-transaction.use-case';
import type { Transaction } from '../../domain/entities/transaction.entity';
import type { DatabasePort } from '../../domain/ports/database.port';
import type { LLMPort } from '../../domain/ports/llm.port';
import { transactionTableRef } from '../../infrastructure/database/drizzle/schema';

const userId = '10000000-0000-4000-8000-000000000001';
const transactionId = '30000000-0000-4000-8000-000000000001';
const transaction: Transaction = {
  id: transactionId,
  userId,
  accountId: '20000000-0000-4000-8000-000000000001',
  categoryId: null,
  merchant: 'Shell',
  amount: 4200000,
  occurredAt: new Date('2026-07-15T12:00:00Z'),
  createdAt: new Date('2026-07-15T12:01:00Z'),
  status: 'PENDING',
  notes: null,
};

const rankedFromDatabase = [
  {
    id: '40000000-0000-4000-8000-000000000002',
    slug: 'transporte',
    name: 'Transporte',
    distance: 0.12,
  },
  {
    id: '40000000-0000-4000-8000-000000000001',
    slug: 'alimentos',
    name: 'Alimentos',
    distance: 0.4,
  },
];

describe('CategorizeTransactionUseCase', () => {
  let database: DatabasePort & Required<Pick<DatabasePort, 'query'>>;
  let llm: LLMPort;
  let useCase: CategorizeTransactionUseCase;

  beforeEach(() => {
    database = {
      insert: vi.fn(),
      select: vi.fn(),
      update: vi.fn(),
      query: vi.fn(),
    };
    llm = {
      generateText: vi.fn(),
      embed: vi.fn(),
    };
    useCase = new CategorizeTransactionUseCase(
      database,
      llm,
      transactionTableRef,
    );
  });

  it('uses pgvector similarity to pick top-5 categories and stores the LLM decision', async () => {
    const categorized: Transaction = {
      ...transaction,
      categoryId: rankedFromDatabase[0]!.id,
      status: 'CATEGORIZED',
    };
    vi.mocked(database.select).mockResolvedValueOnce([transaction]);
    vi.mocked(llm.embed).mockResolvedValueOnce([1, 0]);
    vi.mocked(database.query).mockResolvedValueOnce(rankedFromDatabase);
    vi.mocked(llm.generateText).mockResolvedValueOnce(rankedFromDatabase[0]!.id);
    vi.mocked(database.update).mockResolvedValueOnce(categorized);

    const result = await useCase.execute({
      actor: { userId, role: 'user' },
      transactionId,
      userId,
    });

    expect(llm.embed).toHaveBeenCalledTimes(1);
    expect(llm.embed).toHaveBeenCalledWith('Shell');
    expect(database.query).toHaveBeenCalledTimes(1);
    expect(database.query).toHaveBeenCalledWith(
      expect.stringContaining('embedding <=> $1::vector'),
      [JSON.stringify([1, 0])],
    );
    expect(llm.generateText).toHaveBeenCalledWith(
      expect.stringContaining('Return only the category UUID.'),
    );
    expect(llm.generateText).toHaveBeenCalledWith(
      expect.stringContaining(rankedFromDatabase[0]!.id),
    );
    expect(database.update).toHaveBeenCalledWith(
      transactionTableRef,
      { id: transactionId, userId },
      { categoryId: rankedFromDatabase[0]!.id, status: 'CATEGORIZED' },
    );
    expect(result).toBe(categorized);
  });

  it('fails when the requested transaction does not exist', async () => {
    vi.mocked(database.select).mockResolvedValueOnce([]);

    await expect(
      useCase.execute({
        actor: { userId: 'admin-id', role: 'admin' },
        transactionId,
        userId,
      }),
    ).rejects.toThrow('Transaction not found');
    expect(llm.embed).not.toHaveBeenCalled();
    expect(database.query).not.toHaveBeenCalled();
  });

  it('fails when no categories with embeddings exist', async () => {
    vi.mocked(database.select).mockResolvedValueOnce([transaction]);
    vi.mocked(llm.embed).mockResolvedValueOnce([1, 0]);
    vi.mocked(database.query).mockResolvedValueOnce([] as never);

    await expect(
      useCase.execute({
        actor: { userId, role: 'user' },
        transactionId,
        userId,
      }),
    ).rejects.toThrow('No categories are available');
    expect(llm.generateText).not.toHaveBeenCalled();
  });

  it('rejects an unknown category returned by the LLM', async () => {
    vi.mocked(database.select).mockResolvedValueOnce([transaction]);
    vi.mocked(llm.embed).mockResolvedValueOnce([1, 0]);
    vi.mocked(database.query).mockResolvedValueOnce(rankedFromDatabase);
    vi.mocked(llm.generateText).mockResolvedValueOnce('not-a-category');

    await expect(
      useCase.execute({
        actor: { userId, role: 'user' },
        transactionId,
        userId,
      }),
    ).rejects.toThrow('LLM returned an unknown category');
    expect(database.update).not.toHaveBeenCalled();
  });
});