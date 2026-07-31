import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ListHealthChecksUseCase } from './list-health-checks.use-case';
import type { DatabasePort, TableRef } from '../../domain/ports/database.port';
import type { HealthCheck } from '../../domain/entities/health-check.entity';
import { healthCheckTableRef } from '../../infrastructure/database/drizzle/schema';

describe('ListHealthChecksUseCase', () => {
  let database: DatabasePort;
  let useCase: ListHealthChecksUseCase;
  let tableRef: TableRef<HealthCheck>;

  beforeEach(() => {
    database = {
      insert: vi.fn(),
      select: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };
    tableRef = healthCheckTableRef;
    useCase = new ListHealthChecksUseCase(database, tableRef);
  });

  it('returns an empty array when the database has no rows', async () => {
    vi.mocked(database.select).mockResolvedValueOnce([]);

    const result = await useCase.execute();

    expect(database.select).toHaveBeenCalledTimes(1);
    expect(database.select).toHaveBeenCalledWith(tableRef);
    expect(result).toEqual([]);
  });

  it('returns all rows when the database has multiple entries', async () => {
    const rows: HealthCheck[] = [
      { id: 1, name: 'first', createdAt: new Date('2026-01-01T00:00:00Z') },
      { id: 2, name: 'second', createdAt: new Date('2026-01-02T00:00:00Z') },
      { id: 3, name: 'third', createdAt: new Date('2026-01-03T00:00:00Z') },
    ];
    vi.mocked(database.select).mockResolvedValueOnce(rows);

    const result = await useCase.execute();

    expect(result).toHaveLength(3);
    expect(result).toEqual(rows);
  });

  it('preserves the order returned by the database', async () => {
    const rows: HealthCheck[] = [
      { id: 10, name: 'c', createdAt: new Date('2026-02-03T00:00:00Z') },
      { id: 20, name: 'a', createdAt: new Date('2026-02-01T00:00:00Z') },
      { id: 30, name: 'b', createdAt: new Date('2026-02-02T00:00:00Z') },
    ];
    vi.mocked(database.select).mockResolvedValueOnce(rows);

    const result = await useCase.execute();

    expect(result.map((r) => r.name)).toEqual(['c', 'a', 'b']);
    expect(result.map((r) => r.id)).toEqual([10, 20, 30]);
  });
});
