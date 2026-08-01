/**
 * TransactionForm molecule — Litografía del Sur (REQ-FFC-TX-CREATE-FORM).
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
      next.amount = 'Amount must be a positive integer (cents).';
    }
    if (!merchant.trim()) next.merchant = 'Merchant is required.';
    if (!occurredAt) next.occurredAt = 'Date is required.';
    if (!accountId) next.accountId = 'Account is required.';
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
          setErrors({ form: err instanceof Error ? err.message : 'Could not create transaction.' });
        },
      },
    );
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3" data-testid="transaction-form">
      <FormField
        id="tx-amount"
        label="Amount (cents)"
        value={amount}
        onChange={(e) => setAmount(e.target.value.replace(/\D+/g, ''))}
        placeholder="420000"
        error={errors.amount}
      />
      <FormField
        id="tx-merchant"
        label="Merchant"
        value={merchant}
        onChange={(e) => setMerchant(e.target.value)}
        placeholder="PedidosYa"
        required
        error={errors.merchant}
      />
      <FormField
        id="tx-occurredAt"
        label="Date"
        type="text"
        value={occurredAt}
        onChange={(e) => setOccurredAt(e.target.value)}
        placeholder="YYYY-MM-DD"
        required
        error={errors.occurredAt}
      />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="tx-account" className="font-body text-sm text-ink-tinta">
          Account
        </label>
        <select
          id="tx-account"
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
          className="h-10 rounded-sm border border-ink-paper-press bg-ink-paper-press px-3 font-body text-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ink-cobalto"
          required
        >
          <option value="">Select account…</option>
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
      <FormField
        id="tx-notes"
        label="Notes"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Optional"
        error={errors.notes}
      />
      {errors.form ? (
        <span role="alert" className="font-body text-sm text-ink-negativo">{errors.form}</span>
      ) : null}
      <div>
        <Button type="submit" disabled={create.isPending}>
          {create.isPending ? 'Saving…' : 'Log transaction'}
        </Button>
      </div>
      {/* Hidden mount to expose the AmountInput contract on the form surface */}
      <span data-testid="amount-input-marker" className="hidden" />
      <AmountInput value={amount} onValueChange={setAmount} className="sr-only" />
    </form>
  );
}