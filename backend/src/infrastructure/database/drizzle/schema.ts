import { pgTable, serial, varchar, timestamp } from 'drizzle-orm/pg-core';
import type { TableRef } from '../../../domain/ports/database.port';
import type { HealthCheck } from '../../../domain/entities/health-check.entity';

export const healthCheckTable = pgTable('health_check', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export type HealthCheckRow = typeof healthCheckTable.$inferSelect;
export type HealthCheckInsert = typeof healthCheckTable.$inferInsert;

export const healthCheckTableRef = {
  __table: healthCheckTable,
} as unknown as TableRef<HealthCheck>;
