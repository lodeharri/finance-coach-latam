/**
 * LogoutButton atom — Litografía del Sur (REQ-FFC-FE-LOGOUT).
 *
 * Native <button type="button">. Calls sessionStore.clear() then navigates to
 * /login. Cobalt focus ring (visible focus); prefers-reduced-motion honored
 * via the motion tokens.
 *
 * Active voice copy: "Sign out" — NOT "Logout". The label reads as an
 * imperative the user controls, not jargon.
 */
import { useNavigate } from 'react-router-dom';
import { sessionStore } from '@/stores/sessionStore';

const BASE_CLASSES =
  'inline-flex items-center justify-center h-10 px-4 rounded font-body font-medium ' +
  'bg-ink-paper-press text-ink-tinta hover:bg-ink-paper-lift ' +
  'transition-[background-color] duration-fast ' +
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-ink-cobalto ' +
  'focus-visible:ring-offset-2 focus-visible:ring-offset-ink-paper';

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
      aria-label="Sign out of your account"
    >
      Sign out
    </button>
  );
}