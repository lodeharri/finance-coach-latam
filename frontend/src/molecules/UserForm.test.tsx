/**
 * UserForm molecule tests (REQ-FFC-USR-CREATE-ADMIN).
 *
 * Colocated because the molecule has logic (controlled inputs, tier select,
 * validation, submit handler wired to useCreateUser). Covers email/name/tier
 * fields, email format validation, the JetBrains-Mono email display via
 * FormField type=email, and the admin create mutation pending UI.
 */
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, userEvent } from '@/test/test-utils';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/setup';
import { UserForm } from './UserForm';
import { sessionStore } from '@/stores/sessionStore';

const BASE = 'https://api.example.test';

function wrap(node: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={client}>{node}</QueryClientProvider>);
}

describe('UserForm', () => {
  beforeEach(() => {
    sessionStore.getState().setSession({
      idToken: 'jwt',
      refreshToken: 'r',
      expiresAt: Date.now() + 600_000,
      userId: 'admin-1',
      email: 'admin@example.com',
      role: 'admin',
    });
    server.resetHandlers();
  });

  afterEach(() => {
    sessionStore.getState().clear();
    localStorage.clear();
  });

  it('renders the form with default props (empty email, empty name, BRONZE tier)', () => {
    wrap(<UserForm apiBaseUrl={BASE} />);

    const email = screen.getByLabelText(/correo/i) as HTMLInputElement;
    const name = screen.getByLabelText(/nombre/i) as HTMLInputElement;
    expect(email).toBeInTheDocument();
    expect(email.type).toBe('email');
    expect(email.value).toBe('');

    expect(name).toBeInTheDocument();
    expect(name.value).toBe('');

    // Tier is rendered as an editorial radiogroup (custom radio squares).
    expect(screen.getByRole('radio', { name: 'BRONZE' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'SILVER' })).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('radio', { name: 'GOLD' })).toHaveAttribute('aria-checked', 'false');
  });

  it('email field accepts input', async () => {
    const user = userEvent.setup();
    wrap(<UserForm apiBaseUrl={BASE} />);

    const email = screen.getByLabelText(/correo/i);
    await user.type(email, 'jane@example.com');
    expect((email as HTMLInputElement).value).toBe('jane@example.com');
  });

  it('name field accepts input', async () => {
    const user = userEvent.setup();
    wrap(<UserForm apiBaseUrl={BASE} />);

    const name = screen.getByLabelText(/nombre/i);
    await user.type(name, 'Jane Doe');
    expect((name as HTMLInputElement).value).toBe('Jane Doe');
  });

  it('tier radio group accepts BRONZE / SILVER / GOLD selections', async () => {
    const user = userEvent.setup();
    wrap(<UserForm apiBaseUrl={BASE} />);

    await user.click(screen.getByRole('radio', { name: 'SILVER' }));
    expect(screen.getByRole('radio', { name: 'SILVER' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'BRONZE' })).toHaveAttribute('aria-checked', 'false');

    await user.click(screen.getByRole('radio', { name: 'GOLD' }));
    expect(screen.getByRole('radio', { name: 'GOLD' })).toHaveAttribute('aria-checked', 'true');

    await user.click(screen.getByRole('radio', { name: 'BRONZE' }));
    expect(screen.getByRole('radio', { name: 'BRONZE' })).toHaveAttribute('aria-checked', 'true');
  });

  it('submitting with empty email + empty name surfaces both field errors', async () => {
    const user = userEvent.setup();
    wrap(<UserForm apiBaseUrl={BASE} />);

    await user.click(screen.getByRole('button', { name: /agregar usuario/i }));

    expect(await screen.findByText(/correo es obligatorio/i)).toBeInTheDocument();
    expect(await screen.findByText(/nombre es obligatorio/i)).toBeInTheDocument();
  });

  it('submits a malformed email: JS validation catches it before POST (no POST fires)', async () => {
    // The form has noValidate so HTML5 constraint validation does NOT gate the
    // submit event. The molecule's own JS validation catches a value without
    // an "@" before the mutation runs. This test pins that contract: no POST
    // is sent, the custom error renders verbatim.
    let posts = 0;
    server.use(
      http.post(`${BASE}/users`, () => {
        posts += 1;
        return HttpResponse.json({ id: 'u-new' }, { status: 201 });
      }),
    );

    const user = userEvent.setup();
    wrap(<UserForm apiBaseUrl={BASE} />);

    await user.type(screen.getByLabelText(/correo/i), 'not-an-email');
    await user.type(screen.getByLabelText(/nombre/i), 'Jane');
    await user.click(screen.getByRole('button', { name: /agregar usuario/i }));

    await new Promise((r) => setTimeout(r, 30));
    expect(posts).toBe(0);
    expect(await screen.findByText(/correo es obligatorio/i)).toBeInTheDocument();
  });

  it('submitting with a valid email but missing name surfaces only the name error', async () => {
    const user = userEvent.setup();
    wrap(<UserForm apiBaseUrl={BASE} />);

    await user.type(screen.getByLabelText(/correo/i), 'jane@example.com');
    await user.click(screen.getByRole('button', { name: /agregar usuario/i }));

    expect(await screen.findByText(/nombre es obligatorio/i)).toBeInTheDocument();
    expect(screen.queryByText(/correo es obligatorio/i)).not.toBeInTheDocument();
  });

  it('submitting with a valid email but missing tier is impossible (tier defaults to BRONZE)', async () => {
    let captured: unknown = null;
    server.use(
      http.post(`${BASE}/users`, async ({ request }) => {
        captured = await request.json();
        return HttpResponse.json(
          { id: 'u-new', email: 'jane@example.com', name: 'Jane', tier: 'BRONZE' },
          { status: 201 },
        );
      }),
    );

    const user = userEvent.setup();
    wrap(<UserForm apiBaseUrl={BASE} />);

    await user.type(screen.getByLabelText(/correo/i), 'jane@example.com');
    await user.type(screen.getByLabelText(/nombre/i), 'Jane');
    // Do not touch the tier select.
    await user.click(screen.getByRole('button', { name: /agregar usuario/i }));

    await waitFor(() => expect(captured).not.toBeNull());
    expect(captured).toEqual({ email: 'jane@example.com', name: 'Jane', tier: 'BRONZE' });
  });

  it('submitting with valid values POSTs { email, name, tier } to /users', async () => {
    let captured: unknown = null;
    server.use(
      http.post(`${BASE}/users`, async ({ request }) => {
        captured = await request.json();
        return HttpResponse.json(
          { id: 'u-new', email: 'jane@example.com', name: 'Jane Doe', tier: 'GOLD' },
          { status: 201 },
        );
      }),
    );

    const user = userEvent.setup();
    wrap(<UserForm apiBaseUrl={BASE} />);

    await user.type(screen.getByLabelText(/correo/i), 'jane@example.com');
    await user.type(screen.getByLabelText(/nombre/i), 'Jane Doe');
    await user.click(screen.getByRole('radio', { name: 'GOLD' }));
    await user.click(screen.getByRole('button', { name: /agregar usuario/i }));

    await waitFor(() => expect(captured).not.toBeNull());
    expect(captured).toEqual({ email: 'jane@example.com', name: 'Jane Doe', tier: 'GOLD' });
  });

  it('trims email and name before POSTing', async () => {
    let captured: unknown = null;
    server.use(
      http.post(`${BASE}/users`, async ({ request }) => {
        captured = await request.json();
        return HttpResponse.json({ id: 'u-new' }, { status: 201 });
      }),
    );

    const user = userEvent.setup();
    wrap(<UserForm apiBaseUrl={BASE} />);

    await user.type(screen.getByLabelText(/correo/i), '  jane@example.com  ');
    await user.type(screen.getByLabelText(/nombre/i), '  Jane  ');
    await user.click(screen.getByRole('button', { name: /agregar usuario/i }));

    await waitFor(() => expect(captured).not.toBeNull());
    const body = captured as { email: string; name: string };
    expect(body.email).toBe('jane@example.com');
    expect(body.name).toBe('Jane');
  });

  it('disables submit and shows "Saving…" while the mutation is in-flight', async () => {
    let resolvePost!: () => void;
    server.use(
      http.post(`${BASE}/users`, () =>
        new Promise<Response>((resolve) => {
          resolvePost = () => resolve(HttpResponse.json({ id: 'u-new' }, { status: 201 }));
        }),
      ),
    );

    const user = userEvent.setup();
    wrap(<UserForm apiBaseUrl={BASE} />);

    await user.type(screen.getByLabelText(/correo/i), 'jane@example.com');
    await user.type(screen.getByLabelText(/nombre/i), 'Jane');
    await user.click(screen.getByRole('button', { name: /agregar usuario/i }));

    const saving = await screen.findByRole('button', { name: /guardando…/i });
    expect(saving).toBeDisabled();

    resolvePost();

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /agregar usuario/i })).toBeEnabled(),
    );
  });

  it('surfaces backend errors as a form-level alert', async () => {
    server.use(
      http.post(`${BASE}/users`, () =>
        HttpResponse.json({ error: 'Email already in use' }, { status: 409 }),
      ),
    );

    const user = userEvent.setup();
    wrap(<UserForm apiBaseUrl={BASE} />);

    await user.type(screen.getByLabelText(/correo/i), 'taken@example.com');
    await user.type(screen.getByLabelText(/nombre/i), 'Jane');
    await user.click(screen.getByRole('button', { name: /agregar usuario/i }));

    expect(await screen.findByText(/email already in use/i)).toBeInTheDocument();
    const alerts = screen.getAllByRole('alert');
    expect(alerts.some((el) => /email already in use/i.test(el.textContent ?? ''))).toBe(true);
  });
});