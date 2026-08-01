import type { Config } from 'tailwindcss';

/**
 * Tailwind theme — every color/font/spacing token maps to a CSS variable
 * defined in src/styles/tokens.css. Never hard-code hex values here.
 */
const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          paper: 'var(--ink-paper)',
          'paper-lift': 'var(--ink-paper-lift)',
          'paper-press': 'var(--ink-paper-press)',
          'paper-grain': 'var(--ink-paper-grain)',
          hairline: 'var(--ink-hairline)',
          tinta: 'var(--ink-tinta)',
          'tinta-soft': 'var(--ink-tinta-soft)',
          'tinta-mute': 'var(--ink-tinta-mute)',
          cobalto: 'var(--ink-cobalto)',
          'cobalto-deep': 'var(--ink-cobalto-deep)',
          positivo: 'var(--ink-positivo)',
          negativo: 'var(--ink-negativo)',
          fallo: 'var(--ink-fallo)',
          alerta: 'var(--ink-alerta)',
        },
      },
      fontFamily: {
        display: ['"Bricolage Grotesque"', 'Public Sans', 'system-ui', 'sans-serif'],
        body: ['"Public Sans"', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      transitionDuration: {
        fast: '120ms',
        entrance: '240ms',
      },
      transitionTimingFunction: {
        entrance: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
      },
      borderRadius: {
        none: '0',
        sm: '2px',
        DEFAULT: '4px',
      },
      fontSize: {
        xs: 'var(--text-xs)',
        sm: 'var(--text-sm)',
        md: 'var(--text-md)',
        lg: 'var(--text-lg)',
        xl: 'var(--text-xl)',
        '2xl': 'var(--text-2xl)',
        '3xl': 'var(--text-3xl)',
        '4xl': ['var(--text-4xl)', { lineHeight: '0.95', letterSpacing: '-0.02em' }],
      },
    },
  },
  plugins: [],
};

export default config;
