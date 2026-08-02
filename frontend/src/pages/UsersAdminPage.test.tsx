/**
 * UsersAdminPage page tests (REQ-FF-USERS-DELETE-ADMIN).
 *
 * Pins the admin-only delete user flow:
 *  - Each user row has an Eliminar button.
 *  - Clicking Eliminar opens a confirmation modal naming the user.
 *  - Self-delete is disabled with a tooltip explaining why.
 *  - Confirming the modal DELETEs /users/{id} and the row disappears.
 *  - Cancelling leaves the row in place.
 *  - Non-admin actors never see the Eliminar button (ForbiddenPage).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor, userEvent, act } from '@/test/test-utils';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router-dom';
import { server } from '@/test/setup';
import { UsersAdminPage } from './UsersAdminPage';
import { sessionStore } from '@/stores/sessionStore';

const BASE = 'https://api.example.test';

function wrap(node: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/admin/users']}>{node}</MemoryRouter>
    </QueryClientProvider>,
  );
}

const USERS = [
  {
    id: 'admin-1',
    email: 'admin@example.com',
    name: 'Admin',
    tier: 'GOLD',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'user-2',
    email: 'jane@example.com',
    name: 'Jane Doe',
    tier: 'BRONZE',
    createdAt: '2026-02-01T00:00:00.000Z',
  },
];

function seed() {
  server.resetHandlers();
  server.use(
    http.get(`${BASE}/users`, () => HttpResponse.json(USERS)),
    http.get(`${BASE}/accounts`, () => HttpResponse.json([])),
  );
}

describe('UsersAdminPage — delete user with confirmation modal', () => {
  beforeEach(() => {
    sessionStore.getState().setSession({
      idToken: 'jwt',
      refreshToken: 'r',
      expiresAt: Date.now() + 600_000,
      userId: 'admin-1',
      email: 'admin@example.com',
      role: 'admin',
    });
    seed();
  });

  afterEach(() => {
    sessionStore.getState().clear();
    localStorage.clear();
  });

  it('renders the users in a list', async () => {
    wrap(<UsersAdminPage apiBaseUrl={BASE} />);
    expect(await screen.findByText('jane@example.com')).toBeInTheDocument();
    expect(screen.getByText('admin@example.com')).toBeInTheDocument();
  });

  it('renders an Eliminar button per row', async () => {
    wrap(<UsersAdminPage apiBaseUrl={BASE} />);
    await screen.findByText('jane@example.com');
    expect(screen.getAllByRole('button', { name: /eliminar/i })).toHaveLength(2);
  });

  it('disables the Eliminar button on the current admin user (no self-delete)', async () => {
    wrap(<UsersAdminPage apiBaseUrl={BASE} />);
    await screen.findByText('jane@example.com');
    // The current actor is admin-1; the Eliminar button on that row must
    // be disabled and explain why.
    const selfButton = screen.getByTestId('user-delete-admin-1') as HTMLButtonElement;
    expect(selfButton).toBeDisabled();
    expect(selfButton.title).toMatch(/no puedes eliminarte a ti mismo/i);
  });

  it('clicking Eliminar opens a confirmation modal naming the user', async () => {
    const user = userEvent.setup();
    wrap(<UsersAdminPage apiBaseUrl={BASE} />);
    await screen.findByText('jane@example.com');

    await user.click(screen.getByTestId('user-delete-user-2'));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(dialog.textContent).toMatch(/Jane/);
    expect(dialog.textContent).toMatch(/no se puede deshacer/i);
  });

  it('cancelling leaves the row in place', async () => {
    const user = userEvent.setup();
    wrap(<UsersAdminPage apiBaseUrl={BASE} />);
    await screen.findByText('jane@example.com');

    await user.click(screen.getByTestId('user-delete-user-2'));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /cancelar/i }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByText('jane@example.com')).toBeInTheDocument();
  });

  it('confirming the delete DELETEs the row (optimistic + invalidation)', async () => {
    let deletedId: string | null = null;
    let deleted = false;
    server.use(
      http.get(`${BASE}/users`, () =>
        HttpResponse.json(deleted ? [USERS[0]!] : USERS),
      ),
      http.delete(`${BASE}/users/user-2`, () => {
        deletedId = 'user-2';
        deleted = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const user = userEvent.setup();
    wrap(<UsersAdminPage apiBaseUrl={BASE} />);
    await screen.findByText('jane@example.com');

    await user.click(screen.getByTestId('user-delete-user-2'));
    const dialog = await screen.findByRole('dialog');
    await act(async () => {
      await user.click(within(dialog).getByRole('button', { name: /^eliminar$/i }));
    });

    await waitFor(() => expect(deletedId).toBe('user-2'));
    await waitFor(() => expect(screen.queryByText('jane@example.com')).not.toBeInTheDocument());
  });

  it('non-admin actors see ForbiddenPage (router guard) and no Eliminar buttons', async () => {
    sessionStore.getState().setSession({
      idToken: 'jwt',
      refreshToken: 'r',
      expiresAt: Date.now() + 600_000,
      userId: 'user-2',
      email: 'jane@example.com',
      role: 'user',
    });
    wrap(<UsersAdminPage apiBaseUrl={BASE} />);
    // ForbiddenPage renders an h1 with the 403/denegado text.
    await waitFor(() =>
      expect(
        screen.getByRole('heading', { level: 1, name: /403|denegado/i }),
      ).toBeInTheDocument(),
    );
    expect(screen.queryByRole('button', { name: /eliminar/i })).not.toBeInTheDocument();
  });
});

function within(dialog: HTMLElement) {
  return {
    getByRole: (role: 'button' | 'textbox' | 'select', options?: { name?: RegExp }) => {
      const all = screen.getAllByRole(role, options);
      const inDialog = all.find((el) => dialog.contains(el));
      if (!inDialog) throw new Error(`No ${role} inside the dialog`);
      return inDialog;
    },
  };
}
