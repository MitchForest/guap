import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      { extends: './apps/backend/vitest.config.ts', test: { root: './apps/backend' } },
      { extends: './apps/frontend/vitest.config.ts', test: { root: './apps/frontend' } },
      { extends: './packages/api/vitest.config.ts', test: { root: './packages/api' } },
      { extends: './packages/types/vitest.config.ts', test: { root: './packages/types' } },
      { extends: './packages/providers/vitest.config.ts', test: { root: './packages/providers' } },
    ],
  },
});
