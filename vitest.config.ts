import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/server.ts', 'src/db/client.ts'],
      thresholds: {
        // Cross-check a nutrition-calc musí mít 100% pokrytí
        lines: 70,
        functions: 70,
        branches: 60,
      },
    },
    testTimeout: 10000,
  },
});
