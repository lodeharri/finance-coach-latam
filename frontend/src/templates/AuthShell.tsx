import type { ReactNode } from 'react';
import { HexStamp } from '@/atoms/HexStamp';

export interface AuthShellProps {
  title?: string;
  children: ReactNode;
}

export function AuthShell({ title, children }: AuthShellProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-paper px-4 py-12" data-testid="auth-shell">
      <div data-testid="auth-shell-card" className="relative w-full max-w-md rounded border border-ink-paper-press border-t-4 border-t-ink-cobalto bg-ink-paper-lift p-8 shadow-sm">
        <div className="flex flex-col items-center text-center">
          <HexStamp />
          <span className="mt-4 font-display text-2xl font-bold tracking-[0.24em]">FINANZAS</span>
          <span className="mt-2 font-body text-[0.65rem] uppercase tracking-[0.18em] text-ink-tinta-soft">Asistente financiero personal</span>
        </div>
        {title ? <h2 className="mb-6 mt-8 font-display text-xl font-bold text-ink-tinta">{title}</h2> : null}
        {children}
        <p className="mt-8 text-center font-mono text-[10px] uppercase tracking-[0.3em] text-ink-tinta-mute">Litografía del Sur · finance-coach-latam</p>
      </div>
    </div>
  );
}
