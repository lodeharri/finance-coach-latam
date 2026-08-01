/**
 * NotFoundPage — Litografía del Sur.
 *
 * 404 page for unknown routes. No API calls.
 */
import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <main
      data-testid="not-found-page"
      className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-6 py-12"
      style={{ backgroundColor: 'var(--ink-paper)', color: 'var(--ink-tinta)' }}
    >
      <p
        className="font-mono text-xs uppercase tracking-[0.2em]"
        style={{ color: 'var(--ink-tinta-mute)' }}
      >
        N.º 0404 — No encontrado
      </p>
      <h1 className="mt-3 font-display text-2xl sm:text-3xl">404 — Página no encontrada</h1>
      <p className="mt-4 max-w-prose text-base sm:text-lg text-ink-tinta-soft">
        La página que buscas no existe. Usa el enlace de abajo para volver.
      </p>
      <Link
        to="/dashboard"
        className="mt-8 inline-flex w-fit font-body text-sm text-ink-cobalto underline-offset-2 hover:underline"
      >
        ← Volver al tablero
      </Link>
    </main>
  );
}