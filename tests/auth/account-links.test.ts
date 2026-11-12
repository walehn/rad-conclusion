import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db', async () => {
  const { createTestDb } = await import('../helpers/test-db');
  return createTestDb();
});

import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { accountLinks, users } from '@/lib/db/schema';
import {
  checkLink,
  createInvite,
  createResetLink,
  hashLinkToken,
  inspectLink,
  LINK_TTL_MS,
  linkStatus,
  redeemInvite,
  redeemReset,
  revokeLink,
} from '@/lib/auth/account-links';

const T0 = new Date('2026-11-10T00:00:00Z');
const ADMIN = 1;
const MEMBER = 2;

beforeEach(() => {
  db.delete(accountLinks).run();
  db.delete(users).run();
  db.insert(users)
    .values([
      { id: ADMIN, email: 'admin', passwordHash: 'old-admin', role: 'admin' },
      { id: MEMBER, email: 'member', passwordHash: 'old-member', role: 'restricted' },
    ])
    .run();
});

const linkRow = (id: number) => db.select().from(accountLinks).where(eq(accountLinks.id, id)).get()!;
const userRow = (email: string) => db.select().from(users).where(eq(users.email, email)).get();

describe('tokens', () => {
  it('stores only the sha256 of the token', () => {
    const { id, token } = createInvite({ createdBy: ADMIN, note: 'for X', now: T0 });
    const row = linkRow(id);
    expect(row.tokenHash).toBe(createHash('sha256').update(token).digest('hex'));
    expect(Object.values(row)).not.toContain(token);
    expect(token.length).toBeGreaterThanOrEqual(43); // 32 random bytes
  });

  it('expires 48 hours after creation', () => {
    const { expiresAt } = createInvite({ createdBy: ADMIN, note: null, now: T0 });
    expect(expiresAt.getTime() - T0.getTime()).toBe(LINK_TTL_MS);
    expect(LINK_TTL_MS).toBe(48 * 3600 * 1000);
  });
});

describe('invites', () => {
  it('describes a pending invite and nothing else', () => {
    const { token } = createInvite({ createdBy: ADMIN, note: null, now: T0 });
    expect(inspectLink(token, T0)).toMatchObject({ kind: 'invite', username: null });
    expect(inspectLink('not-a-token', T0)).toBeNull();
    expect(inspectLink(token, new Date(T0.getTime() + LINK_TTL_MS))).toBeNull();
  });

  it('creates a restricted account once and records who used it', () => {
    const { id, token } = createInvite({ createdBy: ADMIN, note: null, now: T0 });
    const result = redeemInvite({ token, username: 'newbie', passwordHash: 'h', now: T0 });
    expect(result).toMatchObject({ ok: true, username: 'newbie' });
    expect(userRow('newbie')).toMatchObject({ role: 'restricted', passwordHash: 'h' });
    expect(linkRow(id)).toMatchObject({ usedByUserId: userRow('newbie')!.id });
    expect(linkStatus(linkRow(id), T0)).toBe('used');

    expect(redeemInvite({ token, username: 'second', passwordHash: 'h', now: T0 })).toEqual({
      ok: false,
      reason: 'invalid',
    });
    expect(userRow('second')).toBeUndefined();
  });

  it('refuses a taken username without using up the invite', () => {
    const { id, token } = createInvite({ createdBy: ADMIN, note: null, now: T0 });
    expect(redeemInvite({ token, username: 'member', passwordHash: 'h', now: T0 })).toEqual({
      ok: false,
      reason: 'taken',
    });
    expect(linkStatus(linkRow(id), T0)).toBe('pending');
    expect(userRow('member')!.passwordHash).toBe('old-member');
  });

  it('refuses an expired or revoked invite', () => {
    const expired = createInvite({ createdBy: ADMIN, note: null, now: T0 });
    const later = new Date(T0.getTime() + LINK_TTL_MS + 1);
    expect(redeemInvite({ token: expired.token, username: 'a', passwordHash: 'h', now: later }).ok).toBe(false);

    const revoked = createInvite({ createdBy: ADMIN, note: null, now: T0 });
    expect(revokeLink(revoked.id, T0)).toBe(true);
    expect(revokeLink(revoked.id, T0)).toBe(false);
    expect(redeemInvite({ token: revoked.token, username: 'b', passwordHash: 'h', now: T0 }).ok).toBe(false);
    expect(userRow('a')).toBeUndefined();
    expect(userRow('b')).toBeUndefined();
  });

  it('cannot revoke a used invite', () => {
    const { id, token } = createInvite({ createdBy: ADMIN, note: null, now: T0 });
    redeemInvite({ token, username: 'c', passwordHash: 'h', now: T0 });
    expect(revokeLink(id, T0)).toBe(false);
  });
});

