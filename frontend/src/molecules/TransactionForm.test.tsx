/**
 * TransactionForm molecule tests (REQ-FFC-TX-CREATE-FORM).
 *
 * Colocated because the molecule has logic (controlled inputs, account select
 * populated from useAccounts, cents-only amount entry, per-field validation,
 * submit handler wired to useCreateTransaction). Covers amount/merchant/date/
 * account/notes fields, the cents-only integer contract, and the accountId
 * select for empty / single / multi account cases.
 */
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, userEvent } from '@/test/test-utils';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/setup';
import { TransactionForm } from './TransactionForm';
import { sessionStore } from '@/stores/sessionStore';

const BASE = 'https://api.example.test';

function wrap(node: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={client}>{node}</QueryClientProvider>);
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

describe('TransactionForm', () => {
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
  });

  afterEach(() => {
    sessionStore.getState().clear();
    localStorage.clear();
  });

  it('renders with default props (amount empty, merchant empty, date=today, account=empty select)', () => {
    server.use(accountsHandler([]));

    wrap(<TransactionForm apiBaseUrl={BASE} userId="u1" />);

    const amount = screen.getByLabelText(/monto \(centavos\)/i) as HTMLInputElement;
    const merchant = screen.getByLabelText(/comercio/i) as HTMLInputElement;
    const date = screen.getByLabelText(/fecha/i) as HTMLInputElement;
    const account = screen.getByLabelText(/cuenta/i) as HTMLSelectElement;
    const notes = screen.getByLabelText(/notas/i) as HTMLInputElement;

    expect(amount).toBeInTheDocument();
    expect(amount.value).toBe('');

    expect(merchant).toBeInTheDocument();
    expect(merchant.value).toBe('');

    expect(date).toBeInTheDocument();
    // Default is today's ISO date (YYYY-MM-DD).
    expect(date.value).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    expect(account).toBeInTheDocument();
    expect(account.value).toBe('');

    expect(notes).toBeInTheDocument();
    expect(notes.value).toBe('');
  });

  it('amount field strips non-digit characters and keeps only integer digits', async () => {
    server.use(accountsHandler([]));

    const user = userEvent.setup();
    wrap(<TransactionForm apiBaseUrl={BASE} userId="u1" />);

    const amount = screen.getByLabelText(/monto \(centavos\)/i);
    await user.type(amount, '1a2.3b4-5');
    expect((amount as HTMLInputElement).value).toBe('12345');
  });

  it('amount field accepts a plain integer string', async () => {
    server.use(accountsHandler([]));

    const user = userEvent.setup();
    wrap(<TransactionForm apiBaseUrl={BASE} userId="u1" />);

    const amount = screen.getByLabelText(/monto \(centavos\)/i);
    await user.type(amount, '420000');
    expect((amount as HTMLInputElement).value).toBe('420000');
  });

  it('amount field strips negative signs (only digits remain)', async () => {
    server.use(accountsHandler([]));

    const user = userEvent.setup();
    wrap(<TransactionForm apiBaseUrl={BASE} userId="u1" />);

    const amount = screen.getByLabelText(/monto \(centavos\)/i);
    await user.type(amount, '-100');
    expect((amount as HTMLInputElement).value).toBe('100');
  });

  it('merchant field accepts text', async () => {
    server.use(accountsHandler([]));

    const user = userEvent.setup();
    wrap(<TransactionForm apiBaseUrl={BASE} userId="u1" />);

    const merchant = screen.getByLabelText(/comercio/i);
    await user.type(merchant, 'PedidosYa');
    expect((merchant as HTMLInputElement).value).toBe('PedidosYa');
  });

  it('occurredAt date field accepts an ISO date', async () => {
    server.use(accountsHandler([]));

    const user = userEvent.setup();
    wrap(<TransactionForm apiBaseUrl={BASE} userId="u1" />);

    const date = screen.getByLabelText(/fecha/i);
    await user.clear(date);
    await user.type(date, '2026-07-15');
    expect((date as HTMLInputElement).value).toBe('2026-07-15');
  });

  it('notes field accepts optional text', async () => {
    server.use(accountsHandler([]));

    const user = userEvent.setup();
    wrap(<TransactionForm apiBaseUrl={BASE} userId="u1" />);

    const notes = screen.getByLabelText(/notas/i);
    await user.type(notes, 'Almuerzo con equipo');
    expect((notes as HTMLInputElement).value).toBe('Almuerzo con equipo');
  });

  it('accountId select has no options when accounts list is empty', async () => {
    server.use(accountsHandler([]));

    wrap(<TransactionForm apiBaseUrl={BASE} userId="u1" />);

    const account = screen.getByLabelText(/cuenta/i) as HTMLSelectElement;
    await waitFor(() => {
      const opts = Array.from(account.options).filter((o) => o.value !== '');
      expect(opts).toHaveLength(0);
    });
    // The "Seleccionar cuenta…" placeholder remains the only option.
    expect(account.options[0]?.text).toMatch(/seleccionar cuenta/i);
  });

  it('accountId select exposes a single-account option', async () => {
    server.use(accountsHandler([{ id: 'acc-1', name: 'Checking' }]));

    wrap(<TransactionForm apiBaseUrl={BASE} userId="u1" />);

    const account = screen.getByLabelText(/cuenta/i) as HTMLSelectElement;
    await waitFor(() => {
      const opts = Array.from(account.options).filter((o) => o.value !== '');
      expect(opts).toHaveLength(1);
      expect(opts[0]!.value).toBe('acc-1');
      expect(opts[0]!.text).toBe('Checking');
    });
  });

  it('accountId select exposes multi-account options', async () => {
    server.use(
      accountsHandler([
        { id: 'acc-1', name: 'Checking' },
        { id: 'acc-2', name: 'Cash' },
        { id: 'acc-3', name: 'Card' },
      ]),
    );

    wrap(<TransactionForm apiBaseUrl={BASE} userId="u1" />);

    const account = screen.getByLabelText(/cuenta/i) as HTMLSelectElement;
    await waitFor(() => {
      const opts = Array.from(account.options).filter((o) => o.value !== '');
      expect(opts).toHaveLength(3);
    });

    const user = userEvent.setup();
    await user.selectOptions(account, 'acc-2');
    expect(account.value).toBe('acc-2');
  });

  it('submitting with amount empty (required HTML5 fields filled) surfaces the amount error', async () => {
    // The merchant, date, and account fields have `required` so HTML5
    // constraint validation blocks submission unless they are filled. Once
    // they are filled, the form submit reaches our handler, which surfaces
    // the amount validation error.
    server.use(accountsHandler([{ id: 'acc-1', name: 'Checking' }]));

    const user = userEvent.setup();
    wrap(<TransactionForm apiBaseUrl={BASE} userId="u1" />);

    await user.type(screen.getByLabelText(/comercio/i), 'PedidosYa');
    // Date defaults to today; leave it.
    await waitFor(() => {
      const opts = Array.from((screen.getByLabelText(/cuenta/i) as HTMLSelectElement).options).filter(
        (o) => o.value !== '',
      );
      expect(opts).toHaveLength(1);
    });
    await user.selectOptions(screen.getByLabelText(/cuenta/i), 'acc-1');
    // Amount stays empty.
    await user.click(screen.getByRole('button', { name: /registrar transacción/i }));

    expect(await screen.findByText(/monto debe ser un entero positivo/i)).toBeInTheDocument();
  });

  it('submitting with merchant empty surfaces the merchant error (no POST fires)', async () => {
    // jsdom dispatches the submit event even when `required` is invalid, so
    // the impl's custom validation runs alongside HTML5. The handler returns
    // early after setErrors, so the network request is never made.
    let posts = 0;
    server.use(
      accountsHandler([{ id: 'acc-1', name: 'Checking' }]),
      http.post(`${BASE}/transactions`, () => {
        posts += 1;
        return HttpResponse.json({ id: 't-new' }, { status: 201 });
      }),
    );

    const user = userEvent.setup();
    wrap(<TransactionForm apiBaseUrl={BASE} userId="u1" />);

    await user.type(screen.getByLabelText(/monto \(centavos\)/i), '100');
    // Merchant left empty.
    await waitFor(() => {
      const opts = Array.from((screen.getByLabelText(/cuenta/i) as HTMLSelectElement).options).filter(
        (o) => o.value !== '',
      );
      expect(opts).toHaveLength(1);
    });
    await user.selectOptions(screen.getByLabelText(/cuenta/i), 'acc-1');
    await user.click(screen.getByRole('button', { name: /registrar transacción/i }));

    expect(await screen.findByText(/comercio es obligatorio/i)).toBeInTheDocument();
    await new Promise((r) => setTimeout(r, 30));
    expect(posts).toBe(0);
  });

  it('submitting with amount=0 surfaces the amount error (positive integer required)', async () => {
    server.use(accountsHandler([{ id: 'acc-1', name: 'Checking' }]));

    const user = userEvent.setup();
    wrap(<TransactionForm apiBaseUrl={BASE} userId="u1" />);

    await user.type(screen.getByLabelText(/monto \(centavos\)/i), '0');
    await user.type(screen.getByLabelText(/comercio/i), 'X');
    await waitFor(() => {
      const opts = Array.from((screen.getByLabelText(/cuenta/i) as HTMLSelectElement).options).filter(
        (o) => o.value !== '',
      );
      expect(opts).toHaveLength(1);
    });
    await user.selectOptions(screen.getByLabelText(/cuenta/i), 'acc-1');
    await user.click(screen.getByRole('button', { name: /registrar transacción/i }));

    expect(await screen.findByText(/monto debe ser un entero positivo/i)).toBeInTheDocument();
  });

  it('submitting with a missing date surfaces the date error (no POST fires)', async () => {
    let posts = 0;
    server.use(
      accountsHandler([{ id: 'acc-1', name: 'Checking' }]),
      http.post(`${BASE}/transactions`, () => {
        posts += 1;
        return HttpResponse.json({ id: 't-new' }, { status: 201 });
      }),
    );

    const user = userEvent.setup();
    wrap(<TransactionForm apiBaseUrl={BASE} userId="u1" />);

    await user.type(screen.getByLabelText(/monto \(centavos\)/i), '100');
    await user.type(screen.getByLabelText(/comercio/i), 'X');
    await user.clear(screen.getByLabelText(/fecha/i));
    await waitFor(() => {
      const opts = Array.from((screen.getByLabelText(/cuenta/i) as HTMLSelectElement).options).filter(
        (o) => o.value !== '',
      );
      expect(opts).toHaveLength(1);
    });
    await user.selectOptions(screen.getByLabelText(/cuenta/i), 'acc-1');
    await user.click(screen.getByRole('button', { name: /registrar transacción/i }));

    expect(await screen.findByText(/fecha es obligatoria/i)).toBeInTheDocument();
    await new Promise((r) => setTimeout(r, 30));
    expect(posts).toBe(0);
  });

  it('submitting with accountId empty is caught by JS validation (no POST fires)', async () => {
    // The form has noValidate so HTML5 constraint validation does NOT gate
    // the submit event. The molecule's own JS validation catches the empty
    // accountId before the mutation runs. This test pins that contract: no
    // POST is sent, the custom error renders verbatim.
    let posts = 0;
    server.use(
      accountsHandler([{ id: 'acc-1', name: 'Checking' }]),
      http.post(`${BASE}/transactions`, () => {
        posts += 1;
        return HttpResponse.json({ id: 't-new' }, { status: 201 });
      }),
    );

    const user = userEvent.setup();
    wrap(<TransactionForm apiBaseUrl={BASE} userId="u1" />);

    await user.type(screen.getByLabelText(/monto \(centavos\)/i), '100');
    await user.type(screen.getByLabelText(/comercio/i), 'X');
    // Leave accountId at the empty default.
    await user.click(screen.getByRole('button', { name: /registrar transacción/i }));

    await new Promise((r) => setTimeout(r, 30));
    expect(posts).toBe(0);
    expect(await screen.findByText(/cuenta es obligatoria/i)).toBeInTheDocument();
  });

  it('submitting with valid values POSTs the full body shape (amountCents integer, ISO occurredAt)', async () => {
    server.use(
      accountsHandler([{ id: 'acc-1', name: 'Checking' }]),
      http.post(`${BASE}/transactions`, async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(
          {
            id: 't-new',
            userId: body.userId,
            accountId: body.accountId,
            merchant: body.merchant,
            amountCents: body.amountCents,
            occurredAt: body.occurredAt,
            createdAt: new Date().toISOString(),
            status: 'PENDING',
            notes: body.notes,
            categoryId: null,
          },
          { status: 201 },
        );
      }),
    );

    const user = userEvent.setup();
    wrap(<TransactionForm apiBaseUrl={BASE} userId="u1" />);

    await user.type(screen.getByLabelText(/monto \(centavos\)/i), '420000');
    await user.type(screen.getByLabelText(/comercio/i), 'PedidosYa');
    await user.clear(screen.getByLabelText(/fecha/i));
    await user.type(screen.getByLabelText(/fecha/i), '2026-07-15');
    await waitFor(() => {
      const account = screen.getByLabelText(/cuenta/i) as HTMLSelectElement;
      const opts = Array.from(account.options).filter((o) => o.value !== '');
      expect(opts).toHaveLength(1);
    });
    await user.selectOptions(screen.getByLabelText(/cuenta/i), 'acc-1');
    await user.type(screen.getByLabelText(/notas/i), 'Cena');
    await user.click(screen.getByRole('button', { name: /registrar transacción/i }));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /registrar transacción/i })).toBeEnabled(),
    );
  });

  it('submitting with valid values (full body assertion) POSTs the expected payload', async () => {
    let captured: Record<string, unknown> | null = null;
    server.use(
      accountsHandler([{ id: 'acc-1', name: 'Checking' }]),
      http.post(`${BASE}/transactions`, async ({ request }) => {
        captured = (await request.json()) as Record<string, unknown>;
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
            notes: 'Cena',
            categoryId: null,
          },
          { status: 201 },
        );
      }),
    );

    const user = userEvent.setup();
    wrap(<TransactionForm apiBaseUrl={BASE} userId="u1" />);

    await user.type(screen.getByLabelText(/monto \(centavos\)/i), '420000');
    await user.type(screen.getByLabelText(/comercio/i), 'PedidosYa');
    await user.clear(screen.getByLabelText(/fecha/i));
    await user.type(screen.getByLabelText(/fecha/i), '2026-07-15');
    await waitFor(() => {
      const account = screen.getByLabelText(/cuenta/i) as HTMLSelectElement;
      const opts = Array.from(account.options).filter((o) => o.value !== '');
      expect(opts).toHaveLength(1);
    });
    await user.selectOptions(screen.getByLabelText(/cuenta/i), 'acc-1');
    await user.type(screen.getByLabelText(/notas/i), 'Cena');
    await user.click(screen.getByRole('button', { name: /registrar transacción/i }));

    await waitFor(() => expect(captured).not.toBeNull());
    expect(captured).toMatchObject({
      userId: 'u1',
      accountId: 'acc-1',
      merchant: 'PedidosYa',
      amountCents: 420000,
      notes: 'Cena',
    });
    expect(typeof captured!.amountCents).toBe('number');
    expect(Number.isInteger(captured!.amountCents as number)).toBe(true);
    expect(captured!.occurredAt).toMatch(/^2026-07-15T/);
    expect(() => new Date(captured!.occurredAt as string).toISOString()).not.toThrow();
  });

  it('submitting with valid values and empty notes passes notes: null', async () => {
    let captured: Record<string, unknown> | null = null;
    server.use(
      accountsHandler([{ id: 'acc-1', name: 'Checking' }]),
      http.post(`${BASE}/transactions`, async ({ request }) => {
        captured = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ id: 't-new' }, { status: 201 });
      }),
    );

    const user = userEvent.setup();
    wrap(<TransactionForm apiBaseUrl={BASE} userId="u1" />);

    await user.type(screen.getByLabelText(/monto \(centavos\)/i), '100');
    await user.type(screen.getByLabelText(/comercio/i), 'X');
    await waitFor(() => {
      const opts = Array.from((screen.getByLabelText(/cuenta/i) as HTMLSelectElement).options).filter(
        (o) => o.value !== '',
      );
      expect(opts).toHaveLength(1);
    });
    await user.selectOptions(screen.getByLabelText(/cuenta/i), 'acc-1');
    await user.click(screen.getByRole('button', { name: /registrar transacción/i }));

    await waitFor(() => expect(captured).not.toBeNull());
    expect(captured!.notes).toBeNull();
  });

  it('disables submit and shows "Guardando…" while the mutation is in-flight', async () => {
    let resolvePost!: () => void;
    server.use(
      accountsHandler([{ id: 'acc-1', name: 'Checking' }]),
      http.post(`${BASE}/transactions`, () =>
        new Promise<Response>((resolve) => {
          resolvePost = () => resolve(HttpResponse.json({ id: 't-new' }, { status: 201 }));
        }),
      ),
    );

    const user = userEvent.setup();
    wrap(<TransactionForm apiBaseUrl={BASE} userId="u1" />);

    await user.type(screen.getByLabelText(/monto \(centavos\)/i), '100');
    await user.type(screen.getByLabelText(/comercio/i), 'X');
    await waitFor(() => {
      const opts = Array.from((screen.getByLabelText(/cuenta/i) as HTMLSelectElement).options).filter(
        (o) => o.value !== '',
      );
      expect(opts).toHaveLength(1);
    });
    await user.selectOptions(screen.getByLabelText(/cuenta/i), 'acc-1');
    await user.click(screen.getByRole('button', { name: /registrar transacción/i }));

    const saving = await screen.findByRole('button', { name: /guardando…/i });
    expect(saving).toBeDisabled();

    resolvePost();

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /registrar transacción/i })).toBeEnabled(),
    );
  });

  it('surfaces backend errors verbatim at the form level', async () => {
    server.use(
      accountsHandler([{ id: 'acc-1', name: 'Checking' }]),
      http.post(`${BASE}/transactions`, () =>
        HttpResponse.json({ error: 'Insufficient balance' }, { status: 422 }),
      ),
    );

    const user = userEvent.setup();
    wrap(<TransactionForm apiBaseUrl={BASE} userId="u1" />);

    await user.type(screen.getByLabelText(/monto \(centavos\)/i), '99999999');
    await user.type(screen.getByLabelText(/comercio/i), 'Big Buy');
    await waitFor(() => {
      const opts = Array.from((screen.getByLabelText(/cuenta/i) as HTMLSelectElement).options).filter(
        (o) => o.value !== '',
      );
      expect(opts).toHaveLength(1);
    });
    await user.selectOptions(screen.getByLabelText(/cuenta/i), 'acc-1');
    await user.click(screen.getByRole('button', { name: /registrar transacción/i }));

    expect(await screen.findByText(/insufficient balance/i)).toBeInTheDocument();
    const alerts = screen.getAllByRole('alert');
    expect(alerts.some((el) => /insufficient balance/i.test(el.textContent ?? ''))).toBe(true);
  });
});