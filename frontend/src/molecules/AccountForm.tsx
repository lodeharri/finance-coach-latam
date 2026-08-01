/**
 * AccountForm molecule — Litografía del Sur (REQ-FFC-ACC-CREATE-FORM).
 *
 * Signature: custom radio squares (BANK | CASH | CARD) — 32×32 squares with a
 * cobalt inner square when checked. Mono caps label above. Hairline-bottom
 * input for the name field.
 *
 * Composes FormField rows. Calls useCreateAccount on submit; maps backend
 * errors to inline field errors verbatim.
 */
import { useState } from 'react';
import { Button } from '@/atoms/Button';
import { FormField } from './FormField';
import { useCreateAccount } from '@/hooks/useAccounts';
import type { AccountType } from '@/services/types';

export interface AccountFormProps {
  apiBaseUrl: string;
  userId: string;
}

const TYPES: AccountType[] = ['BANK', 'CASH', 'CARD'];

export function AccountForm({ apiBaseUrl, userId }: AccountFormProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('BANK');
  const [error, setError] = useState<string | undefined>();
  const create = useCreateAccount({ apiBaseUrl });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('El nombre de la cuenta es obligatorio.');
      return;
    }
    setError(undefined);
    create.mutate(
      { userId, name: name.trim(), type },
      {
        onError: (err) => {
          setError(err instanceof Error ? err.message : 'No se pudo crear la cuenta.');
        },
      },
    );
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5" data-testid="account-form">
      <FormField
        id="acc-name"
        label="Nombre de la cuenta"
        variant="editorial"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Cuenta corriente"
        required
        error={error}
      />
      <div className="flex flex-col gap-2">
        <span className="block font-mono text-xs uppercase tracking-[0.2em] text-ink-tinta-soft">
          Tipo de cuenta
        </span>
        <div className="flex gap-3" role="radiogroup" aria-label="Account type">
          {TYPES.map((t) => {
            const active = type === t;
            return (
              <div key={t} className="flex flex-col items-center gap-1">
                <button
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setType(t)}
                  className={
                    'inline-flex h-12 w-12 items-center justify-center rounded-sm border transition-colors ' +
                    'focus:outline-none focus-visible:ring-2 focus-visible:ring-ink-cobalto focus-visible:ring-offset-2 ' +
                    (active
                      ? 'border-ink-cobalto bg-ink-cobalto text-ink-paper'
                      : 'border-ink-paper-press bg-ink-paper-lift text-ink-tinta hover:border-ink-cobalto/40')
                  }
                  data-testid={`account-type-${t}`}
                >
                  <span
                    aria-hidden="true"
                    className={
                      'block h-3 w-3 ' + (active ? 'bg-ink-paper' : 'border border-ink-tinta-mute')
                    }
                  />
                  <span className="sr-only">{t}</span>
                </button>
                <span
                  aria-hidden="true"
                  data-testid={`account-type-label-${t}`}
                  className={
                    'font-mono text-[10px] uppercase tracking-[0.2em] ' +
                    (active ? 'text-ink-tinta' : 'text-ink-tinta-soft')
                  }
                >
                  {t}
                </span>
              </div>
            );
          })}
        </div>
        <span
          aria-live="polite"
          className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-tinta-mute"
        >
          Tipo seleccionado: {type}
        </span>
      </div>
      <div>
        <Button type="submit" disabled={create.isPending}>
          {create.isPending ? 'Guardando…' : 'Agregar cuenta'}
        </Button>
      </div>
    </form>
  );
}
