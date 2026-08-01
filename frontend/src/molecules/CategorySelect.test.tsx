/**
 * CategorySelect molecule tests (REQ-FFC-TX-OVERRIDE).
 *
 * Colocated because the molecule has logic (controlled selection + dropdown
 * toggle + a11y attributes).
 */
import { describe, expect, it } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@/test/test-utils';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/setup';
import { beforeEach, afterEach } from 'vitest';
import { CategorySelect } from './CategorySelect';
import { sessionStore } from '@/stores/sessionStore';

const BASE = 'https://api.example.test';

function wrap(node: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{node}</QueryClientProvider>);
}

describe('CategorySelect', () => {
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

  it('renders a trigger button with aria-expanded=false initially', () => {
    server.use(
      http.get(`${BASE}/categories`, () =>
        HttpResponse.json([{ id: 'c1', slug: 'a', name: 'A', color: '#111111' }]),
      ),
    );

    wrap(<CategorySelect apiBaseUrl={BASE} onChange={() => {}} />);
    const trigger = screen.getByRole('button', { name: /elegir categoría/i });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('opens the dropdown and shows categories when the trigger is clicked', async () => {
    server.use(
      http.get(`${BASE}/categories`, () =>
        HttpResponse.json([
          { id: 'c1', slug: 'transporte', name: 'Transporte', color: '#1F3FB8' },
          { id: 'c2', slug: 'alimentos', name: 'Alimentos', color: '#1F4D2C' },
        ]),
      ),
    );

    wrap(<CategorySelect apiBaseUrl={BASE} onChange={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /elegir categoría/i }));
    await waitFor(() => expect(screen.getByRole('listbox')).toBeInTheDocument());
    expect(screen.getByRole('option', { name: /transporte/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /alimentos/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /elegir categoría/i })).toHaveAttribute('aria-expanded', 'true');
  });

  it('invokes onChange with the selected categoryId', async () => {
    server.use(
      http.get(`${BASE}/categories`, () =>
        HttpResponse.json([{ id: 'c2', slug: 'alimentos', name: 'Alimentos', color: '#1F4D2C' }]),
      ),
    );

    let captured: string | undefined;
    wrap(<CategorySelect apiBaseUrl={BASE} onChange={(id) => (captured = id)} />);
    fireEvent.click(screen.getByRole('button', { name: /elegir categoría/i }));
    await waitFor(() => expect(screen.getByRole('listbox')).toBeInTheDocument());
    // The listbox <li role="option"> wraps a <button>; click the button inside.
    fireEvent.click(screen.getByRole('listbox').querySelector('button')!);
    expect(captured).toBe('c2');
  });

  it('renders the selected category name on the trigger', async () => {
    server.use(
      http.get(`${BASE}/categories`, () =>
        HttpResponse.json([{ id: 'c2', slug: 'alimentos', name: 'Alimentos', color: '#1F4D2C' }]),
      ),
    );

    wrap(<CategorySelect apiBaseUrl={BASE} value="c2" onChange={() => {}} />);
    await waitFor(() => expect(screen.getByText('Alimentos')).toBeInTheDocument());
  });

  it('respects the disabled prop', () => {
    server.use(
      http.get(`${BASE}/categories`, () => HttpResponse.json([])),
    );
    wrap(<CategorySelect apiBaseUrl={BASE} onChange={() => {}} disabled />);
    expect(screen.getByRole('button', { name: /elegir categoría/i })).toBeDisabled();
  });
});