import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Vitest must never collect Playwright browser suites.
export default defineConfig({
  plugins: [react()],
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    exclude: ['e2e/**', 'node_modules/**', 'dist/**'],
  },
});
