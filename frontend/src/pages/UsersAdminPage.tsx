/**
 * UsersAdminPage — Litografía del Sur.
 *
 * Editorial treatment:
 * - Kicker `DIRECTORIO · USUARIOS` above the page title.
 * - Email rendered as line-item in JetBrains Mono (signature element).
 * - Asterism caption above the form section.
 *
 * Admin-only; the router guard restricts mounting, but the page also renders
 * ForbiddenPage defensively if a non-admin somehow arrives here.
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
    <section className="flex flex-col gap-8">
      <header className="flex flex-col gap-2" data-testid="users-page-header">
        <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-ink-tinta-mute">
          DIRECTORIO · USUARIOS
        </span>
        <div className="flex items-baseline justify-between gap-4">
          <h1 className="font-display text-2xl font-bold text-ink-tinta">Users</h1>
          <span
            className="font-mono text-xs uppercase tracking-[0.2em] text-ink-tinta-mute"
            data-testid="row-count"
          >
            N.º {String(rows.length).padStart(3, '0')} · USUARIOS
          </span>
        </div>
      </header>
      <ul className="flex flex-col" data-testid="users-list">
        {rows.map((u, index) => (
          <li
            key={u.id}
            data-testid={`user-row-${u.id}`}
            className="grid grid-cols-12 items-baseline gap-3 border-b border-ink-hairline py-3"
          >
            <span className="col-span-1 font-mono text-xs text-ink-tinta-mute">
              N.º {String(index + 1).padStart(3, '0')}
            </span>
            <span className="col-span-5 font-mono text-md text-ink-tinta">{u.email}</span>
            <span className="col-span-4 font-body text-sm text-ink-tinta-soft">{u.name}</span>
            <span className="col-span-2 text-right font-mono text-xs uppercase tracking-[0.2em] text-ink-cobalto">
              {u.tier}
            </span>
          </li>
        ))}
      </ul>
      {rows.length === 0 ? (
        <section
          className="rounded-sm border border-dashed border-ink-paper-press bg-ink-paper-lift p-6"
          data-testid="empty-state"
        >
          <p className="font-display text-lg italic text-ink-tinta">Ningún usuario aún.</p>
          <p className="mt-1 font-body text-sm text-ink-tinta-soft">
            Invite the first user to populate the directory.
          </p>
        </section>
      ) : null}
      <section className="mt-2">
        <header className="mb-4 flex items-baseline justify-between">
          <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-ink-tinta-mute">
            * * *&nbsp;&nbsp;NUEVO USUARIO
          </span>
          <h2 className="font-display text-lg font-bold text-ink-tinta">Add a new user</h2>
        </header>
        <UserForm apiBaseUrl={apiBaseUrl} />
      </section>
    </section>
  );
}
