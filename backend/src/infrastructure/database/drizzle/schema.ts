import {
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uuid,
  varchar,
  vector,
} from 'drizzle-orm/pg-core';
import type { TableRef } from '../../../domain/ports/database.port';
import type { HealthCheck } from '../../../domain/entities/health-check.entity';
import type { User } from '../../../domain/entities/user.entity';
import type { Account } from '../../../domain/entities/account.entity';
import type { Category } from '../../../domain/entities/category.entity';
import type { Transaction } from '../../../domain/entities/transaction.entity';

export const healthCheckTable = pgTable('health_check', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const userTable = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull(),
  name: text('name').notNull(),
  tier: text('tier', { enum: ['BRONZE', 'SILVER', 'GOLD'] }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const accountTable = pgTable('accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => userTable.id),
  name: text('name').notNull(),
  type: text('type', { enum: ['BANK', 'CASH', 'CARD'] }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const categoryTable = pgTable('categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  color: text('color').notNull(),
  embedding: vector('embedding', { dimensions: 768 }),
});

export const transactionTable = pgTable('transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => userTable.id),
  accountId: uuid('account_id')
    .notNull()
    .references(() => accountTable.id),
  categoryId: uuid('category_id').references(() => categoryTable.id),
  merchant: text('merchant').notNull(),
  amount: integer('amount').notNull(),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  status: text('status', { enum: ['PENDING', 'CATEGORIZED', 'FAILED'] }).notNull(),
  notes: text('notes'),
  embedding: vector('embedding', { dimensions: 768 }),
});

export type HealthCheckRow = typeof healthCheckTable.$inferSelect;
export type HealthCheckInsert = typeof healthCheckTable.$inferInsert;
export type UserRow = typeof userTable.$inferSelect;
export type UserInsert = typeof userTable.$inferInsert;
export type AccountRow = typeof accountTable.$inferSelect;
export type AccountInsert = typeof accountTable.$inferInsert;
export type CategoryRow = typeof categoryTable.$inferSelect;
export type CategoryInsert = typeof categoryTable.$inferInsert;
export type TransactionRow = typeof transactionTable.$inferSelect;
export type TransactionInsert = typeof transactionTable.$inferInsert;

export const healthCheckTableRef = {
  __table: healthCheckTable,
} as unknown as TableRef<HealthCheck>;

export const userTableRef = {
  __table: userTable,
} as unknown as TableRef<User>;

export const accountTableRef = {
  __table: accountTable,
} as unknown as TableRef<Account>;

export const categoryTableRef = {
  __table: categoryTable,
} as unknown as TableRef<Category>;

export const transactionTableRef = {
  __table: transactionTable,
} as unknown as TableRef<Transaction>;
