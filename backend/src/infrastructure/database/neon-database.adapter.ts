import { neon } from '@neondatabase/serverless';
import { drizzle, type NeonHttpDatabase } from 'drizzle-orm/neon-http';
import type { PgTable } from 'drizzle-orm/pg-core';
import type { InferInsertModel } from 'drizzle-orm/table';
import type { DatabasePort, TableRef } from '../../domain/ports/database.port';

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

  async select<TEntity>(table: TableRef<TEntity>): Promise<TEntity[]> {
    const pgTable = this.resolveTable(table);
    const rows = await this.db.select().from(pgTable);
    return rows as unknown as TEntity[];
  }

  private resolveTable<TEntity>(ref: TableRef<TEntity>): PgTable {
    return (ref as unknown as { __table: PgTable }).__table;
  }
}
