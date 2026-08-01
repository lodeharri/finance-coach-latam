/**
 * UserForm molecule — Litografía del Sur (REQ-FFC-USR-CREATE-ADMIN).
 *
 * Editorial treatment:
 * - Hairline-bottom inputs (variant="editorial").
 * - Custom tier select rendered as a 3-row mono caps grid (BANK | CASH | CARD
 *   style, applied to tier choices).
 * - Email displayed in JetBrains Mono (signature element).
 */
import { useState } from 'react';
import { Button } from '@/atoms/Button';
import { FormField } from './FormField';
import { useCreateUser } from '@/hooks/useUsers';
import type { UserTier } from '@/services/types';

const TIERS: UserTier[] = ['BRONZE', 'SILVER', 'GOLD'];

export interface UserFormProps {
  apiBaseUrl: string;
}

export function UserForm({ apiBaseUrl }: UserFormProps) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [tier, setTier] = useState<UserTier>('BRONZE');
  const [errors, setErrors] = useState<{ email?: string; name?: string; form?: string }>({});
  const create = useCreateUser({ apiBaseUrl });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    if (!email.trim() || !email.includes('@')) next.email = 'El correo es obligatorio.';
    if (!name.trim()) next.name = 'El nombre es obligatorio.';
    if (Object.keys(next).length > 0) {
      setErrors(next);
      return;
    }
    setErrors({});
    create.mutate(
      { email: email.trim(), name: name.trim(), tier },
      {
        onError: (err) => {
          setErrors({ form: err instanceof Error ? err.message : 'No se pudo crear el usuario.' });
        },
      },
    );
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5" data-testid="user-form">
      <FormField
        id="usr-email"
        label="Correo"
        type="email"
        variant="editorial"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="usuario@ejemplo.com"
        required
        error={errors.email}
      />
      <FormField
        id="usr-name"
        label="Nombre"
        variant="editorial"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Juan Pérez"
        required
        error={errors.name}
      />
      <div className="flex flex-col gap-2">
        <label
          htmlFor="usr-tier"
          className="block font-mono text-xs uppercase tracking-[0.2em] text-ink-tinta-soft"
        >
          Nivel
        </label>
        <div className="flex gap-2" role="radiogroup" aria-label="Nivel de usuario">
          {TIERS.map((t) => {
            const active = tier === t;
            return (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setTier(t)}
                className={
                  'inline-flex h-9 items-center justify-center rounded-sm border px-3 transition-colors ' +
                  'font-mono text-xs uppercase tracking-[0.2em] ' +
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-ink-cobalto focus-visible:ring-offset-2 ' +
                  (active
                    ? 'border-ink-cobalto bg-ink-cobalto text-ink-paper'
                    : 'border-ink-paper-press bg-ink-paper-lift text-ink-tinta hover:border-ink-cobalto/40')
                }
                data-testid={`user-tier-${t}`}
              >
                {t}
              </button>
            );
          })}
        </div>
      </div>
      {errors.form ? (
        <span role="alert" className="font-body text-sm text-ink-negativo">{errors.form}</span>
      ) : null}
      <div>
        <Button type="submit" disabled={create.isPending}>
          {create.isPending ? 'Guardando…' : 'Agregar usuario'}
        </Button>
      </div>
    </form>
  );
}
