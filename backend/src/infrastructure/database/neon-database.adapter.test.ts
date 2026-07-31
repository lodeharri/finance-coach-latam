// The Neon adapter test targets the Drizzle-builder boundary by mocking
// `drizzle()` itself. This keeps the test hermetic (no live Neon
// connection) while letting us observe the exact `db.delete(...).where(...)`
// shape the adapter produces. The mock builder mirrors the real
// PgDeleteBase surface: `where()` returns a thenable that resolves to the
// driver's query result.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NeonDatabaseAdapter } from './neon-database.adapter';
import { categoryTable, categoryTableRef } from './drizzle/schema';

interface MockDeleteBuilder {
  readonly where: ReturnType<typeof vi.fn>;
}

const mockWhere = vi.fn();
const mockDeleteBuilder: MockDeleteBuilder = { where: mockWhere };

const mockDb = {
  insert: vi.fn(),
  select: vi.fn(),
  update: vi.fn(),
  delete: vi.fn().mockReturnValue(mockDeleteBuilder),
  execute: vi.fn(),
};

vi.mock('drizzle-orm/neon-http', () => ({
  drizzle: vi.fn(() => mockDb),
}));

vi.mock('@neondatabase/serverless', () => ({
  neon: vi.fn(() => () => Promise.resolve({ rows: [] })),
}));

describe('NeonDatabaseAdapter.delete', () => {
  let adapter: NeonDatabaseAdapter;

  beforeEach(() => {
    mockDb.delete.mockClear();
    mockWhere.mockClear();
    mockDb.delete.mockReturnValue(mockDeleteBuilder);
    adapter = new NeonDatabaseAdapter('postgres://test:test@localhost/test');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('issues a Drizzle DELETE against the resolved pg table with the requested condition', async () => {
    mockWhere.mockResolvedValueOnce({ rows: [] });

    await adapter.delete(categoryTableRef, {
      id: '50000000-0000-4000-8000-000000000099',
    });

    expect(mockDb.delete).toHaveBeenCalledTimes(1);
    expect(mockDb.delete).toHaveBeenCalledWith(categoryTable);
    expect(mockWhere).toHaveBeenCalledTimes(1);
    // The `and(...)` wrapper produces a SQL node; asserting the shape
    // here is brittle, so we just confirm `where()` received exactly one
    // argument (the SQL expression).
    expect(mockWhere.mock.calls[0]).toHaveLength(1);
  });

  it('supports multiple filter conditions by chaining them with and()', async () => {
    mockWhere.mockResolvedValueOnce({ rows: [] });

    await adapter.delete(categoryTableRef, {
      id: '50000000-0000-4000-8000-000000000099',
      slug: 'transporte',
    });

    expect(mockDb.delete).toHaveBeenCalledTimes(1);
    expect(mockDb.delete).toHaveBeenCalledWith(categoryTable);
    // two conditions → and(...) wraps two SQL nodes → still one arg to where
    expect(mockWhere.mock.calls[0]).toHaveLength(1);
  });

  it('rejects when no conditions are provided (mirrors update: at least one filter is required)', async () => {
    await expect(adapter.delete(categoryTableRef, {})).rejects.toThrow(
      'at least one filter is required',
    );

    expect(mockDb.delete).not.toHaveBeenCalled();
    expect(mockWhere).not.toHaveBeenCalled();
  });

  it('resolves to undefined when the underlying DELETE matches zero rows (idempotent at the row layer)', async () => {
    mockWhere.mockResolvedValueOnce({ rows: [] });

    await expect(
      adapter.delete(categoryTableRef, {
        id: '50000000-0000-4000-8000-000000000000',
      }),
    ).resolves.toBeUndefined();

    expect(mockDb.delete).toHaveBeenCalledTimes(1);
    expect(mockWhere).toHaveBeenCalledTimes(1);
  });

  it('propagates errors from the underlying Drizzle chain', async () => {
    const driverError = new Error('foreign key constraint');
    mockWhere.mockRejectedValueOnce(driverError);

    await expect(
      adapter.delete(categoryTableRef, {
        id: '50000000-0000-4000-8000-000000000042',
      }),
    ).rejects.toThrow('foreign key constraint');

    expect(mockDb.delete).toHaveBeenCalledTimes(1);
  });
});
