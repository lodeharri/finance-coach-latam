/**
 * UsersAdminPage — Litografía del Sur.
 *
 * Signature element: email-as-line-item in JetBrains Mono. Admin-only; the
 * router guard restricts mounting, but the page also renders ForbiddenPage
 * defensively if a non-admin somehow arrives here.
 */
import { ForbiddenPage } from './ForbiddenPage';
import { UserForm } from '@/molecules/UserForm';
import { useUsers } from '@/hooks/useUsers';
import { sessionStore } from '@/stores/sessionStore';

export interface UsersAdminPageProps {
  apiBaseUrl: string;
}

export function UsersAdminPage({ apiBaseUrl }: UsersAdminPageProps) {
  const role = sessionStore.getState().role;
  const users = useUsers({ apiBaseUrl });
  const rows = users.data ?? [];

  if (role !== 'admin') {
    return <ForbiddenPage />;
  }

  return (
    <section className="flex flex-col gap-6">
      <header className="flex items-baseline justify-between">
        <h1 className="font-display text-2xl font-bold text-ink-tinta">Users</h1>
        <span className="font-mono text-xs uppercase tracking-[0.2em] text-ink-tinta-mute">
          {rows.length} {rows.length === 1 ? 'user' : 'users'}
        </span>
      </header>
      <ul className="flex flex-col" data-testid="users-list">
        {rows.map((u) => (
          <li
            key={u.id}
            data-testid={`user-row-${u.id}`}
            className="flex items-baseline gap-4 border-b border-ink-paper-press py-2"
          >
            <span className="font-mono text-md text-ink-tinta">{u.email}</span>
            <span className="font-body text-sm text-ink-tinta-soft">{u.name}</span>
            <span className="font-mono text-xs uppercase tracking-[0.2em] text-ink-tinta-mute">
              {u.tier}
            </span>
          </li>
        ))}
      </ul>
      {rows.length === 0 ? (
        <p className="font-body text-sm text-ink-tinta-soft" data-testid="empty-state">
          No users yet. Invite one to populate the directory.
        </p>
      ) : null}
      <section className="mt-6">
        <h2 className="font-display text-lg font-bold text-ink-tinta">Add a new user</h2>
        <UserForm apiBaseUrl={apiBaseUrl} />
      </section>
    </section>
  );
}