/**
 * RoleBadge molecule — Litografía del Sur.
 *
 * Inline role indicator (admin | user). Uses named signal colors (never the brand
 * cobalt). aria-label provides accessible name.
 */
import { Badge } from '@/atoms/Badge';

export interface RoleBadgeProps {
  role: 'admin' | 'user';
}

export function RoleBadge({ role }: RoleBadgeProps) {
  const variant = role === 'admin' ? 'positivo' : 'alerta';
  const label = role === 'admin' ? 'Admin' : 'User';
  return (
    <span
      // eslint-disable-next-line jsx-a11y/aria-role -- decorative wrapper; Badge carries the visible signal
      role="status"
      aria-label={`Current role: ${label}`}
      data-testid="role-badge-wrapper"
    >
      <Badge variant={variant}>
        <span data-testid="role-badge">{label}</span>
      </Badge>
    </span>
  );
}