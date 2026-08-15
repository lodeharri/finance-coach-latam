/**
 * UserForm molecule — Litografía del Sur (REQ-FFC-USR-CREATE-ADMIN).
 *
 * Editorial treatment:
 * - Hairline-bottom inputs (variant="editorial").
 * - Email displayed in JetBrains Mono (signature element).
 */
import { useState } from 'react';
import { Button } from '@/atoms/Button';
import { FormField } from './FormField';
import { useCreateUser } from '@/hooks/useUsers';

export interface UserFormProps {
  apiBaseUrl: string;
  /**
   * Optional callback fired after a successful create. The modal flow uses
   * this to close the dialog, which unmounts the form and naturally resets
   * all field state for the next entry.
   */
  onCreated?: () => void;
}

export function UserForm({ apiBaseUrl, onCreated }: UserFormProps) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'admin' | 'user'>('user');
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);
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
    const tempPassword =
      Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2) + '!A1';
    create.mutate(
      { email: email.trim(), name: name.trim(), role, tempPassword },
      {
        onSuccess: () => {
          setGeneratedPassword(tempPassword);
        },
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
          htmlFor="usr-role"
          className="block font-mono text-xs uppercase tracking-[0.2em] text-ink-tinta-soft"
        >
          Rol
        </label>
        <select
          id="usr-role"
          value={role}
          onChange={(e) => setRole(e.target.value as 'admin' | 'user')}
          className="h-9 rounded-sm border border-ink-paper-press bg-ink-paper-lift px-3 font-mono text-xs uppercase tracking-[0.2em] focus:outline-none focus-visible:ring-2 focus-visible:ring-ink-cobalto focus-visible:ring-offset-2"
        >
          <option value="user">user</option>
          <option value="admin">admin</option>
        </select>
      </div>
      {generatedPassword ? (
        <div
          data-testid="user-generated-password"
          className="flex flex-col gap-1 rounded-sm border border-ink-cobalto/40 bg-ink-paper-lift p-3"
        >
          <span className="font-mono text-xs uppercase tracking-[0.2em] text-ink-tinta-soft">
            Contraseña temporal
          </span>
          <span className="select-all break-all font-mono text-sm">{generatedPassword}</span>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => onCreated?.()}
            data-testid="user-generated-password-close"
          >
            Listo
          </Button>
        </div>
      ) : null}
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
