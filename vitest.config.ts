import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'api',
          include: ['apps/api/src/tests/**/*.unit.test.ts'],
          environment: 'node',
        },
      },
      { test: { name: 'web', include: ['apps/web/src/**/*.test.tsx'], environment: 'jsdom' } },
    ],
  },
});
