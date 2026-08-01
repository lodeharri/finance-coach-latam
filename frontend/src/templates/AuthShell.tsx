import type { ReactNode } from 'react';
import { HexStamp } from '@/atoms/HexStamp';

export interface AuthShellProps {
  title?: string;
  children: ReactNode;
}

/**
 * AuthShell — Litografía del Sur.
 *
 * Editorial treatment:
 * - Cobalt 4px top rule on the plate (signature: the engraved plate).
 * - Hairline border-b-1 below the cobalt rule.
 * - Kicker `EDICIÓN DE OTOÑO · 2026` in mono caps tracking-3em above the title.
 * - Asterism `* * *` divider in mono between the title block and the form.
 * - HexStamp at md size (24 px), centered, alone.
 * - Asymmetric padding inside the plate.
 */
export function AuthShell({ title, children }: AuthShellProps) {
  return (
    <div
      className="flex min-h-screen items-center justify-center bg-ink-paper px-4 py-12"
      data-testid="auth-shell"
      style={{
        backgroundImage:
          'radial-gradient(circle at 1px 1px, var(--ink-paper-grain) 1px, transparent 0)',
        backgroundSize: '8px 8px',
      }}
    >
      <div
        data-testid="auth-shell-card"
        className="relative w-full max-w-md rounded-sm border border-ink-paper-press border-t-[4px] border-t-ink-cobalto bg-ink-paper-lift pl-10 pr-12 py-10 shadow-sm"
      >
        <div className="flex flex-col items-center text-center">
          <HexStamp size="lg" />
          <span
            className="mt-5 font-mono text-[10px] uppercase tracking-[0.3em] text-ink-tinta-mute"
            data-testid="auth-shell-kicker"
          >
            EDICIÓN DE OTOÑO · 2026
          </span>
          <span className="mt-3 font-display text-2xl font-bold tracking-[0.24em]">FINANZAS</span>
          <span className="mt-2 font-body text-[0.65rem] uppercase tracking-[0.18em] text-ink-tinta-soft">
            Asistente financiero personal
          </span>
        </div>
        {title ? (
          <h2 className="mb-6 mt-8 font-display text-xl font-bold text-ink-tinta">{title}</h2>
        ) : null}
        <div
          aria-hidden="true"
          data-testid="auth-shell-asterism"
          className="my-6 text-center font-mono text-xs uppercase tracking-[0.3em] text-ink-tinta-mute"
        >
          * * *
        </div>
        {children}
        <p className="mt-10 text-center font-mono text-[10px] uppercase tracking-[0.3em] text-ink-tinta-mute">
          Litografía del Sur · finance-coach-latam
        </p>
      </div>
    </div>
  );
}
