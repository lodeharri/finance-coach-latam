/**
 * FormField molecule — Litografía del Sur.
 *
 * Composes Label + Input atoms and surfaces inline error verbatim beside the
 * offending field. Molecules have no API calls (REQ-FF-ATOMS-BOUNDARY).
 */
import type { ChangeEvent } from 'react';
import { Label } from '../atoms/Label';
import { Input } from '../atoms/Input';

export interface FormFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  type?: 'text' | 'email' | 'password';
  required?: boolean;
  disabled?: boolean;
  /** Backend {message} or {details} string; rendered verbatim. */
  error?: string;
  placeholder?: string;
  autoComplete?: string;
}

export function FormField({
  id,
  label,
  value,
  onChange,
  type = 'text',
  required = false,
  disabled = false,
  error,
  placeholder,
  autoComplete,
}: FormFieldProps) {
  const errorId = `${id}-error`;
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} required={required}>
        {label}
      </Label>
      <Input
        id={id}
        type={type}
        value={value}
        onChange={onChange}
        disabled={disabled}
        invalid={Boolean(error)}
        {...(error ? { describedById: errorId } : {})}
        placeholder={placeholder}
        autoComplete={autoComplete}
      />
      {error ? (
        <span id={errorId} role="alert" className="font-body text-sm text-ink-negativo">
          {error}
        </span>
      ) : null}
    </div>
  );
}
