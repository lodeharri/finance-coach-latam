/**
 * AccountForm molecule — Litografía del Sur (REQ-FFC-ACC-CREATE-FORM).
 *
 * Type glyph strip `BANK|CASH|CARD` per row (signature element). Composes
 * FormField rows. Calls useCreateAccount on submit; maps backend errors to
 * inline field errors verbatim.
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
      setError('Account name is required.');
      return;
    }
    setError(undefined);
    create.mutate(
      { userId, name: name.trim(), type },
      {
        onError: (err) => {
          setError(err instanceof Error ? err.message : 'Could not create account.');
        },
      },
    );
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-3" data-testid="account-form">
      <FormField
        id="acc-name"
        label="Account name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Checking"
        required
        error={error}
      />
      <div className="flex flex-col gap-1.5">
        <span className="font-body text-sm text-ink-tinta">Type</span>
        <div className="flex gap-2" role="radiogroup" aria-label="Account type">
          {TYPES.map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={type === t}
              onClick={() => setType(t)}
              className={
                'inline-flex h-10 items-center justify-center rounded-sm border px-3 font-mono text-xs uppercase tracking-[0.2em] ' +
                (type === t
                  ? 'border-ink-cobalto bg-ink-cobalto text-ink-paper'
                  : 'border-ink-paper-press bg-ink-paper-press text-ink-tinta hover:bg-ink-paper-lift')
              }
              data-testid={`account-type-${t}`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
      <div>
        <Button type="submit" disabled={create.isPending}>
          {create.isPending ? 'Saving…' : 'Add account'}
        </Button>
      </div>
    </form>
  );
}