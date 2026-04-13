import { defineConfig } from 'vitest/config';

/**
 * Vitest configuration for Tenure.
 *
 * Why it exists: provides TypeScript-native test execution without a separate
 * compile step, with glob-based discovery for all test files.
 */
export default defineConfig({
  test: {
    globals: false,
    include: ['test/**/*.test.ts'],
    environment: 'node',
  },
});
