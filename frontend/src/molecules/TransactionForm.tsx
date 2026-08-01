/**
 * TransactionForm molecule — Litografía del Sur (REQ-FFC-TX-CREATE-FORM).
 *
 * Editorial treatment:
 * - Hairline-bottom input via FormField variant="editorial".
 * - Asterism `* * *` divider in mono between sections.
 * - AmountInput keeps its full cobalt-2 border (the signature: the cost is
 *   the point).
 *
 * Composes AmountInput + FormField rows. Calls useCreateTransaction on
 * submit; maps backend errors to inline field errors verbatim.
 */
import { useState } from 'react';
import { AmountInput } from '@/atoms/AmountInput';
import { Button } from '@/atoms/Button';
import { FormField } from './FormField';
import { useAccounts } from '@/hooks/useAccounts';
import { useCreateTransaction } from '@/hooks/useTransactions';

export interface TransactionFormProps {
  apiBaseUrl: string;
  userId: string;
}

interface FormErrors {
  amount?: string;
  merchant?: string;
  occurredAt?: string;
  accountId?: string;
  notes?: string;
  form?: string;
}

function Asterism() {
  return (
    <div
      aria-hidden="true"
      className="my-1 text-center font-mono text-xs uppercase tracking-[0.3em] text-ink-tinta-mute"
    >
      * * *
    </div>
  );
}

export function TransactionForm({ apiBaseUrl, userId }: TransactionFormProps) {
  const todayIso = new Date().toISOString().slice(0, 10);
  const [amount, setAmount] = useState('');
  const [merchant, setMerchant] = useState('');
  const [occurredAt, setOccurredAt] = useState(todayIso);
  const [accountId, setAccountId] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});

  const accounts = useAccounts({ apiBaseUrl, userId });
  const create = useCreateTransaction({ apiBaseUrl });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const next: FormErrors = {};
    const cents = Number(amount);
    if (!amount || !Number.isInteger(cents) || cents <= 0) {
      next.amount = 'El monto debe ser un entero positivo (centavos).';
    }
    if (!merchant.trim()) next.merchant = 'El comercio es obligatorio.';
    if (!occurredAt) next.occurredAt = 'La fecha es obligatoria.';
    if (!accountId) next.accountId = 'La cuenta es obligatoria.';
    if (Object.keys(next).length > 0) {
      setErrors(next);
      return;
    }
    setErrors({});
    create.mutate(
      {
        userId,
        accountId,
        merchant: merchant.trim(),
        amountCents: cents,
        occurredAt: new Date(occurredAt).toISOString(),
        notes: notes.trim() ? notes.trim() : null,
      },
      {
        onError: (err) => {
          setErrors({ form: err instanceof Error ? err.message : 'No se pudo crear la transacción.' });
        },
      },
    );
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5" data-testid="transaction-form">
      <FormField
        id="tx-merchant"
        label="Comercio"
        variant="editorial"
        value={merchant}
        onChange={(e) => setMerchant(e.target.value)}
        placeholder="PedidosYa"
        required
        error={errors.merchant}
      />
      <FormField
        id="tx-occurredAt"
        label="Fecha"
        type="text"
        variant="editorial"
        value={occurredAt}
        onChange={(e) => setOccurredAt(e.target.value)}
        placeholder="YYYY-MM-DD"
        required
        error={errors.occurredAt}
      />
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="tx-account"
          className="block font-mono text-xs uppercase tracking-[0.2em] text-ink-tinta-soft"
        >
          Cuenta
        </label>
        <select
          id="tx-account"
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
          className="border-0 border-b border-ink-tinta bg-transparent px-0 py-2 font-body text-lg text-ink-tinta focus:border-ink-cobalto-deep focus:outline-none focus-visible:ring-0"
          required
        >
          <option value="">Seleccionar cuenta…</option>
          {accounts.data?.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        {errors.accountId ? (
          <span role="alert" className="font-body text-sm text-ink-negativo">
            {errors.accountId}
          </span>
        ) : null}
      </div>
      <Asterism />
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="tx-amount"
          className="block font-mono text-xs uppercase tracking-[0.2em] text-ink-tinta-soft"
        >
          Monto (centavos)
        </label>
        <AmountInput
          id="tx-amount"
          value={amount}
          onValueChange={setAmount}
          invalid={Boolean(errors.amount)}
          {...(errors.amount ? { describedById: 'tx-amount-error' } : {})}
        />
        {errors.amount ? (
          <span id="tx-amount-error" role="alert" className="font-body text-sm text-ink-negativo">
            {errors.amount}
          </span>
        ) : null}
      </div>
      <FormField
        id="tx-notes"
        label="Notas"
        variant="editorial"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Opcional"
        error={errors.notes}
      />
      {errors.form ? (
        <span role="alert" className="font-body text-sm text-ink-negativo">{errors.form}</span>
      ) : null}
      <div>
        <Button type="submit" disabled={create.isPending}>
          {create.isPending ? 'Guardando…' : 'Registrar transacción'}
        </Button>
      </div>
    </form>
  );
}
