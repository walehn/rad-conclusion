import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db', async () => {
  const { createTestDb } = await import('../helpers/test-db');
  return createTestDb();
});

import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { getUserRole } from '@/lib/auth/user-role';

beforeEach(() => {
  db.delete(users).run();
  db.insert(users)
    .values([
      { id: 1, email: 'admin', passwordHash: 'x', role: 'admin' },
      { id: 2, email: 'member', passwordHash: 'x', role: 'restricted' },
    ])
    .run();
});

describe('getUserRole', () => {
  it('returns the stored role', async () => {
    expect(await getUserRole(1, Date.now())).toBe('admin');
    expect(await getUserRole(2, Date.now())).toBe('restricted');
  });

  it('returns null for a missing or suspended account', async () => {
    expect(await getUserRole(99, Date.now())).toBeNull();
    db.update(users).set({ disabledAt: new Date() }).where(eq(users.id, 2)).run();
    expect(await getUserRole(2, Date.now())).toBeNull();
  });

  it('rejects sessions issued before the last password reset', async () => {
    const resetAt = new Date('2026-11-10T03:00:00Z');
    db.update(users).set({ sessionsValidAfter: resetAt }).where(eq(users.id, 2)).run();
    expect(await getUserRole(2, resetAt.getTime() - 1)).toBeNull();
    expect(await getUserRole(2, undefined)).toBeNull();
    expect(await getUserRole(2, resetAt.getTime())).toBe('restricted');
  });

  it('treats an unknown stored role as restricted', async () => {
    db.update(users).set({ role: 'superuser' as never }).where(eq(users.id, 1)).run();
    expect(await getUserRole(1, Date.now())).toBe('restricted');
  });
});
