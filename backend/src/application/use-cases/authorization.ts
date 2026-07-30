import type { UserRole } from '../../domain/ports/cognito.port';

export interface Actor {
  readonly userId: string;
  readonly role: UserRole;
}

export function assertCanActAs(actor: Actor, targetUserId: string): void {
  if (actor.role !== 'admin' && actor.userId !== targetUserId) {
    throw new Error('Forbidden: users can only act on their own resources');
  }
}

export function assertIsAdmin(actor: Actor): void {
  if (actor.role !== 'admin') {
    throw new Error('Forbidden: admin role required');
  }
}
