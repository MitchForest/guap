import { defineConfig } from 'vitest/config';
import solidPlugin from 'vite-plugin-solid';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [solidPlugin({ ssr: false }), tailwindcss()],
  resolve: {
    conditions: ['development', 'browser'],
    alias: {
      '~': fileURLToPath(new URL('./src', import.meta.url)),
      'solid-js/web': 'solid-js/web/dist/web.js',
    },
  },
  define: {
    'process.env.SSR': 'false',
  },
  test: {
    environment: 'jsdom',
    include: ['src/__tests__/**/*.test.{ts,tsx}'],
    setupFiles: ['./src/__tests__/setup.ts'],
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
    },
  },
});
