import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CookieStore } from '../helpers/mock-next-cookies';

// Admin account routes, with the real role lookup against an in-memory DB.

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
import { hashLinkToken } from '@/lib/auth/account-links';
import { GET as listAccounts } from '@/app/api/admin/accounts/route';
import { POST as createLink } from '@/app/api/admin/links/route';
import { DELETE as revokeLink } from '@/app/api/admin/links/[id]/route';
import { PATCH as patchUser } from '@/app/api/admin/users/[id]/route';

const ADMIN = 1;
const MEMBER = 2;

function req(url: string, method: string, body?: unknown, csrf = true): Request {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    host: 'localhost',
    origin: 'http://localhost',
  };
  if (csrf) headers[CSRF_HEADER_NAME] = 'test-csrf-token';
  return new Request(`http://localhost${url}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function signIn(userId: number): Promise<void> {
  cookieStoreRef.current = createCookieStore();
  await issueSession(userId, userId === ADMIN ? 'admin' : 'member');
  cookieStoreRef.current!.jar.set({ name: CSRF_COOKIE_NAME, value: 'test-csrf-token' });
}

const params = (id: number | string) => ({ params: Promise.resolve({ id: String(id) }) });

beforeEach(() => {
  db.delete(accountLinks).run();
  db.delete(users).run();
  db.insert(users)
    .values([
      { id: ADMIN, email: 'admin', passwordHash: 'x', role: 'admin' },
      { id: MEMBER, email: 'member', passwordHash: 'x', role: 'restricted' },
    ])
    .run();
});

describe('access', () => {
  it('restricted accounts get 403 from every admin route', async () => {
    await signIn(MEMBER);
    expect((await listAccounts()).status).toBe(403);
    expect((await createLink(req('/api/admin/links', 'POST', { kind: 'invite' }))).status).toBe(403);
    expect((await revokeLink(req('/api/admin/links/1', 'DELETE'), params(1))).status).toBe(403);
    expect((await patchUser(req(`/api/admin/users/${ADMIN}`, 'PATCH', { disabled: true }), params(ADMIN))).status).toBe(403);
    expect(db.select().from(accountLinks).all()).toHaveLength(0);
    expect(db.select().from(users).where(eq(users.id, ADMIN)).get()!.disabledAt).toBeNull();
  });

  it('requires a session', async () => {
    cookieStoreRef.current = createCookieStore();
    expect((await listAccounts()).status).toBe(401);
  });

  it('mutations require the CSRF token', async () => {
    await signIn(ADMIN);
    expect((await createLink(req('/api/admin/links', 'POST', { kind: 'invite' }, false))).status).toBe(403);
  });
});

describe('links', () => {
  it('returns an invite token once and lists it without secrets', async () => {
    await signIn(ADMIN);
    const res = await createLink(req('/api/admin/links', 'POST', { kind: 'invite', note: '  Dr. K  ' }));
    expect(res.status).toBe(201);
    const { token, id } = (await res.json()) as { token: string; id: number };
    expect(db.select().from(accountLinks).where(eq(accountLinks.id, id)).get()).toMatchObject({
      tokenHash: hashLinkToken(token),
      note: 'Dr. K',
      role: 'restricted',
      createdBy: ADMIN,
    });

    const list = await (await listAccounts()).json();
    expect(list.links).toEqual([
      expect.objectContaining({ id, kind: 'invite', status: 'pending', note: 'Dr. K', createdBy: 'admin' }),
    ]);
    const text = JSON.stringify(list);
    expect(text).not.toContain(token);
    expect(text).not.toContain(hashLinkToken(token));
    expect(text).not.toContain('passwordHash');
  });

  it('ignores a role sent with an invite (invites are restricted only)', async () => {
    await signIn(ADMIN);
    const res = await createLink(req('/api/admin/links', 'POST', { kind: 'invite', role: 'admin' }));
    const { id } = await res.json();
    expect(db.select().from(accountLinks).where(eq(accountLinks.id, id)).get()!.role).toBe('restricted');
  });

  it('creates reset links only for active accounts', async () => {
    await signIn(ADMIN);
    expect((await createLink(req('/api/admin/links', 'POST', { kind: 'reset', userId: MEMBER }))).status).toBe(201);
    expect((await createLink(req('/api/admin/links', 'POST', { kind: 'reset', userId: 99 }))).status).toBe(404);
    db.update(users).set({ disabledAt: new Date() }).where(eq(users.id, MEMBER)).run();
    expect((await createLink(req('/api/admin/links', 'POST', { kind: 'reset', userId: MEMBER }))).status).toBe(409);
  });

  it('revokes a pending link once', async () => {
    await signIn(ADMIN);
    const { id } = await (await createLink(req('/api/admin/links', 'POST', { kind: 'invite' }))).json();
    expect((await revokeLink(req(`/api/admin/links/${id}`, 'DELETE'), params(id))).status).toBe(204);
    expect((await revokeLink(req(`/api/admin/links/${id}`, 'DELETE'), params(id))).status).toBe(409);
    expect((await revokeLink(req('/api/admin/links/x', 'DELETE'), params('x'))).status).toBe(400);
  });
});

describe('suspension', () => {
  it('suspending ends the account sessions at once; reinstating restores access', async () => {
    await signIn(MEMBER);
    const memberCookies = cookieStoreRef.current;
    expect(await getAuthedUser()).not.toBeNull();

    await signIn(ADMIN);
    expect((await patchUser(req(`/api/admin/users/${MEMBER}`, 'PATCH', { disabled: true }), params(MEMBER))).status).toBe(200);
    cookieStoreRef.current = memberCookies;
    expect(await getAuthedUser()).toBeNull();

    await signIn(ADMIN);
    await patchUser(req(`/api/admin/users/${MEMBER}`, 'PATCH', { disabled: false }), params(MEMBER));
    cookieStoreRef.current = memberCookies;
    expect(await getAuthedUser()).toMatchObject({ userId: MEMBER, role: 'restricted' });
  });

  it('an admin cannot suspend their own account', async () => {
    await signIn(ADMIN);
    expect((await patchUser(req(`/api/admin/users/${ADMIN}`, 'PATCH', { disabled: true }), params(ADMIN))).status).toBe(409);
    expect(await getAuthedUser()).not.toBeNull();
  });

  it('404 for an unknown account', async () => {
    await signIn(ADMIN);
    expect((await patchUser(req('/api/admin/users/99', 'PATCH', { disabled: true }), params(99))).status).toBe(404);
  });
});
