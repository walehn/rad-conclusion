import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CookieStore } from '../helpers/mock-next-cookies';

// Public invite / reset routes: no session, the link token is the credential.

const { cookieStoreRef } = vi.hoisted(() => ({
  cookieStoreRef: { current: null as CookieStore | null },
}));

vi.mock('next/headers', () => ({
  cookies: async () => cookieStoreRef.current!.jar,
  headers: async () => new Headers(),
}));

vi.mock('@/lib/db', async () => {
  const { createTestDb } = await import('../helpers/test-db');
  return createTestDb();
});

import { createCookieStore } from '../helpers/mock-next-cookies';
cookieStoreRef.current = createCookieStore();

import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { accountLinks, users } from '@/lib/db/schema';
import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from '@/lib/auth/csrf';
import { issueSession } from '@/lib/auth/session';
import { getAuthedUser } from '@/lib/auth/guard';
import { hashPassword, verifyPassword } from '@/lib/auth/password';
import { createInvite, createResetLink, LINK_TTL_MS, revokeLink } from '@/lib/auth/account-links';
import { INVALID_LINK_ERROR } from '@/lib/auth/link-request';
import { MAX_ATTEMPTS, resetAllForTesting } from '@/lib/auth/rate-limit';
import { POST as inspect } from '@/app/api/account-links/inspect/route';
import { POST as redeem } from '@/app/api/account-links/redeem/route';
import { POST as login } from '@/app/api/auth/login/route';
import { POST as changePassword } from '@/app/api/auth/change-password/route';

const ADMIN = 1;
const MEMBER = 2;
const NEW_PASSWORD = 'brand-new-pass-1';

