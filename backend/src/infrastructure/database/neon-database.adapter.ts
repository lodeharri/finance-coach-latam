import { neon } from '@neondatabase/serverless';
import {
  and,
  asc,
  desc,
  eq,
  getTableColumns,
  isNull,
  sql as drizzleSql,
  type SQL,
} from 'drizzle-orm';
import { drizzle, type NeonHttpDatabase } from 'drizzle-orm/neon-http';
import type { AnyPgColumn, PgTable, PgUpdateSetSource } from 'drizzle-orm/pg-core';
import type { InferInsertModel } from 'drizzle-orm/table';
import type {
  DatabasePort,
  SelectOptions,
  TableRef,
} from '../../domain/ports/database.port';

export class NeonDatabaseAdapter implements DatabasePort {
  private readonly db: NeonHttpDatabase;

  constructor(databaseUrl: string) {
    const sql = neon(databaseUrl);
    this.db = drizzle(sql);
  }

  async insert<TEntity, TInput extends Record<string, unknown>>(
    table: TableRef<TEntity>,
    values: TInput,
  ): Promise<TEntity> {
    const pgTable = this.resolveTable(table);
    const [row] = await this.db
      .insert(pgTable)
      .values(values as InferInsertModel<PgTable>)
      .returning();
    if (!row) {
      throw new Error('NeonDatabaseAdapter.insert: insert returned no rows');
    }
    return row as unknown as TEntity;
  }

  async select<TEntity>(
    table: TableRef<TEntity>,
    options: SelectOptions<TEntity> = {},
  ): Promise<TEntity[]> {
    const pgTable = this.resolveTable(table);
    const conditions = this.buildConditions(pgTable, options.where);
    let query = this.db.select().from(pgTable).$dynamic();

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    if (options.orderBy) {
      const column = this.resolveColumn(pgTable, String(options.orderBy.field));
      query = query.orderBy(
        options.orderBy.direction === 'desc' ? desc(column) : asc(column),
      );
    }

    if (options.limit !== undefined) {
      query = query.limit(options.limit);
    }

    if (options.offset !== undefined) {
      query = query.offset(options.offset);
    }

    const rows = await query;
    return rows as unknown as TEntity[];
  }

  async update<TEntity, TInput extends Partial<TEntity>>(
    table: TableRef<TEntity>,
    where: Partial<TEntity>,
    values: TInput,
  ): Promise<TEntity> {
    const pgTable = this.resolveTable(table);
    const conditions = this.buildConditions(pgTable, where);

    if (conditions.length === 0) {
      throw new Error('NeonDatabaseAdapter.update: at least one filter is required');
    }

    const [row] = await this.db
      .update(pgTable)
      .set(values as PgUpdateSetSource<PgTable>)
      .where(and(...conditions))
      .returning();

    if (!row) {
      throw new Error('NeonDatabaseAdapter.update: update returned no rows');
    }

    return row as unknown as TEntity;
  }

  async delete<TEntity>(
    table: TableRef<TEntity>,
    where: Partial<TEntity>,
  ): Promise<void> {
    const pgTable = this.resolveTable(table);
    const conditions = this.buildConditions(pgTable, where);

    if (conditions.length === 0) {
      // Mirrors `update`: an empty `where` would generate `DELETE FROM x`
      // (no WHERE clause), which mass-deletes the table. Reject it at the
      // adapter boundary so call sites cannot accidentally trample data
      // (REQ-AC-007).
      throw new Error('NeonDatabaseAdapter.delete: at least one filter is required');
    }

    await this.db.delete(pgTable).where(and(...conditions));
  }

  private buildConditions<TEntity>(
    table: PgTable,
    where: Partial<TEntity> | undefined,
  ): SQL[] {
    if (!where) return [];

    return Object.entries(where as Record<string, unknown>)
      .filter((entry) => entry[1] !== undefined)
      .map(([field, value]) => {
        const column = this.resolveColumn(table, field);
        return value === null ? isNull(column) : eq(column, value);
      });
  }

  private resolveColumn(table: PgTable, field: string): AnyPgColumn {
    const columns = getTableColumns(table) as Record<string, AnyPgColumn>;
    const column = columns[field];
    if (!column) {
      throw new Error(`NeonDatabaseAdapter: unknown field "${field}"`);
    }
    return column;
  }

  async query<T = unknown>(
    sql: string,
    params: readonly unknown[] = [],
  ): Promise<T[]> {
    const resolved = substituteParameters(sql, params);
    try {
      const result = await this.db.execute(drizzleSql.raw(resolved));
      const rows = (result as unknown as { rows?: T[] }).rows ?? [];
      return rows as T[];
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`NeonDatabaseAdapter.query: ${message}`);
    }
  }

  private resolveTable<TEntity>(ref: TableRef<TEntity>): PgTable {
    return (ref as unknown as { __table: PgTable }).__table;
  }
}

function substituteParameters(sql: string, params: readonly unknown[]): string {
  if (params.length === 0) return sql;
  let resolved = sql;
  for (let index = 0; index < params.length; index += 1) {
    const placeholder = `$${index + 1}`;
    const literal = stringifyLiteral(params[index]);
    resolved = resolved.split(placeholder).join(literal);
  }
  return resolved;
}

function stringifyLiteral(value: unknown): string {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'NULL';
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return `'${text.replaceAll("'", "''")}'`;
}
