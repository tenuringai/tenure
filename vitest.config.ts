import { defineConfig } from 'vitest/config';

/**
 * Vitest configuration for Tenure.
 *
 * Why it exists: provides TypeScript-native test execution without a separate
 * compile step, with glob-based discovery for all test files.
 *
 * router.test.ts uses raw process.exit() — it predates vitest and has its own
 * runner via `npm run test:router`. Excluded here to avoid false failures.
 */
export default defineConfig({
  test: {
    globals: false,
    include: ['test/**/*.test.ts'],
    exclude: ['test/router.test.ts'],
    environment: 'node',
  },
});
