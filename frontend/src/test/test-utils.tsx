/**
 * Centralized render wrapper. Later PRs will add QueryClientProvider, RouterProvider,
 * and the MSW server lifecycle hooks (PR2+). For PR1 we just re-export render + screen
 * so test files can import from a stable path.
 */
export { render, screen, act, fireEvent, waitFor } from '@testing-library/react';
export { default as userEvent } from '@testing-library/user-event';
