import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    include: ['apps/api/src/tests/**/*.integration.test.ts'],
    environment: 'node',
    testTimeout: 60000,
    hookTimeout: 180000,
    fileParallelism: false,
  },
  define: { 'process.env.NODE_ENV': JSON.stringify('test') },
});
