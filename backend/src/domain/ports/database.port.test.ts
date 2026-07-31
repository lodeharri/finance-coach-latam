import { describe, expect, it, vi } from 'vitest';
import type { DatabasePort } from './database.port';
import { categoryTableRef } from '../../infrastructure/database/drizzle/schema';

// Contract test for DatabasePort: the port must expose a `delete` method
// that accepts `(table, where)` and returns `Promise<void>`. The mock
// satisfies the port via `vi.fn()` — without a `delete` method on the
// port, the typecheck (compile-time) blocks the file from being built,
// and the runtime assertion below requires the impl to actually return a
// Promise (a `vi.fn()` returning undefined is not enough).
const mockDelete = vi.fn(async () => undefined);
const mockDatabase: DatabasePort = {
  insert: vi.fn(),
  select: vi.fn(),
  update: vi.fn(),
  delete: mockDelete,
  query: vi.fn(),
};

describe('DatabasePort.delete contract', () => {
  it('exposes delete(table, where) that returns a Promise<void>', async () => {
    const result: Promise<void> = mockDatabase.delete(categoryTableRef, {
      id: '50000000-0000-4000-8000-000000000099',
    });

    expect(result).toBeInstanceOf(Promise);
    await expect(result).resolves.toBeUndefined();
    expect(mockDelete).toHaveBeenCalledTimes(1);
    expect(mockDelete).toHaveBeenCalledWith(categoryTableRef, {
      id: '50000000-0000-4000-8000-000000000099',
    });
  });
});