describe('password resets', () => {
  it('sets the new password, ends old sessions, and works once', () => {
    const r = createResetLink({ createdBy: ADMIN, userId: MEMBER, now: T0 });
    if (!r.ok) throw new Error('expected a link');
    expect(inspectLink(r.token, T0)).toMatchObject({ kind: 'reset', username: 'member' });

    expect(redeemReset({ token: r.token, passwordHash: 'new', now: T0 })).toMatchObject({ ok: true });
    const member = userRow('member')!;
    expect(member.passwordHash).toBe('new');
    expect(member.sessionsValidAfter?.getTime()).toBe(T0.getTime());

    expect(redeemReset({ token: r.token, passwordHash: 'again', now: T0 }).ok).toBe(false);
    expect(userRow('member')!.passwordHash).toBe('new');
  });

  it('keeps only the newest reset link per account', () => {
    const first = createResetLink({ createdBy: ADMIN, userId: MEMBER, now: T0 });
    const second = createResetLink({ createdBy: ADMIN, userId: MEMBER, now: T0 });
    if (!first.ok || !second.ok) throw new Error('expected links');
    expect(linkStatus(linkRow(first.id), T0)).toBe('revoked');
    expect(inspectLink(first.token, T0)).toBeNull();
    expect(inspectLink(second.token, T0)).not.toBeNull();
  });

  it('refuses suspended or missing accounts', () => {
    expect(createResetLink({ createdBy: ADMIN, userId: 99, now: T0 })).toEqual({ ok: false, reason: 'no-account' });

    const r = createResetLink({ createdBy: ADMIN, userId: MEMBER, now: T0 });
    if (!r.ok) throw new Error('expected a link');
    db.update(users).set({ disabledAt: T0 }).where(eq(users.id, MEMBER)).run();
    expect(inspectLink(r.token, T0)).toBeNull();
    expect(redeemReset({ token: r.token, passwordHash: 'new', now: T0 }).ok).toBe(false);
    expect(userRow('member')!.passwordHash).toBe('old-member');
    expect(createResetLink({ createdBy: ADMIN, userId: MEMBER, now: T0 })).toEqual({ ok: false, reason: 'disabled' });
  });

  it('a reset token cannot be redeemed as an invite', () => {
    const r = createResetLink({ createdBy: ADMIN, userId: MEMBER, now: T0 });
    if (!r.ok) throw new Error('expected a link');
    expect(redeemInvite({ token: r.token, username: 'sneaky', passwordHash: 'h', now: T0 }).ok).toBe(false);
    expect(userRow('sneaky')).toBeUndefined();
  });

  it('hashLinkToken is deterministic', () => {
    expect(hashLinkToken('abc')).toBe(hashLinkToken('abc'));
    expect(hashLinkToken('abc')).not.toBe(hashLinkToken('abd'));
  });
});

describe('checkLink: why a link cannot be used', () => {
  const later = new Date(T0.getTime() + LINK_TTL_MS + 1);

  it('says invalid, and nothing about kind, for an unknown token', () => {
    expect(checkLink('not-a-token', T0)).toEqual({ ok: false, reason: 'invalid', kind: null });
  });

  it('returns the same description as inspectLink for a usable link', () => {
    const { token } = createInvite({ createdBy: ADMIN, note: null, now: T0 });
    expect(checkLink(token, T0)).toEqual({ ok: true, info: inspectLink(token, T0) });
  });

  it('tells used, expired and revoked invites apart', () => {
    const used = createInvite({ createdBy: ADMIN, note: null, now: T0 });
    redeemInvite({ token: used.token, username: 'first', passwordHash: 'h', now: T0 });
    expect(checkLink(used.token, T0)).toEqual({ ok: false, reason: 'used', kind: 'invite' });

    const expired = createInvite({ createdBy: ADMIN, note: null, now: T0 });
    expect(checkLink(expired.token, later)).toEqual({ ok: false, reason: 'expired', kind: 'invite' });

    const revoked = createInvite({ createdBy: ADMIN, note: null, now: T0 });
    revokeLink(revoked.id, T0);
    expect(checkLink(revoked.token, T0)).toEqual({ ok: false, reason: 'revoked', kind: 'invite' });
  });

  it('reports a used link as used even after its 48 hours are over', () => {
    const { token } = createInvite({ createdBy: ADMIN, note: null, now: T0 });
    redeemInvite({ token, username: 'first', passwordHash: 'h', now: T0 });
    expect(checkLink(token, later)).toMatchObject({ reason: 'used' });
  });

  it('covers reset links: used, replaced by a newer one, or for a suspended account', () => {
    const used = createResetLink({ createdBy: ADMIN, userId: MEMBER, now: T0 });
    if (!used.ok) throw new Error('expected a link');
    redeemReset({ token: used.token, passwordHash: 'new', now: T0 });
    expect(checkLink(used.token, T0)).toEqual({ ok: false, reason: 'used', kind: 'reset' });

    const replaced = createResetLink({ createdBy: ADMIN, userId: MEMBER, now: T0 });
    const newest = createResetLink({ createdBy: ADMIN, userId: MEMBER, now: T0 });
    if (!replaced.ok || !newest.ok) throw new Error('expected links');
    expect(checkLink(replaced.token, T0)).toEqual({ ok: false, reason: 'revoked', kind: 'reset' });

    db.update(users).set({ disabledAt: T0 }).where(eq(users.id, MEMBER)).run();
    expect(checkLink(newest.token, T0)).toEqual({ ok: false, reason: 'invalid', kind: 'reset' });
  });
});
