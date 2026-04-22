// Global test setup. Runs BEFORE test files are evaluated, so any auth module
// imported from a test will see these env vars already in place. Keep this
// file tiny — per-file mocks go in individual test files.
(process.env as Record<string, string>).NODE_ENV = 'test';
// 64-char hex — meets the `SESSION_SECRET.length >= 32` guard in lib/auth/session.ts.
process.env.SESSION_SECRET =
  process.env.SESSION_SECRET ??
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
