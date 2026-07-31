import '@testing-library/jest-dom/vitest';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { cleanup } from '@testing-library/react';
import { setupServer } from 'msw/node';

/**
 * MSW server boot — registered in setup.ts so it is available to every test
 * file without per-file boilerplate. Atoms and molecules do NOT touch the
 * network (REQ-FF-ATOMS-BOUNDARY); MSW exists so future organism / hook /
 * service tests (PR3+) can intercept fetch calls without extra wiring.
 *
 * Add per-test handlers via `server.use(...)` inside the test body; global
 * defaults (no handlers) let unmatched requests fail loudly during dev.
 */
export const server = setupServer();

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });
});

afterEach(() => {
  cleanup();
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});
