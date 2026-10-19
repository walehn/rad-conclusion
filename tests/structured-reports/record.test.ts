import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Swap the file-backed singleton for an in-memory database with the real
// migrations applied, so the test exercises the actual table definition.
vi.mock('@/lib/db', async () => {
  const { default: Database } = await import('better-sqlite3');
  const { drizzle } = await import('drizzle-orm/better-sqlite3');
  const { migrate } = await import('drizzle-orm/better-sqlite3/migrator');
  const schema = await import('@/lib/db/schema');
  const db = drizzle(new Database(':memory:'), { schema });
  migrate(db, { migrationsFolder: path.resolve(process.cwd(), 'drizzle') });
  return { db };
});

import { db } from '@/lib/db';
import { structuredReports, type NewStructuredReport } from '@/lib/db/schema';
import { hashReportPrompt, recordStructuredReport } from '@/lib/structured-reports/record';

const entry: NewStructuredReport = {
  userId: null,
  diseaseCategory: 'ProstateCancer',
  modality: 'MRI',
  lang: 'en',
  findings: 'PSA 7.2 ng/mL. Lesion 1: right PZ, T2W 4, DWI 4.',
  formState: '{"kind":"ProstateCancer"}',
  report: 'IMPRESSION: PI-RADS 4 lesion.',
  promptHash: 'abc123def456',
  provider: 'local',
  model: 'qwen',
  finishReason: 'stop',
  promptTokens: 100,
  completionTokens: 20,
  ttftMs: 150,
  totalMs: 900,
};

describe('recordStructuredReport', () => {
  beforeEach(() => {
    db.delete(structuredReports).run();
  });

  it('persists a finished report', () => {
    recordStructuredReport(entry);
    const rows = db.select().from(structuredReports).all();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ ...entry });
    expect(rows[0].createdAt).toBeInstanceOf(Date);
  });

  it('skips an empty report', () => {
    recordStructuredReport({ ...entry, report: '  \n ' });
    expect(db.select().from(structuredReports).all()).toHaveLength(0);
  });

  it('swallows write failures instead of throwing', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    // A NOT NULL violation makes the insert itself fail.
    expect(() =>
      recordStructuredReport({ ...entry, provider: null as unknown as string })
    ).not.toThrow();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe('hashReportPrompt', () => {
  it('is stable and 12 hex characters', () => {
    const a = hashReportPrompt('system', 'user');
    expect(a).toMatch(/^[0-9a-f]{12}$/);
    expect(hashReportPrompt('system', 'user')).toBe(a);
  });

  it('changes when text moves across the system/user boundary', () => {
    expect(hashReportPrompt('ab', 'c')).not.toBe(hashReportPrompt('a', 'bc'));
  });
});
