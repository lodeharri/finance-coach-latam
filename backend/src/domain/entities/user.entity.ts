export const USER_TIERS = ['BRONZE', 'SILVER', 'GOLD'] as const;

export type UserTier = (typeof USER_TIERS)[number];

export interface User {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  readonly tier: UserTier;
  readonly createdAt: Date;
}
