/**
 * LogoutButton atom — Litografía del Sur (REQ-FFC-FE-LOGOUT).
 *
 * Native <button type="button">. Calls sessionStore.clear() then navigates to
 * /login. Cobalt focus ring (visible focus); prefers-reduced-motion honored
 * via the motion tokens.
 *
 * Editorial: mono caps tracking-2em on the masthead, paper-press background.
 * Active voice copy: "Cerrar sesión" — an imperative the user controls, not
 * jargon.
 */
import { useNavigate } from 'react-router-dom';
import { sessionStore } from '@/stores/sessionStore';

const BASE_CLASSES =
  'inline-flex items-center justify-center h-9 px-3 font-mono text-xs uppercase tracking-[0.2em] ' +
  'bg-ink-paper-press text-ink-tinta hover:bg-ink-paper-lift ' +
  'transition-[background-color] duration-fast ' +
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-ink-cobalto ' +
  'focus-visible:ring-offset-2 focus-visible:ring-offset-ink-cobalto';

export function LogoutButton({ className = '' }: { className?: string }) {
  const navigate = useNavigate();
  const handleClick = () => {
    sessionStore.getState().clear();
    navigate('/login');
  };
  return (
    <button
      type="button"
      onClick={handleClick}
      className={`${BASE_CLASSES} ${className}`.trim()}
      aria-label="Cerrar sesión de tu cuenta"
    >
      Cerrar sesión
    </button>
  );
}
