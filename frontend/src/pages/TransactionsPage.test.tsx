/**
 * TransactionsPage page tests (REQ-FF-ADMIN-CRUD-MODAL).
 *
 * Pins the modal flow contract: the create form lives behind a button at the
 * top of the page (NOT at the bottom of the page like before), opens a Modal
 * containing TransactionForm, and the form unmounts on success so its state
 * resets for the next entry. The legacy "bottom of page" form section is
 * removed.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor, userEvent } from '@/test/test-utils';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router-dom';
import { server } from '@/test/setup';
import { TransactionsPage } from './TransactionsPage';
import { sessionStore } from '@/stores/sessionStore';

const BASE = 'https://api.example.test';

function wrap(node: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/transactions']}>{node}</MemoryRouter>
    </QueryClientProvider>,
  );
}

function accountsHandler(accounts: Array<{ id: string; name: string }>) {
  return http.get(`${BASE}/accounts`, () =>
    HttpResponse.json(
      accounts.map((a) => ({
        id: a.id,
        userId: 'u1',
        name: a.name,
        type: 'BANK',
        createdAt: new Date().toISOString(),
      })),
    ),
  );
}

function withinDialog(dialog: HTMLElement) {
  return {
    getByLabelText: (text: RegExp) => {
      const all = screen.getAllByLabelText(text);
      const inDialog = all.find((el) => dialog.contains(el));
      if (!inDialog) throw new Error(`No labelled element "${text}" inside the dialog`);
      return inDialog;
    },
    getByRole: (role: 'button' | 'textbox' | 'select', options?: { name?: RegExp }) => {
      const all = screen.getAllByRole(role, options);
      const inDialog = all.find((el) => dialog.contains(el));
      if (!inDialog) throw new Error(`No ${role} inside the dialog`);
      return inDialog;
    },
  };
}

describe('TransactionsPage — modal create flow', () => {
  beforeEach(() => {
    sessionStore.getState().setSession({
      idToken: 'jwt',
      refreshToken: 'r',
      expiresAt: Date.now() + 600_000,
      userId: 'u1',
      email: 'a@b.com',
      role: 'user',
    });
    server.resetHandlers();
    server.use(
      accountsHandler([{ id: 'acc-1', name: 'Checking' }]),
      http.get(`${BASE}/transactions`, () => HttpResponse.json([])),
      http.get(`${BASE}/categories`, () => HttpResponse.json([])),
    );
  });

  afterEach(() => {
    sessionStore.getState().clear();
    localStorage.clear();
  });

  it('renders a "+ Nueva transacción" button in the page header', () => {
    wrap(<TransactionsPage apiBaseUrl={BASE} />);
    expect(
      screen.getByRole('button', { name: /\+ nueva transacción/i }),
    ).toBeInTheDocument();
  });

  it('does NOT render the form until the button is clicked', () => {
    wrap(<TransactionsPage apiBaseUrl={BASE} />);
    // The "Registrar transacción" submit button is the smoking gun for the
    // form being mounted. It must not exist before the user opts in.
    expect(
      screen.queryByRole('button', { name: /registrar transacción/i }),
    ).not.toBeInTheDocument();
  });

  it('clicking the button opens a modal with the TransactionForm inside', async () => {
    const user = userEvent.setup();
    wrap(<TransactionsPage apiBaseUrl={BASE} />);

    await user.click(screen.getByRole('button', { name: /\+ nueva transacción/i }));

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(withinDialog(dialog).getByLabelText(/comercio/i)).toBeInTheDocument();
  });

  it('submitting a valid transaction closes the modal (form unmounts → state resets)', async () => {
    let posts = 0;
    server.use(
      http.post(`${BASE}/transactions`, async () => {
        posts += 1;
        return HttpResponse.json(
          {
            id: 't-new',
            userId: 'u1',
            accountId: 'acc-1',
            merchant: 'PedidosYa',
            amountCents: 420000,
            occurredAt: '2026-07-15T00:00:00.000Z',
            createdAt: new Date().toISOString(),
            status: 'PENDING',
            notes: null,
            categoryId: null,
          },
          { status: 201 },
        );
      }),
    );

    const user = userEvent.setup();
    wrap(<TransactionsPage apiBaseUrl={BASE} />);

    await user.click(screen.getByRole('button', { name: /\+ nueva transacción/i }));

    const dialog = await screen.findByRole('dialog');
    await user.type(withinDialog(dialog).getByLabelText(/monto/i), '420000');
    await user.type(withinDialog(dialog).getByLabelText(/comercio/i), 'PedidosYa');
    await user.clear(withinDialog(dialog).getByLabelText(/fecha/i));
    await user.type(withinDialog(dialog).getByLabelText(/fecha/i), '2026-07-15');
    await waitFor(() => {
      const opts = Array.from(
        (withinDialog(dialog).getByLabelText(/cuenta/i) as HTMLSelectElement).options,
      ).filter((o) => o.value !== '');
      expect(opts).toHaveLength(1);
    });
    await user.selectOptions(withinDialog(dialog).getByLabelText(/cuenta/i), 'acc-1');
    await user.click(withinDialog(dialog).getByRole('button', { name: /registrar transacción/i }));

    await waitFor(() => expect(posts).toBe(1));
    // Modal closes after success.
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('re-opening the modal after a successful create shows an empty form', async () => {
    server.use(
      http.post(`${BASE}/transactions`, () =>
        HttpResponse.json(
          {
            id: 't-new',
            userId: 'u1',
            accountId: 'acc-1',
            merchant: 'PedidosYa',
            amountCents: 100,
            occurredAt: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            status: 'PENDING',
            notes: null,
            categoryId: null,
          },
          { status: 201 },
        ),
      ),
    );

    const user = userEvent.setup();
    wrap(<TransactionsPage apiBaseUrl={BASE} />);

    // First create.
    await user.click(screen.getByRole('button', { name: /\+ nueva transacción/i }));
    let dialog = await screen.findByRole('dialog');
    await user.type(withinDialog(dialog).getByLabelText(/monto/i), '100');
    await user.type(withinDialog(dialog).getByLabelText(/comercio/i), 'Mercado');
    await waitFor(() => {
      const opts = Array.from(
        (withinDialog(dialog).getByLabelText(/cuenta/i) as HTMLSelectElement).options,
      ).filter((o) => o.value !== '');
      expect(opts).toHaveLength(1);
    });
    await user.selectOptions(withinDialog(dialog).getByLabelText(/cuenta/i), 'acc-1');
    await user.click(withinDialog(dialog).getByRole('button', { name: /registrar transacción/i }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    // Re-open and assert the form is empty.
    await user.click(screen.getByRole('button', { name: /\+ nueva transacción/i }));
    dialog = await screen.findByRole('dialog');
    expect(
      (withinDialog(dialog).getByLabelText(/monto/i) as HTMLInputElement).value,
    ).toBe('');
    expect((withinDialog(dialog).getByLabelText(/comercio/i) as HTMLInputElement).value).toBe('');
    expect((withinDialog(dialog).getByLabelText(/notas/i) as HTMLInputElement).value).toBe('');
  });

  it('the legacy "NUEVO MOVIMIENTO" bottom-of-page form section is removed', () => {
    wrap(<TransactionsPage apiBaseUrl={BASE} />);
    // The old bottom-of-page section started with an asterism caption
    // "* * *  NUEVO MOVIMIENTO" before the form.
    expect(screen.queryByText(/\* \* \*.*NUEVO MOVIMIENTO/i)).not.toBeInTheDocument();
  });
});
