import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MerchantCacheAdapter } from './merchant-cache.adapter';
import type { DatabasePort } from '../../domain/ports/database.port';

describe('MerchantCacheAdapter', () => {
  let database: DatabasePort & Required<Pick<DatabasePort, 'query'>>;
  let adapter: MerchantCacheAdapter;

  beforeEach(() => {
    database = {
      insert: vi.fn(),
      select: vi.fn(),
      update: vi.fn(),
      query: vi.fn(),
    };
    adapter = new MerchantCacheAdapter(database);
  });

  describe('findByMerchant', () => {
    it('returns null when the cache has no row for the merchant', async () => {
      vi.mocked(database.query).mockResolvedValueOnce([]);

      const result = await adapter.findByMerchant('shell');

      expect(result).toBeNull();
      expect(database.query).toHaveBeenCalledWith(
        expect.stringContaining('FROM merchant_category_cache'),
        ['shell'],
      );
      expect(database.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE merchant = $1'),
        ['shell'],
      );
    });

    it('returns the cached categoryId when a row exists', async () => {
      vi.mocked(database.query).mockResolvedValueOnce([
        { category_id: '40000000-0000-4000-8000-000000000001' },
      ]);

      const result = await adapter.findByMerchant('spotify');

      expect(result).toEqual({
        categoryId: '40000000-0000-4000-8000-000000000001',
      });
    });
  });

  describe('save', () => {
    it('inserts (merchant, categoryId) using ON CONFLICT DO NOTHING for idempotency', async () => {
      vi.mocked(database.query).mockResolvedValueOnce([]);

      await adapter.save('shell', '40000000-0000-4000-8000-000000000001');

      expect(database.query).toHaveBeenCalledTimes(1);
      expect(database.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO merchant_category_cache'),
        ['shell', '40000000-0000-4000-8000-000000000001'],
      );
      expect(database.query).toHaveBeenCalledWith(
        expect.stringContaining('ON CONFLICT (merchant) DO NOTHING'),
        ['shell', '40000000-0000-4000-8000-000000000001'],
      );
    });

    it('is idempotent — a second save for the same merchant does not throw', async () => {
      vi.mocked(database.query).mockResolvedValue([]);

      await expect(
        adapter.save('shell', '40000000-0000-4000-8000-000000000001'),
      ).resolves.toBeUndefined();
      await expect(
        adapter.save('shell', '40000000-0000-4000-8000-000000000002'),
      ).resolves.toBeUndefined();

      expect(database.query).toHaveBeenCalledTimes(2);
    });
  });
});