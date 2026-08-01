/**
 * FormField molecule — Litografía del Sur.
 *
 * Composes Label + Input atoms and surfaces inline error verbatim beside the
 * offending field. Molecules have no API calls (REQ-FF-ATOMS-BOUNDARY).
 *
 * Editorial variant: hairline-bottom input + mono caps tracking-2em label,
 * the signature form treatment.
 *
 * Forwards HTML attributes that belong on the underlying input (required,
 * aria-required, aria-invalid, min, max, pattern, inputMode) so the form
 * contract is honored end-to-end. This fixes memory id 719.
 */
import type { ChangeEvent, InputHTMLAttributes } from 'react';
import { Label } from '../atoms/Label';
import { Input } from '../atoms/Input';

export type FormFieldVariant = 'default' | 'editorial';

export interface FormFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  type?: 'text' | 'email' | 'password';
  variant?: FormFieldVariant;
  required?: boolean;
  disabled?: boolean;
  /** Backend {message} or {details} string; rendered verbatim. */
  error?: string | undefined;
  placeholder?: string;
  autoComplete?: string;
  min?: InputHTMLAttributes<HTMLInputElement>['min'];
  max?: InputHTMLAttributes<HTMLInputElement>['max'];
  pattern?: InputHTMLAttributes<HTMLInputElement>['pattern'];
  inputMode?: InputHTMLAttributes<HTMLInputElement>['inputMode'];
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
  'aria-required'?: boolean;
}

export function FormField({
  id,
  label,
  value,
  onChange,
  type = 'text',
  variant = 'default',
  required = false,
  disabled = false,
  error,
  placeholder,
  autoComplete,
  min,
  max,
  pattern,
  inputMode,
  'aria-describedby': ariaDescribedBy,
  'aria-invalid': ariaInvalidProp,
  'aria-required': ariaRequired,
}: FormFieldProps) {
  const errorId = `${id}-error`;
  const invalid = Boolean(error);
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} required={required} variant={variant}>
        {label}
      </Label>
      <Input
        id={id}
        type={type}
        value={value}
        onChange={onChange}
        disabled={disabled}
        invalid={invalid}
        {...(invalid ? { describedById: errorId } : {})}
        placeholder={placeholder}
        autoComplete={autoComplete}
        variant={variant}
        required={required}
        aria-required={ariaRequired ?? (required ? true : undefined)}
        aria-invalid={ariaInvalidProp ?? (invalid ? true : undefined)}
        {...(min !== undefined ? { min } : {})}
        {...(max !== undefined ? { max } : {})}
        {...(pattern !== undefined ? { pattern } : {})}
        {...(inputMode !== undefined ? { inputMode } : {})}
        {...(ariaDescribedBy !== undefined ? { 'aria-describedby': ariaDescribedBy } : {})}
      />
      {error ? (
        <span id={errorId} role="alert" className="font-body text-sm text-ink-negativo">
          {error}
        </span>
      ) : null}
    </div>
  );
}
