/**
 * AccountsPage page tests (REQ-FF-ADMIN-CRUD-MODAL).
 *
 * Pins the modal flow contract: the create form lives behind a button at the
 * top of the page, opens a Modal containing AccountForm, and the form
 * unmounts on success so its state resets for the next entry. The legacy
 * "bottom of page" form section is removed.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor, userEvent } from '@/test/test-utils';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router-dom';
import { server } from '@/test/setup';
import { AccountsPage } from './AccountsPage';
import { sessionStore } from '@/stores/sessionStore';

const BASE = 'https://api.example.test';

function wrap(node: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/accounts']}>{node}</MemoryRouter>
    </QueryClientProvider>,
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
    getByRole: (role: 'button' | 'radio', options?: { name?: RegExp }) => {
      const all = screen.getAllByRole(role, options);
      const inDialog = all.find((el) => dialog.contains(el));
      if (!inDialog) throw new Error(`No ${role} inside the dialog`);
      return inDialog;
    },
  };
}

describe('AccountsPage — modal create flow', () => {
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
    server.use(http.get(`${BASE}/accounts`, () => HttpResponse.json([])));
  });

  afterEach(() => {
    sessionStore.getState().clear();
    localStorage.clear();
  });

  it('renders a "+ Nueva cuenta" button in the page header', () => {
    wrap(<AccountsPage apiBaseUrl={BASE} />);
    expect(
      screen.getByRole('button', { name: /\+ nueva cuenta/i }),
    ).toBeInTheDocument();
  });

  it('does NOT render the form until the button is clicked', () => {
    wrap(<AccountsPage apiBaseUrl={BASE} />);
    expect(
      screen.queryByRole('button', { name: /agregar cuenta/i }),
    ).not.toBeInTheDocument();
  });

  it('clicking the button opens a modal with the AccountForm inside', async () => {
    const user = userEvent.setup();
    wrap(<AccountsPage apiBaseUrl={BASE} />);

    await user.click(screen.getByRole('button', { name: /\+ nueva cuenta/i }));

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(withinDialog(dialog).getByLabelText(/nombre de la cuenta/i)).toBeInTheDocument();
  });

  it('submitting a valid account closes the modal (form unmounts → state resets)', async () => {
    let posts = 0;
    server.use(
      http.post(`${BASE}/accounts`, () => {
        posts += 1;
        return HttpResponse.json(
          {
            id: 'a-new',
            userId: 'u1',
            name: 'Checking',
            type: 'BANK',
            createdAt: new Date().toISOString(),
          },
          { status: 201 },
        );
      }),
    );

    const user = userEvent.setup();
    wrap(<AccountsPage apiBaseUrl={BASE} />);

    await user.click(screen.getByRole('button', { name: /\+ nueva cuenta/i }));
    const dialog = await screen.findByRole('dialog');
    await user.type(withinDialog(dialog).getByLabelText(/nombre de la cuenta/i), 'Checking');
    await user.click(withinDialog(dialog).getByRole('button', { name: /agregar cuenta/i }));

    await waitFor(() => expect(posts).toBe(1));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('re-opening the modal after a successful create shows an empty form', async () => {
    server.use(
      http.post(`${BASE}/accounts`, () =>
        HttpResponse.json(
          {
            id: 'a-new',
            userId: 'u1',
            name: 'Checking',
            type: 'BANK',
            createdAt: new Date().toISOString(),
          },
          { status: 201 },
        ),
      ),
    );

    const user = userEvent.setup();
    wrap(<AccountsPage apiBaseUrl={BASE} />);

    // First create.
    await user.click(screen.getByRole('button', { name: /\+ nueva cuenta/i }));
    let dialog = await screen.findByRole('dialog');
    await user.type(withinDialog(dialog).getByLabelText(/nombre de la cuenta/i), 'Checking');
    await user.click(withinDialog(dialog).getByRole('button', { name: /agregar cuenta/i }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    // Re-open and assert the form is empty.
    await user.click(screen.getByRole('button', { name: /\+ nueva cuenta/i }));
    dialog = await screen.findByRole('dialog');
    expect(
      (withinDialog(dialog).getByLabelText(/nombre de la cuenta/i) as HTMLInputElement).value,
    ).toBe('');
  });

  it('the legacy "NUEVA CUENTA" bottom-of-page form section is removed', () => {
    wrap(<AccountsPage apiBaseUrl={BASE} />);
    // The old bottom-of-page section started with an asterism caption
    // "* * *  NUEVA CUENTA" before the form. The new top-of-page button
    // uses sentence case ("Nueva cuenta") and is the only place the words
    // appear now.
    expect(screen.queryByText(/\* \* \*.*NUEVA CUENTA/i)).not.toBeInTheDocument();
  });

  // Issue 4 — mobile responsive. The accounts table is 3 columns wide but
  // the N.º column has a fixed width (≥80px) and the type pill another
  // ~64px. On a 375px viewport with main padding (px-12) that crowds the
  // account name column. Wrap the table in overflow-x-auto so users can
  // pan horizontally if a name is long.
  it('wraps the accounts table in an overflow-x-auto container for horizontal scroll on small screens', () => {
    wrap(<AccountsPage apiBaseUrl={BASE} />);
    const table = screen.getByTestId('accounts-table');
    let parent = table.parentElement;
    let hasOverflow = false;
    while (parent) {
      if (parent.className && /overflow-x-auto/.test(parent.className)) {
        hasOverflow = true;
        break;
      }
      parent = parent.parentElement;
    }
    expect(hasOverflow).toBe(true);
  });
});
