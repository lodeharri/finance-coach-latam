/**
 * AccountForm molecule tests (REQ-FFC-ACC-CREATE-FORM).
 *
 * Colocated because the molecule has logic (controlled inputs, type glyph
 * strip, validation, submit handler wired to useCreateAccount). Verifies
 * the type-glyph strip signature (`BANK|CASH|CARD`), client-side validation,
 * mutation pending UI, and that backend errors surface verbatim.
 */
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, userEvent } from '@/test/test-utils';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/setup';
import { AccountForm } from './AccountForm';
import { sessionStore } from '@/stores/sessionStore';

const BASE = 'https://api.example.test';

function wrap(node: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={client}>{node}</QueryClientProvider>);
}

describe('AccountForm', () => {
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

  it('renders the form with default props (empty name, BANK type selected)', () => {
    wrap(<AccountForm apiBaseUrl={BASE} userId="u1" />);

    const nameInput = screen.getByLabelText(/account name/i) as HTMLInputElement;
    expect(nameInput).toBeInTheDocument();
    expect(nameInput.value).toBe('');

    const bank = screen.getByRole('radio', { name: 'BANK' });
    const cash = screen.getByRole('radio', { name: 'CASH' });
    const card = screen.getByRole('radio', { name: 'CARD' });
    expect(bank).toHaveAttribute('aria-checked', 'true');
    expect(cash).toHaveAttribute('aria-checked', 'false');
    expect(card).toHaveAttribute('aria-checked', 'false');
  });

  it('updates the name field on user typing', async () => {
    const user = userEvent.setup();
    wrap(<AccountForm apiBaseUrl={BASE} userId="u1" />);

    const nameInput = screen.getByLabelText(/account name/i) as HTMLInputElement;
    await user.type(nameInput, 'Checking');
    expect(nameInput.value).toBe('Checking');
  });

  it('renders a visible label for each account type (BANK, CASH, CARD)', () => {
    wrap(<AccountForm apiBaseUrl={BASE} userId="u1" />);

    // Visible label — not the sr-only a11y duplicate. data-testid makes the
    // assertion unambiguous so future refactors that keep the sr-only span
    // don't break the test.
    expect(screen.getByTestId('account-type-label-BANK')).toHaveTextContent('BANK');
    expect(screen.getByTestId('account-type-label-CASH')).toHaveTextContent('CASH');
    expect(screen.getByTestId('account-type-label-CARD')).toHaveTextContent('CARD');
  });

  it('selecting CASH updates the active type glyph', async () => {
    const user = userEvent.setup();
    wrap(<AccountForm apiBaseUrl={BASE} userId="u1" />);

    await user.click(screen.getByRole('radio', { name: 'CASH' }));
    expect(screen.getByRole('radio', { name: 'BANK' })).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('radio', { name: 'CASH' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'CARD' })).toHaveAttribute('aria-checked', 'false');
  });

  it('selecting CARD updates the active type glyph', async () => {
    const user = userEvent.setup();
    wrap(<AccountForm apiBaseUrl={BASE} userId="u1" />);

    await user.click(screen.getByRole('radio', { name: 'CARD' }));
    expect(screen.getByRole('radio', { name: 'CARD' })).toHaveAttribute('aria-checked', 'true');
  });

  it('submitting with an empty name surfaces the required validation error', async () => {
    const user = userEvent.setup();
    wrap(<AccountForm apiBaseUrl={BASE} userId="u1" />);

    await user.click(screen.getByRole('button', { name: /add account/i }));

    expect(await screen.findByText(/account name is required/i)).toBeInTheDocument();
    // The error is rendered as a role=alert via FormField so it is announced
    // to assistive tech. The name input itself receives the error styling.
    expect(screen.getByRole('alert')).toHaveTextContent(/account name is required/i);
  });

  it('submitting with whitespace-only name also triggers the required error', async () => {
    const user = userEvent.setup();
    wrap(<AccountForm apiBaseUrl={BASE} userId="u1" />);

    const nameInput = screen.getByLabelText(/account name/i);
    await user.type(nameInput, '   ');
    await user.click(screen.getByRole('button', { name: /add account/i }));

    expect(await screen.findByText(/account name is required/i)).toBeInTheDocument();
  });

  it('submitting with a name POSTs { userId, name, type } to /accounts', async () => {
    let captured: unknown = null;
    server.use(
      http.post(`${BASE}/accounts`, async ({ request }) => {
        captured = await request.json();
        return HttpResponse.json({ id: 'a-new', userId: 'u1', name: 'Savings', type: 'CASH' }, { status: 201 });
      }),
    );

    const user = userEvent.setup();
    wrap(<AccountForm apiBaseUrl={BASE} userId="u1" />);

    const nameInput = screen.getByLabelText(/account name/i);
    await user.type(nameInput, 'Savings');
    await user.click(screen.getByRole('radio', { name: 'CASH' }));
    await user.click(screen.getByRole('button', { name: /add account/i }));

    await waitFor(() => expect(captured).not.toBeNull());
    expect(captured).toEqual({ userId: 'u1', name: 'Savings', type: 'CASH' });
  });

  it('trims the name before POSTing', async () => {
    let captured: unknown = null;
    server.use(
      http.post(`${BASE}/accounts`, async ({ request }) => {
        captured = await request.json();
        return HttpResponse.json({ id: 'a-new' }, { status: 201 });
      }),
    );

    const user = userEvent.setup();
    wrap(<AccountForm apiBaseUrl={BASE} userId="u1" />);

    const nameInput = screen.getByLabelText(/account name/i);
    await user.type(nameInput, '   Checking   ');
    await user.click(screen.getByRole('button', { name: /add account/i }));

    await waitFor(() => expect(captured).not.toBeNull());
    expect((captured as { name: string }).name).toBe('Checking');
  });

  it('disables submit and shows "Saving…" while the mutation is in-flight', async () => {
    let resolvePost!: () => void;
    server.use(
      http.post(`${BASE}/accounts`, () =>
        new Promise<Response>((resolve) => {
          resolvePost = () => resolve(HttpResponse.json({ id: 'a-new' }, { status: 201 }));
        }),
      ),
    );

    const user = userEvent.setup();
    wrap(<AccountForm apiBaseUrl={BASE} userId="u1" />);

    await user.type(screen.getByLabelText(/account name/i), 'Checking');
    await user.click(screen.getByRole('button', { name: /add account/i }));

    // While pending: button text flips to "Saving…" and is disabled.
    const saving = await screen.findByRole('button', { name: /saving…/i });
    expect(saving).toBeDisabled();

    resolvePost();

    // After resolve: button returns to "Add account" and is enabled again.
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /add account/i })).toBeEnabled(),
    );
  });

  it('keeps the field values populated after a successful submit (no implicit reset)', async () => {
    server.use(
      http.post(`${BASE}/accounts`, () =>
        HttpResponse.json({ id: 'a-new' }, { status: 201 }),
      ),
    );

    const user = userEvent.setup();
    wrap(<AccountForm apiBaseUrl={BASE} userId="u1" />);

    const nameInput = screen.getByLabelText(/account name/i) as HTMLInputElement;
    await user.type(nameInput, 'Checking');
    await user.click(screen.getByRole('radio', { name: 'CARD' }));
    await user.click(screen.getByRole('button', { name: /add account/i }));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /add account/i })).toBeEnabled(),
    );
    // The form does not auto-reset. The current behavior is to leave the
    // values in place; this test pins that contract.
    expect(nameInput.value).toBe('Checking');
    expect(screen.getByRole('radio', { name: 'CARD' })).toHaveAttribute('aria-checked', 'true');
  });

  it('surfaces backend errors verbatim on mutation failure', async () => {
    server.use(
      http.post(`${BASE}/accounts`, () =>
        HttpResponse.json({ error: 'Account name already exists' }, { status: 409 }),
      ),
    );

    const user = userEvent.setup();
    wrap(<AccountForm apiBaseUrl={BASE} userId="u1" />);

    await user.type(screen.getByLabelText(/account name/i), 'Checking');
    await user.click(screen.getByRole('button', { name: /add account/i }));

    expect(await screen.findByText(/account name already exists/i)).toBeInTheDocument();
  });
});