import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// Vite config — SPA shell. Backend integration is HTTP via fetch in src/services/apiClient.ts.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    // Dev-only proxy so the SPA can call the local backend on `npm run dev`
    // without going through the production CORS allow-list. The Lambda-side
    // CORS middleware does NOT see this as a cross-origin request because
    // the browser addresses the Vite origin (same-origin to the SPA) and
    // Vite forwards `/api/*` to the backend. Production keeps going through
    // Cloudflare Pages → API Gateway and respects the configured allow-list.
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  build: {
    target: 'es2022',
    sourcemap: true,
  },
});