function req(path: string, body: unknown, opts: { csrf?: boolean; ip?: string } = {}): Request {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    host: 'localhost',
    origin: 'http://localhost',
    'cf-connecting-ip': opts.ip ?? '10.0.0.1',
  };
  if (opts.csrf !== false) headers[CSRF_HEADER_NAME] = 'test-csrf-token';
  return new Request(`http://localhost${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
}

function freshCookies(): void {
  cookieStoreRef.current = createCookieStore();
  cookieStoreRef.current!.jar.set({ name: CSRF_COOKIE_NAME, value: 'test-csrf-token' });
}

beforeEach(async () => {
  resetAllForTesting();
  freshCookies();
  db.delete(accountLinks).run();
  db.delete(users).run();
  db.insert(users)
    .values([
      { id: ADMIN, email: 'admin', passwordHash: 'x', role: 'admin' },
      { id: MEMBER, email: 'member', passwordHash: await hashPassword('old-password-1'), role: 'restricted' },
    ])
    .run();
});

describe('POST /api/account-links/inspect', () => {
  it('describes a valid invite', async () => {
    const { token } = createInvite({ createdBy: ADMIN, note: null });
    const res = await inspect(req('/api/account-links/inspect', { token }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ kind: 'invite', username: null });
  });

  it('answers 404 for an unknown token and throttles guessing per IP', async () => {
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      expect((await inspect(req('/api/account-links/inspect', { token: `guess-${i}` }))).status).toBe(404);
    }
    const { token } = createInvite({ createdBy: ADMIN, note: null });
    expect((await inspect(req('/api/account-links/inspect', { token }))).status).toBe(429);
    expect((await inspect(req('/api/account-links/inspect', { token }, { ip: '10.0.0.2' }))).status).toBe(200);
  });

  it('requires the CSRF token', async () => {
    const { token } = createInvite({ createdBy: ADMIN, note: null });
    expect((await inspect(req('/api/account-links/inspect', { token }, { csrf: false }))).status).toBe(403);
  });
});

describe('POST /api/account-links/redeem (invite)', () => {
  it('creates a restricted account that can sign in, and the link works once', async () => {
    const { token } = createInvite({ createdBy: ADMIN, note: null });
    const res = await redeem(req('/api/account-links/redeem', { token, username: '  NewDoc ', password: NEW_PASSWORD }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, kind: 'invite', username: 'newdoc' });
    expect(db.select().from(users).where(eq(users.email, 'newdoc')).get()).toMatchObject({ role: 'restricted' });

    const signIn = await login(req('/api/auth/login', { email: 'newdoc', password: NEW_PASSWORD }));
    expect(signIn.status).toBe(200);
    expect(await getAuthedUser()).toMatchObject({ role: 'restricted' });

    const again = await redeem(req('/api/account-links/redeem', { token, username: 'other', password: NEW_PASSWORD }));
    expect(again.status).toBe(404);
  });

  it('rejects a short password, a bad username and a taken username without using the link', async () => {
    const { token } = createInvite({ createdBy: ADMIN, note: null });
    expect((await redeem(req('/api/account-links/redeem', { token, username: 'ok', password: 'short' }))).status).toBe(400);
    expect((await redeem(req('/api/account-links/redeem', { token, username: 'has space', password: NEW_PASSWORD }))).status).toBe(400);
    expect((await redeem(req('/api/account-links/redeem', { token, username: 'member', password: NEW_PASSWORD }))).status).toBe(409);
    expect((await redeem(req('/api/account-links/redeem', { token, username: 'fine', password: NEW_PASSWORD }))).status).toBe(200);
  });
});

describe('POST /api/account-links/redeem (reset)', () => {
  it('sets the new password and signs out existing sessions', async () => {
    await issueSession(MEMBER, 'member');
    const oldSession = cookieStoreRef.current;
    expect(await getAuthedUser()).not.toBeNull();

    const link = createResetLink({ createdBy: ADMIN, userId: MEMBER });
    if (!link.ok) throw new Error('expected a link');
    await new Promise((r) => setTimeout(r, 5)); // the reset instant must be after the old session
    freshCookies();
    const res = await redeem(req('/api/account-links/redeem', { token: link.token, password: NEW_PASSWORD }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ kind: 'reset', username: 'member' });

    cookieStoreRef.current = oldSession;
    expect(await getAuthedUser()).toBeNull();

    freshCookies();
    expect((await login(req('/api/auth/login', { email: 'member', password: 'old-password-1' }))).status).toBe(401);
    expect((await login(req('/api/auth/login', { email: 'member', password: NEW_PASSWORD }, { ip: '10.0.0.9' }))).status).toBe(200);
  });
});

describe('suspended accounts and password changes', () => {
  it('a suspended account cannot sign in and gets the generic error', async () => {
    db.update(users).set({ disabledAt: new Date() }).where(eq(users.id, MEMBER)).run();
    const res = await login(req('/api/auth/login', { email: 'member', password: 'old-password-1' }));
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe('아이디 또는 비밀번호가 올바르지 않습니다');
  });

  it('changing the password keeps this browser signed in and ends older sessions', async () => {
    await issueSession(MEMBER, 'member');
    const otherDevice = cookieStoreRef.current;
    await new Promise((r) => setTimeout(r, 5));

    freshCookies();
    await issueSession(MEMBER, 'member');
    const res = await changePassword(
      req('/api/auth/change-password', { currentPassword: 'old-password-1', newPassword: NEW_PASSWORD })
    );
    expect(res.status).toBe(200);
    expect(await getAuthedUser()).toMatchObject({ userId: MEMBER });
    const stored = db.select().from(users).where(eq(users.id, MEMBER)).get()!;
    expect(await verifyPassword(NEW_PASSWORD, stored.passwordHash)).toBe(true);

    cookieStoreRef.current = otherDevice;
    expect(await getAuthedUser()).toBeNull();
  });
});

describe('a link that cannot be used says why', () => {
  async function inspectBody(token: string) {
    const res = await inspect(req('/api/account-links/inspect', { token }));
    return { status: res.status, body: (await res.json()) as { error: string; reason: string } };
  }

  it('used invite: points the person to the login page', async () => {
    const { token } = createInvite({ createdBy: ADMIN, note: null });
    expect((await redeem(req('/api/account-links/redeem', { token, username: 'first', password: NEW_PASSWORD }))).status).toBe(200);

    const { status, body } = await inspectBody(token);
    expect(status).toBe(404);
    expect(body.reason).toBe('used');
    expect(body.error).toContain('이미 가입에 사용된 링크입니다');
    expect(body.error).toContain('로그인');

    const again = await redeem(req('/api/account-links/redeem', { token, username: 'second', password: NEW_PASSWORD }));
    expect(again.status).toBe(404);
    expect(await again.json()).toMatchObject({ reason: 'used' });
    expect(db.select().from(users).where(eq(users.email, 'second')).get()).toBeUndefined();
  });

  it('used reset link: says the password was already set', async () => {
    const link = createResetLink({ createdBy: ADMIN, userId: MEMBER });
    if (!link.ok) throw new Error('expected a link');
    expect((await redeem(req('/api/account-links/redeem', { token: link.token, password: NEW_PASSWORD }))).status).toBe(200);
    const { body } = await inspectBody(link.token);
    expect(body).toMatchObject({ reason: 'used' });
    expect(body.error).toContain('이미 사용된 비밀번호 재설정 링크입니다');
  });

  it('expired and revoked links ask for a new link', async () => {
    const expired = createInvite({ createdBy: ADMIN, note: null, now: new Date(Date.now() - LINK_TTL_MS - 1000) });
    const e = await inspectBody(expired.token);
    expect(e.body.reason).toBe('expired');
    expect(e.body.error).toContain('기한(48시간)이 지난 링크입니다');

    const revoked = createInvite({ createdBy: ADMIN, note: null });
    revokeLink(revoked.id);
    const r = await inspectBody(revoked.token);
    expect(r.body.reason).toBe('revoked');
    expect(r.body.error).toContain('취소된 링크입니다');
  });

  it('an unknown token keeps the generic answer', async () => {
    const { status, body } = await inspectBody('no-such-token');
    expect(status).toBe(404);
    expect(body).toEqual({ error: INVALID_LINK_ERROR, reason: 'invalid' });
  });

  it('still counts toward the per-IP limit, as before', async () => {
    const { token } = createInvite({ createdBy: ADMIN, note: null });
    const revoked = createInvite({ createdBy: ADMIN, note: null });
    revokeLink(revoked.id);
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      expect((await inspect(req('/api/account-links/inspect', { token: revoked.token }))).status).toBe(404);
    }
    expect((await inspect(req('/api/account-links/inspect', { token }))).status).toBe(429);
  });
});
