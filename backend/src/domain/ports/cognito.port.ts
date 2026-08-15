export const USER_ROLES = ['admin', 'user'] as const;

export type UserRole = (typeof USER_ROLES)[number];

export interface CreateIdentityInput {
  readonly email: string;
  readonly name: string;
  readonly role: UserRole;
  readonly tempPassword: string;
}

export interface IdentityUser {
  readonly userId: string;
  readonly email: string;
  readonly groups: string[];
}

export interface AuthPort {
  createUser(input: CreateIdentityInput): Promise<{ userId: string }>;
  addUserToGroup(userId: string, groupName: string): Promise<void>;
  getUserByEmail(email: string): Promise<IdentityUser | null>;
  deleteUser(userId: string): Promise<void>;
}
