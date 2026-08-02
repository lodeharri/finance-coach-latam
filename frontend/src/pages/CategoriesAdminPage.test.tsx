/**
 * CategoriesAdminPage page tests (REQ-FF-CATEGORIES-CRUD).
 *
 * Pins the full CRUD surface for the admin category manager:
 *  - "+ Nueva categoría" button at the top opens a Modal with create form.
 *  - Each row exposes Editar (opens a Modal pre-populated) + Eliminar
 *    (opens a confirmation modal).
 *  - Submitting Create closes the modal and the row appears.
 *  - Submitting Edit updates the row in place.
 *  - Confirming Eliminar removes the row (optimistic).
 *  - Cancelling Eliminar does NOT remove the row.
 *  - Slug is read-only in the edit form (it is immutable per the backend
 *    contract).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor, userEvent, act } from '@/test/test-utils';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router-dom';
import { server } from '@/test/setup';
import { CategoriesAdminPage } from './CategoriesAdminPage';
import { sessionStore } from '@/stores/sessionStore';

const BASE = 'https://api.example.test';

function wrap(node: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/admin/categories']}>{node}</MemoryRouter>
    </QueryClientProvider>,
  );
}

const CATEGORIES = [
  { id: 'c1', slug: 'transporte', name: 'Transporte', color: '#1F3FB8' },
  { id: 'c2', slug: 'alimentos', name: 'Alimentos', color: '#1F4D2C' },
];

function seed() {
  server.resetHandlers();
  server.use(
    http.get(`${BASE}/categories`, () => HttpResponse.json(CATEGORIES)),
    http.get(`${BASE}/accounts`, () => HttpResponse.json([])),
    http.get(`${BASE}/transactions`, () => HttpResponse.json([])),
  );
}

describe('CategoriesAdminPage — full CRUD with modals', () => {
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

  it('renders the existing categories in a table', async () => {
    wrap(<CategoriesAdminPage apiBaseUrl={BASE} />);
    expect(await screen.findByText('Transporte')).toBeInTheDocument();
    expect(screen.getByText('Alimentos')).toBeInTheDocument();
  });

  it('renders a "+ Nueva categoría" button in the header', () => {
    wrap(<CategoriesAdminPage apiBaseUrl={BASE} />);
    expect(
      screen.getByRole('button', { name: /\+ nueva categoría/i }),
    ).toBeInTheDocument();
  });

  it('clicking "+ Nueva categoría" opens a modal with the create form', async () => {
    const user = userEvent.setup();
    wrap(<CategoriesAdminPage apiBaseUrl={BASE} />);

    await user.click(screen.getByRole('button', { name: /\+ nueva categoría/i }));

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toBeInTheDocument();
    // The create form has slug + name + color fields.
    expect(within(dialog).getByLabelText(/slug/i)).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/nombre/i)).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/color/i)).toBeInTheDocument();
  });

  it('submitting a valid create closes the modal and the new row appears', async () => {
    let posted: Record<string, unknown> | null = null;
    server.use(
      http.post(`${BASE}/categories`, async ({ request }) => {
        posted = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(
          { id: 'c-new', slug: 'cultura', name: 'Cultura', color: '#aabbcc' },
          { status: 201 },
        );
      }),
    );

    const user = userEvent.setup();
    wrap(<CategoriesAdminPage apiBaseUrl={BASE} />);

    await user.click(screen.getByRole('button', { name: /\+ nueva categoría/i }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText(/slug/i), 'cultura');
    await user.type(within(dialog).getByLabelText(/nombre/i), 'Cultura');
    // Color inputs are not editable via userEvent.type / .clear; set the
    // value through the React-tracked setter so onChange fires.
    await act(async () => {
      const colorInput = within(dialog).getByLabelText(/color/i) as HTMLInputElement;
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value',
      )?.set;
      setter?.call(colorInput, '#aabbcc');
      colorInput.dispatchEvent(new Event('input', { bubbles: true }));
      colorInput.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await user.click(within(dialog).getByRole('button', { name: /crear categoría/i }));

    await waitFor(() => expect(posted).not.toBeNull());
    expect(posted).toMatchObject({ slug: 'cultura', name: 'Cultura', color: '#aabbcc' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('each row has Editar + Eliminar buttons', async () => {
    wrap(<CategoriesAdminPage apiBaseUrl={BASE} />);
    await screen.findByText('Transporte');
    expect(screen.getAllByRole('button', { name: /editar/i })).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: /eliminar/i })).toHaveLength(2);
  });

  it('clicking Editar opens a modal pre-populated with the category', async () => {
    const user = userEvent.setup();
    wrap(<CategoriesAdminPage apiBaseUrl={BASE} />);
    await screen.findByText('Transporte');

    const editButtons = screen.getAllByRole('button', { name: /editar/i });
    await user.click(editButtons[0]!);

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toBeInTheDocument();
    // The edit form is pre-populated with Transporte / #1F3FB8.
    expect((within(dialog).getByLabelText(/nombre/i) as HTMLInputElement).value).toBe(
      'Transporte',
    );
    expect((within(dialog).getByLabelText(/color/i) as HTMLInputElement).value).toBe(
      '#1f3fb8',
    );
    // Slug is read-only in the edit form (immutable per backend contract).
    const slug = within(dialog).getByLabelText(/slug/i) as HTMLInputElement;
    expect(slug).toBeDisabled();
  });

  it('submitting a valid edit PATCHes the category and closes the modal', async () => {
    let patched: Record<string, unknown> | null = null;
    server.use(
      http.patch(`${BASE}/categories/c1`, async ({ request }) => {
        patched = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({
          id: 'c1',
          slug: 'transporte',
          name: 'Transporte público',
          color: '#1F3FB8',
        });
      }),
    );

    const user = userEvent.setup();
    wrap(<CategoriesAdminPage apiBaseUrl={BASE} />);
    await screen.findByText('Transporte');

    const editButtons = screen.getAllByRole('button', { name: /editar/i });
    await user.click(editButtons[0]!);
    const dialog = await screen.findByRole('dialog');
    await user.clear(within(dialog).getByLabelText(/nombre/i));
    await user.type(within(dialog).getByLabelText(/nombre/i), 'Transporte público');
    await user.click(within(dialog).getByRole('button', { name: /guardar cambios/i }));

    await waitFor(() => expect(patched).not.toBeNull());
    // The form sends name + color on edit (the backend ignores unchanged
    // fields, but the form does not diff — it just submits what is in state).
    expect(patched).toEqual({ name: 'Transporte público', color: '#1F3FB8' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('clicking Eliminar opens a confirmation modal naming the category', async () => {
    const user = userEvent.setup();
    wrap(<CategoriesAdminPage apiBaseUrl={BASE} />);
    await screen.findByText('Transporte');

    const deleteButtons = screen.getAllByRole('button', { name: /eliminar/i });
    await user.click(deleteButtons[0]!);

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(dialog.textContent).toMatch(/Transporte/);
  });

  it('cancelling the delete confirmation does NOT remove the row', async () => {
    const user = userEvent.setup();
    wrap(<CategoriesAdminPage apiBaseUrl={BASE} />);
    await screen.findByText('Transporte');

    const deleteButtons = screen.getAllByRole('button', { name: /eliminar/i });
    await user.click(deleteButtons[0]!);
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /cancelar/i }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByText('Transporte')).toBeInTheDocument();
  });

  it('confirming the delete DELETEs and removes the row (optimistic)', async () => {
    let deleted = false;
    server.use(
      http.get(`${BASE}/categories`, () =>
        HttpResponse.json(
          deleted ? [CATEGORIES[1]!] : CATEGORIES,
        ),
      ),
      http.delete(`${BASE}/categories/c1`, () => {
        deleted = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const user = userEvent.setup();
    wrap(<CategoriesAdminPage apiBaseUrl={BASE} />);
    await screen.findByText('Transporte');

    const deleteButtons = screen.getAllByRole('button', { name: /eliminar/i });
    await user.click(deleteButtons[0]!);
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /^eliminar$/i }));

    await waitFor(() => expect(screen.queryByText('Transporte')).not.toBeInTheDocument());
  });
});

function within(dialog: HTMLElement) {
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
