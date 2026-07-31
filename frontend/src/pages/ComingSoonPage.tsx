/**
 * ComingSoonPage — placeholder until PR4 wires real routes.
 *
 * Pure token + Tailwind usage. No atoms, no API. Confirms the design system
 * token layer is alive end-to-end and the deploy job can serve a meaningful
 * page to Cloudflare Pages.
 */
export function ComingSoonPage() {
  return (
    <main
      data-testid="coming-soon-page"
      className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6 py-12"
      style={{ backgroundColor: 'var(--ink-paper)', color: 'var(--ink-tinta)' }}
    >
      <p
        className="font-mono text-xs uppercase tracking-[0.2em]"
        style={{ color: 'var(--ink-tinta-mute)' }}
      >
        N.º 0001 — Edición piloto
      </p>

      <h1
        className="mt-3 font-display text-2xl sm:text-3xl"
        style={{ color: 'var(--ink-tinta)' }}
      >
        Finance Coach LATAM
      </h1>

      <p
        className="mt-4 max-w-prose text-base sm:text-lg"
        style={{ color: 'var(--ink-tinta-soft)' }}
      >
        Tu asistente financiero personal para América Latina. Estamos preparando
        los módulos de transacciones, categorías y análisis. Esta página confirma
        que el pipeline de despliegue en Cloudflare Pages está en línea.
      </p>

      <p
        className="mt-8 font-mono text-xs"
        style={{ color: 'var(--ink-cobalto)' }}
      >
        PR1 · Litografía del Sur · scaffold + tokens
      </p>
    </main>
  );
}
