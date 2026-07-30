import type { PgTable } from 'drizzle-orm/pg-core';

/**
 * Brand marker for a table reference. The adapter maps these to concrete
 * Drizzle tables. Use cases receive a strongly-typed reference via constructor
 * injection from the composition root — they never import from infrastructure.
 */
export type TableRef<TEntity> = { readonly __entity: TEntity } & {
  readonly __table: PgTable;
};

/**
 * Generic database port.
 *
 * Type-only Drizzle imports: the domain layer has no runtime dependency on
 * drizzle-orm. `import type` is erased at compile time, so the domain
 * remains pure TypeScript at runtime.
 *
 * The adapter translates between Drizzle rows and domain entities. Use cases
 * depend on this interface, never on Drizzle directly.
 */
export interface SelectOptions<TEntity> {
  readonly where?: Partial<TEntity>;
  readonly orderBy?: {
    readonly field: keyof TEntity;
    readonly direction: 'asc' | 'desc';
  };
  readonly limit?: number;
}

export interface DatabasePort {
  insert<TEntity, TInput extends Record<string, unknown>>(
    table: TableRef<TEntity>,
    values: TInput,
  ): Promise<TEntity>;

  select<TEntity>(
    table: TableRef<TEntity>,
    options?: SelectOptions<TEntity>,
  ): Promise<TEntity[]>;

  update<TEntity, TInput extends Partial<TEntity>>(
    table: TableRef<TEntity>,
    where: Partial<TEntity>,
    values: TInput,
  ): Promise<TEntity>;

  /**
   * Raw parameterized SQL escape hatch. Adapters that support it must implement
   * this method; use cases that need capabilities outside the generic
   * insert/select/update (e.g. pgvector similarity search) reach for this.
   *
   * Use a parameter array with `$1`, `$2`, ... placeholders so the adapter
   * can safely forward them to the driver without string interpolation.
   */
  query?<T = unknown>(sql: string, params: readonly unknown[]): Promise<T[]>;
}
