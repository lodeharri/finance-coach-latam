import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/infrastructure/llm/**'],
      thresholds: {
        'src/application/use-cases/**/*': {
          lines: 50,
          functions: 50,
          statements: 50,
          branches: 50,
        },
      },
    },
  },
});
