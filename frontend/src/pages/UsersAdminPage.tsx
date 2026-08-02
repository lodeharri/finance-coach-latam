/**
 * UsersAdminPage — Litografía del Sur.
 *
 * Editorial treatment:
 * - Kicker `DIRECTORIO · USUARIOS` above the page title.
 * - Email rendered as line-item in JetBrains Mono (signature element).
 *
 * Admin-only; the router guard restricts mounting, but the page also renders
 * ForbiddenPage defensively if a non-admin somehow arrives here.
 *
 * Lists users with the create form behind a "+ Nuevo usuario" button and a
 * per-row Eliminar button that opens a confirmation modal. The Eliminar
 * button on the current admin's own row is disabled (no self-delete — the
 * backend also rejects this with 403).
 */
import { useState } from 'react';
import { Button } from '@/atoms/Button';
import { Modal } from '@/molecules/Modal';
import { ConfirmDialog } from '@/molecules/ConfirmDialog';
import { UserForm } from '@/molecules/UserForm';
import { useDeleteUser, useUsers } from '@/hooks/useUsers';
import { sessionStore } from '@/stores/sessionStore';
import type { User } from '@/services/types';

export interface UsersAdminPageProps {
  apiBaseUrl: string;
}

export function UsersAdminPage({ apiBaseUrl }: UsersAdminPageProps) {
  const role = sessionStore.getState().role;
  const currentUserId = sessionStore.getState().userId;
  const users = useUsers({ apiBaseUrl });
  const remove = useDeleteUser({ apiBaseUrl });
  const rows = users.data ?? [];
  const [createOpen, setCreateOpen] = useState(false);
  const [deleting, setDeleting] = useState<User | null>(null);
  const [error, setError] = useState<string | undefined>();

  if (role !== 'admin') {
    return <ForbiddenPage />;
  }

  const closeCreate = () => {
    setCreateOpen(false);
    setError(undefined);
  };
  const closeDelete = () => {
    setDeleting(null);
  };

  return (
    <section className="flex flex-col gap-8">
      <header className="flex flex-col gap-2" data-testid="users-page-header">
        <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-ink-tinta-mute">
          DIRECTORIO · USUARIOS
        </span>
        <div className="flex items-baseline justify-between gap-4">
          <h1 className="font-display text-2xl font-bold text-ink-tinta">Usuarios</h1>
          <div className="flex items-center gap-4">
            <span
              className="font-mono text-xs uppercase tracking-[0.2em] text-ink-tinta-mute"
              data-testid="row-count"
            >
              N.º {String(rows.length).padStart(3, '0')} · USUARIOS
            </span>
            <Button
              variant="primary"
              size="md"
              onClick={() => setCreateOpen(true)}
              data-testid="users-new-button"
            >
              + Nuevo usuario
            </Button>
          </div>
        </div>
      </header>
      {error ? (
        <p role="alert" className="font-body text-sm text-ink-negativo" data-testid="users-error">
          {error}
        </p>
      ) : null}
      <ul className="flex flex-col" data-testid="users-list">
        {rows.map((u, index) => {
          const isSelf = u.id === currentUserId;
          return (
            <li
              key={u.id}
              data-testid={`user-row-${u.id}`}
              className="grid grid-cols-12 items-baseline gap-3 border-b border-ink-hairline py-3"
            >
              <span className="col-span-1 font-mono text-xs text-ink-tinta-mute">
                N.º {String(index + 1).padStart(3, '0')}
              </span>
              <span className="col-span-5 font-mono text-md text-ink-tinta">{u.email}</span>
              <span className="col-span-3 font-body text-sm text-ink-tinta-soft">{u.name}</span>
              <span className="col-span-1 text-right font-mono text-xs uppercase tracking-[0.2em] text-ink-cobalto">
                {u.tier}
              </span>
              <span className="col-span-2 flex justify-end">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setDeleting(u)}
                  disabled={isSelf}
                  title={isSelf ? 'No puedes eliminarte a ti mismo' : undefined}
                  data-testid={`user-delete-${u.id}`}
                >
                  Eliminar
                </Button>
              </span>
            </li>
          );
        })}
      </ul>
      {rows.length === 0 ? (
        <section
          className="rounded-sm border border-dashed border-ink-paper-press bg-ink-paper-lift p-6"
          data-testid="empty-state"
        >
          <p className="font-display text-lg italic text-ink-tinta">Ningún usuario aún.</p>
          <p className="mt-1 font-body text-sm text-ink-tinta-soft">
            Invita al primer usuario para empezar a poblar el directorio.
          </p>
        </section>
      ) : null}
      <Modal open={createOpen} onClose={closeCreate} title="Nuevo usuario">
        <UserForm
          apiBaseUrl={apiBaseUrl}
          onCreated={closeCreate}
        />
      </Modal>
      <ConfirmDialog
        open={deleting !== null}
        title="Eliminar usuario"
        message={
          deleting
            ? `¿Eliminar a ${deleting.name || deleting.email}? Esta acción no se puede deshacer.`
            : ''
        }
        confirmLabel="Eliminar"
        confirmVariant="destructive"
        isConfirming={remove.isPending}
        onConfirm={() => {
          if (!deleting) return;
          const target = deleting;
          remove.mutate(target.id, {
            onSuccess: () => closeDelete(),
            onError: (err) => {
              setError(err instanceof Error ? err.message : 'No se pudo eliminar el usuario.');
              closeDelete();
            },
          });
        }}
        onClose={closeDelete}
      />
    </section>
  );
}

// Local re-import keeps the file self-contained; ForbiddenPage lives in this
// folder and the bundler tree-shakes the duplicate if any.
import { ForbiddenPage } from './ForbiddenPage';
