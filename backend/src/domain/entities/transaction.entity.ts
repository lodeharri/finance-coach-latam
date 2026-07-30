export const TRANSACTION_STATUSES = ['PENDING', 'CATEGORIZED', 'FAILED'] as const;

export type TransactionStatus = (typeof TRANSACTION_STATUSES)[number];

export interface Transaction {
  readonly id: string;
  readonly userId: string;
  readonly accountId: string;
  readonly categoryId: string | null;
  readonly merchant: string;
  readonly amount: number;
  readonly occurredAt: Date;
  readonly createdAt: Date;
  readonly status: TransactionStatus;
  readonly notes: string | null;
}
