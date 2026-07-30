export const ACCOUNT_TYPES = ['BANK', 'CASH', 'CARD'] as const;

export type AccountType = (typeof ACCOUNT_TYPES)[number];

export interface Account {
  readonly id: string;
  readonly userId: string;
  readonly name: string;
  readonly type: AccountType;
  readonly createdAt: Date;
}
