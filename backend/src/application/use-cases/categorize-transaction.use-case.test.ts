import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CategorizeTransactionUseCase } from './categorize-transaction.use-case';
import type { Transaction } from '../../domain/entities/transaction.entity';
import type { DatabasePort } from '../../domain/ports/database.port';
import type { LLMPort } from '../../domain/ports/llm.port';
import type { MerchantCachePort } from '../../domain/ports/merchant-cache.port';
import { transactionTableRef } from '../../infrastructure/database/drizzle/schema';

const userId = '10000000-0000-4000-8000-000000000001';
const otherUserId = '10000000-0000-4000-8000-000000000002';
const transactionId = '30000000-0000-4000-8000-000000000001';
const transporteId = '40000000-0000-4000-8000-000000000002';
const alimentosId = '40000000-0000-4000-8000-000000000001';

function makeTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: transactionId,
    userId,
    accountId: '20000000-0000-4000-8000-000000000001',
    categoryId: null,
    merchant: 'PedidosYa',
    amount: 4200000,
    occurredAt: new Date('2026-07-15T12:00:00Z'),
    createdAt: new Date('2026-07-15T12:01:00Z'),
    status: 'PENDING',
    notes: null,
    ...overrides,
  };
}

const transaction = makeTransaction();

const transporteCategoryRow = { id: transporteId, slug: 'transporte' };

