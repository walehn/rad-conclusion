import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
  // tsconfig sets jsx: "preserve" for Next's compiler, which leaves esbuild on
  // the classic runtime and makes any .tsx component without an explicit
  // `import React` throw "React is not defined" under test. Next itself uses
  // the automatic runtime, so pin it here to match production.
  esbuild: {
    jsx: 'automatic',
  },
  test: {
    environment: 'node',
    globals: false,
    pool: 'forks',
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['lib/auth/**', 'lib/db/**', 'app/api/auth/**', 'lib/crypto/**', 'lib/api-keys/**', 'app/api/user/**'],
      exclude: ['**/*.test.ts', '**/node_modules/**', '**/*.d.ts'],
      thresholds: {
        lines: 85,
        branches: 80,
        functions: 85,
        statements: 85,
      },
    },
  },
});
