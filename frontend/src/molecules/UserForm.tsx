/**
 * UserForm molecule — Litografía del Sur (REQ-FFC-USR-CREATE-ADMIN).
 *
 * Composes FormField rows. Calls admin create endpoint. Email displayed in
 * JetBrains Mono (signature element).
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
    if (!email.trim() || !email.includes('@')) next.email = 'Email is required.';
    if (!name.trim()) next.name = 'Name is required.';
    if (Object.keys(next).length > 0) {
      setErrors(next);
      return;
    }
    setErrors({});
    create.mutate(
      { email: email.trim(), name: name.trim(), tier },
      {
        onError: (err) => {
          setErrors({ form: err instanceof Error ? err.message : 'Could not create user.' });
        },
      },
    );
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-3" data-testid="user-form">
      <FormField
        id="usr-email"
        label="Email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="user@example.com"
        required
        error={errors.email}
      />
      <FormField
        id="usr-name"
        label="Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Jane Doe"
        required
        error={errors.name}
      />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="usr-tier" className="font-body text-sm text-ink-tinta">Tier</label>
        <select
          id="usr-tier"
          value={tier}
          onChange={(e) => setTier(e.target.value as UserTier)}
          className="h-10 rounded-sm border border-ink-paper-press bg-ink-paper-press px-3 font-body text-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ink-cobalto"
        >
          {TIERS.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>
      {errors.form ? (
        <span role="alert" className="font-body text-sm text-ink-negativo">{errors.form}</span>
      ) : null}
      <div>
        <Button type="submit" disabled={create.isPending}>
          {create.isPending ? 'Saving…' : 'Add user'}
        </Button>
      </div>
    </form>
  );
}