describe('CategorizeTransactionUseCase', () => {
  let database: DatabasePort & Required<Pick<DatabasePort, 'query'>>;
  let llm: LLMPort;
  let merchantCache: MerchantCachePort;
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
    merchantCache = {
      findByMerchant: vi.fn(),
      save: vi.fn(),
    };
    useCase = new CategorizeTransactionUseCase(
      database,
      llm,
      transactionTableRef,
      merchantCache,
    );
    // Default: cache misses everywhere unless a test overrides.
    vi.mocked(merchantCache.findByMerchant).mockResolvedValue(null);
    vi.mocked(merchantCache.save).mockResolvedValue(undefined);
  });

  // ─── existing scenarios (updated for the keyword + cache + 4-arg flow) ──

  it('uses pgvector similarity to pick top-5 categories and stores the LLM decision', async () => {
    const pedidosya = makeTransaction({ merchant: 'PedidosYa' });
    // Distances picked to land in the ambiguity band: ratio 0.3/0.4 = 0.75 ≥ 0.5,
    // so the LLM must be consulted and the use case takes the ambiguity path.
    const ambiguousRanking = [
      { id: transporteId, slug: 'transporte', name: 'Transporte', distance: 0.3 },
      { id: alimentosId, slug: 'alimentos', name: 'Alimentos', distance: 0.4 },
    ];
    const categorized: Transaction = {
      ...pedidosya,
      categoryId: ambiguousRanking[0]!.id,
      status: 'CATEGORIZED',
    };
    vi.mocked(database.select).mockResolvedValueOnce([pedidosya]);
    vi.mocked(llm.embed).mockResolvedValueOnce([1, 0]);
    vi.mocked(database.query).mockResolvedValueOnce(ambiguousRanking);
    vi.mocked(llm.generateText).mockResolvedValueOnce(ambiguousRanking[0]!.id);
    vi.mocked(database.update).mockResolvedValueOnce(categorized);

    const result = await useCase.execute({
      actor: { userId, role: 'user' },
      transactionId,
      userId,
    });

    expect(llm.embed).toHaveBeenCalledTimes(1);
    expect(llm.embed).toHaveBeenCalledWith('PedidosYa');
    expect(database.query).toHaveBeenCalledTimes(1);
    expect(database.query).toHaveBeenCalledWith(
      expect.stringContaining('embedding <=> $1::vector'),
      [JSON.stringify([1, 0])],
    );
    expect(llm.generateText).toHaveBeenCalledWith(
      expect.stringContaining('Return only the category UUID.'),
    );
    expect(llm.generateText).toHaveBeenCalledWith(
      expect.stringContaining(ambiguousRanking[0]!.id),
    );
    expect(database.update).toHaveBeenCalledWith(
      transactionTableRef,
      { id: transactionId, userId },
      { categoryId: ambiguousRanking[0]!.id, status: 'CATEGORIZED' },
    );
    expect(merchantCache.save).toHaveBeenCalledWith('pedidosya', ambiguousRanking[0]!.id);
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
    expect(merchantCache.findByMerchant).not.toHaveBeenCalled();
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
    expect(database.update).not.toHaveBeenCalled();
  });

  it('rejects an unknown category returned by the LLM', async () => {
    // Distances that land in the ambiguity band so the LLM is consulted and the
    // 'unknown category' branch runs (auto-accept would short-circuit otherwise).
    const ambiguousRanking = [
      { id: transporteId, slug: 'transporte', name: 'Transporte', distance: 0.3 },
      { id: alimentosId, slug: 'alimentos', name: 'Alimentos', distance: 0.4 },
    ];
    vi.mocked(database.select).mockResolvedValueOnce([transaction]);
    vi.mocked(llm.embed).mockResolvedValueOnce([1, 0]);
    vi.mocked(database.query).mockResolvedValueOnce(ambiguousRanking);
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

  // ─── 9 new scenarios (REQ-TC-001..009) ─────────────────────────────────

  it('keyword hit: assigns the mapped category, 0 embed, 0 generateText, 1 update', async () => {
    const shell = makeTransaction({ merchant: 'Shell' });
    const categorized: Transaction = {
      ...shell,
      categoryId: transporteId,
      status: 'CATEGORIZED',
    };
    vi.mocked(database.select).mockResolvedValueOnce([shell]);
    // Keyword layer resolves category by slug via the raw-SQL escape hatch.
    vi.mocked(database.query).mockResolvedValueOnce([transporteCategoryRow]);
    vi.mocked(database.update).mockResolvedValueOnce(categorized);

    const result = await useCase.execute({
      actor: { userId, role: 'user' },
      transactionId,
      userId,
    });

    expect(llm.embed).not.toHaveBeenCalled();
    expect(llm.generateText).not.toHaveBeenCalled();
    expect(database.query).toHaveBeenCalledTimes(1);
    expect(database.query).toHaveBeenCalledWith(
      expect.stringContaining('FROM categories WHERE slug = $1'),
      ['transporte'],
    );
    expect(database.update).toHaveBeenCalledWith(
      transactionTableRef,
      { id: transactionId, userId },
      { categoryId: transporteId, status: 'CATEGORIZED' },
    );
    expect(merchantCache.save).toHaveBeenCalledWith('shell', transporteId);
    expect(result).toBe(categorized);
  });

  it('cache hit: assigns the cached categoryId, 0 embed, 0 generateText', async () => {
    const pedidosya = makeTransaction({ merchant: 'PedidosYa' });
    const categorized: Transaction = {
      ...pedidosya,
      categoryId: alimentosId,
      status: 'CATEGORIZED',
    };
    vi.mocked(database.select).mockResolvedValueOnce([pedidosya]);
    vi.mocked(merchantCache.findByMerchant).mockResolvedValueOnce({
      categoryId: alimentosId,
    });
    vi.mocked(database.update).mockResolvedValueOnce(categorized);

    const result = await useCase.execute({
      actor: { userId, role: 'user' },
      transactionId,
      userId,
    });

    expect(llm.embed).not.toHaveBeenCalled();
    expect(llm.generateText).not.toHaveBeenCalled();
    expect(database.query).not.toHaveBeenCalled();
    expect(database.update).toHaveBeenCalledWith(
      transactionTableRef,
      { id: transactionId, userId },
      { categoryId: alimentosId, status: 'CATEGORIZED' },
    );
    // No cache write-back when the entry was already there.
    expect(merchantCache.save).not.toHaveBeenCalled();
    expect(result).toBe(categorized);
  });

  it('auto-accept threshold: distances [0.10, 0.40] → top-1 wins, 1 embed, 0 generateText', async () => {
    const pedidosya = makeTransaction({ merchant: 'PedidosYa' });
    const categorized: Transaction = {
      ...pedidosya,
      categoryId: transporteId,
      status: 'CATEGORIZED',
    };
    vi.mocked(database.select).mockResolvedValueOnce([pedidosya]);
    vi.mocked(llm.embed).mockResolvedValueOnce([1, 0]);
    vi.mocked(database.query).mockResolvedValueOnce([
      { id: transporteId, slug: 'transporte', name: 'Transporte', distance: 0.1 },
      { id: alimentosId, slug: 'alimentos', name: 'Alimentos', distance: 0.4 },
    ]);
    vi.mocked(database.update).mockResolvedValueOnce(categorized);

    await useCase.execute({
      actor: { userId, role: 'user' },
      transactionId,
      userId,
    });

    expect(llm.embed).toHaveBeenCalledTimes(1);
    expect(llm.generateText).not.toHaveBeenCalled();
    expect(database.update).toHaveBeenCalledWith(
      transactionTableRef,
      { id: transactionId, userId },
      { categoryId: transporteId, status: 'CATEGORIZED' },
    );
    expect(merchantCache.save).toHaveBeenCalledWith('pedidosya', transporteId);
  });

  it('ambiguity: distances [0.30, 0.40] → ratio ≥ 0.5, calls generateText', async () => {
    const pedidosya = makeTransaction({ merchant: 'PedidosYa' });
    const categorized: Transaction = {
      ...pedidosya,
      categoryId: alimentosId,
      status: 'CATEGORIZED',
    };
    vi.mocked(database.select).mockResolvedValueOnce([pedidosya]);
    vi.mocked(llm.embed).mockResolvedValueOnce([1, 0]);
    vi.mocked(database.query).mockResolvedValueOnce([
      { id: transporteId, slug: 'transporte', name: 'Transporte', distance: 0.3 },
      { id: alimentosId, slug: 'alimentos', name: 'Alimentos', distance: 0.4 },
    ]);
    vi.mocked(llm.generateText).mockResolvedValueOnce(alimentosId);
    vi.mocked(database.update).mockResolvedValueOnce(categorized);

    await useCase.execute({
      actor: { userId, role: 'user' },
      transactionId,
      userId,
    });

    expect(llm.embed).toHaveBeenCalledTimes(1);
    expect(llm.generateText).toHaveBeenCalledTimes(1);
    expect(database.update).toHaveBeenCalledWith(
      transactionTableRef,
      { id: transactionId, userId },
      { categoryId: alimentosId, status: 'CATEGORIZED' },
    );
    expect(merchantCache.save).toHaveBeenCalledWith('pedidosya', alimentosId);
  });

  it('embedding failure with no keyword: writes status PENDING, 0 generateText, no throw', async () => {
    const pedidosya = makeTransaction({ merchant: 'PedidosYa' });
    const pending: Transaction = { ...pedidosya, status: 'PENDING' };
    vi.mocked(database.select).mockResolvedValueOnce([pedidosya]);
    vi.mocked(llm.embed).mockRejectedValueOnce(new Error('quota exceeded'));
    vi.mocked(database.update).mockResolvedValueOnce(pending);

    const result = await useCase.execute({
      actor: { userId, role: 'user' },
      transactionId,
      userId,
    });

    expect(llm.generateText).not.toHaveBeenCalled();
    expect(database.query).not.toHaveBeenCalled();
    expect(database.update).toHaveBeenCalledTimes(1);
    expect(database.update).toHaveBeenCalledWith(
      transactionTableRef,
      { id: transactionId, userId },
      { status: 'PENDING' },
    );
    expect(merchantCache.save).not.toHaveBeenCalled();
    expect(result).toBe(pending);
  });

  it('cache write failure: transaction still updated, use case resolves', async () => {
    const pedidosya = makeTransaction({ merchant: 'PedidosYa' });
    const categorized: Transaction = {
      ...pedidosya,
      categoryId: transporteId,
      status: 'CATEGORIZED',
    };
    vi.mocked(database.select).mockResolvedValueOnce([pedidosya]);
    vi.mocked(llm.embed).mockResolvedValueOnce([1, 0]);
    vi.mocked(database.query).mockResolvedValueOnce([
      { id: transporteId, slug: 'transporte', name: 'Transporte', distance: 0.1 },
    ]);
    vi.mocked(database.update).mockResolvedValueOnce(categorized);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.mocked(merchantCache.save).mockRejectedValueOnce(new Error('cache write boom'));

    const result = await useCase.execute({
      actor: { userId, role: 'user' },
      transactionId,
      userId,
    });

    expect(database.update).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(
      'merchant cache write failed',
      expect.objectContaining({ merchant: 'pedidosya' }),
    );
    expect(result).toBe(categorized);
    warnSpy.mockRestore();
  });

  it('merchant normalization: extra whitespace and casing collapse before keyword lookup', async () => {
    const messy = makeTransaction({ merchant: '  Shell   OIL  ' });
    const categorized: Transaction = {
      ...messy,
      categoryId: transporteId,
      status: 'CATEGORIZED',
    };
    vi.mocked(database.select).mockResolvedValueOnce([messy]);
    // Keyword layer resolves category by slug via raw SQL.
    vi.mocked(database.query).mockResolvedValueOnce([transporteCategoryRow]);
    vi.mocked(database.update).mockResolvedValueOnce(categorized);

    await useCase.execute({
      actor: { userId, role: 'user' },
      transactionId,
      userId,
    });

    expect(llm.embed).not.toHaveBeenCalled();
    expect(database.query).toHaveBeenCalledTimes(1);
    expect(database.query).toHaveBeenCalledWith(
      expect.stringContaining('FROM categories WHERE slug = $1'),
      ['transporte'],
    );
    expect(merchantCache.save).toHaveBeenCalledWith('shell oil', transporteId);
  });

  it('rejects when assertCanActAs denies the actor', async () => {
    await expect(
      useCase.execute({
        actor: { userId: otherUserId, role: 'user' },
        transactionId,
        userId,
      }),
    ).rejects.toThrow('Forbidden: users can only act on their own resources');
    expect(database.select).not.toHaveBeenCalled();
    expect(llm.embed).not.toHaveBeenCalled();
  });
});