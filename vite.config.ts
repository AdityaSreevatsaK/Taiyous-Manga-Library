import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// GitHub Pages serves project sites under /<repo>/, while Cloudflare uses /.
export default defineConfig(({ mode }) => ({
  base: mode === 'ghpages' ? '/Taiyous-Manga-Library/' : '/',
  plugins: [react()],
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    exclude: ['e2e/**', 'node_modules/**', 'dist/**'],
  },
}));
