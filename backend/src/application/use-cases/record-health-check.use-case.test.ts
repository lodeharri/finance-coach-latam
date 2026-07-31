import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RecordHealthCheckUseCase } from './record-health-check.use-case';
import type { DatabasePort, TableRef } from '../../domain/ports/database.port';
import type {
  HealthCheck,
  HealthCheckInput,
} from '../../domain/entities/health-check.entity';
import { healthCheckTableRef } from '../../infrastructure/database/drizzle/schema';

describe('RecordHealthCheckUseCase', () => {
  let database: DatabasePort;
  let useCase: RecordHealthCheckUseCase;
  let tableRef: TableRef<HealthCheck>;

  beforeEach(() => {
    database = {
      insert: vi.fn(),
      select: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };
    tableRef = healthCheckTableRef;
    useCase = new RecordHealthCheckUseCase(database, tableRef);
  });

  it('inserts a valid name and returns the entity from the database', async () => {
    const inserted: HealthCheck = {
      id: 1,
      name: 'smoke-test',
      createdAt: new Date('2026-01-01T00:00:00Z'),
    };
    vi.mocked(database.insert).mockResolvedValueOnce(inserted);

    const input: HealthCheckInput = { name: 'smoke-test' };
    const result = await useCase.execute(input);

    expect(database.insert).toHaveBeenCalledTimes(1);
    expect(database.insert).toHaveBeenCalledWith(tableRef, { name: 'smoke-test' });
    expect(result).toBe(inserted);
  });

  it('trims leading and trailing whitespace before inserting', async () => {
    const inserted: HealthCheck = {
      id: 2,
      name: 'trimmed',
      createdAt: new Date('2026-01-02T00:00:00Z'),
    };
    vi.mocked(database.insert).mockResolvedValueOnce(inserted);

    const result = await useCase.execute({ name: '  trimmed  ' });

    expect(database.insert).toHaveBeenCalledWith(tableRef, { name: 'trimmed' });
    expect(result.name).toBe('trimmed');
  });

  it('throws when name is an empty string', async () => {
    await expect(useCase.execute({ name: '' })).rejects.toThrow(
      'name must be a non-empty string',
    );
    expect(database.insert).not.toHaveBeenCalled();
  });

  it('throws when name is whitespace-only', async () => {
    await expect(useCase.execute({ name: '   ' })).rejects.toThrow(
      'name must be a non-empty string',
    );
    expect(database.insert).not.toHaveBeenCalled();
  });

  it('throws when name is undefined', async () => {
    await expect(
      useCase.execute({ name: undefined as unknown as string }),
    ).rejects.toThrow('name must be a non-empty string');
    expect(database.insert).not.toHaveBeenCalled();
  });
});
