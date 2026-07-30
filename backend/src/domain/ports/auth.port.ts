import type { UserRole } from './cognito.port';

export interface VerifiedToken {
  readonly userId: string;
  readonly email: string;
  readonly role: UserRole;
}