import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CookieStore } from '../../helpers/mock-next-cookies';

const { cookieStoreRef } = vi.hoisted(() => ({
  cookieStoreRef: { current: null as CookieStore | null },
}));

vi.mock('next/headers', () => ({
  cookies: async () => cookieStoreRef.current!.jar,
  headers: async () => new Headers(),
}));

import { createCookieStore } from '../../helpers/mock-next-cookies';
cookieStoreRef.current = createCookieStore();

import { POST } from '@/app/api/auth/logout/route';
import { issueSession, getCurrentUser } from '@/lib/auth/session';
import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from '@/lib/auth/csrf';

function makeLogoutRequest(opts: { csrf?: string | null } = {}): Request {
  const headers: Record<string, string> = {
    host: 'localhost',
    origin: 'http://localhost',
  };
  if (opts.csrf !== null) headers[CSRF_HEADER_NAME] = opts.csrf ?? 'test-csrf-token';
  return new Request('http://localhost/api/auth/logout', {
    method: 'POST',
    headers,
  });
}

function setCsrfCookie(token = 'test-csrf-token'): void {
  cookieStoreRef.current!.jar.set({ name: CSRF_COOKIE_NAME, value: token });
}

describe('POST /api/auth/logout', () => {
  beforeEach(() => {
    cookieStoreRef.current = createCookieStore();
  });

  it('AC-05: returns 200 and clears the session cookie with valid CSRF', async () => {
    // Establish a session first.
    await issueSession(1, 'alice@example.com');
    expect(await getCurrentUser()).not.toBeNull();

    // Also plant the CSRF cookie.
    setCsrfCookie();

    const res = await POST(makeLogoutRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true });

    // Session should now be gone.
    expect(await getCurrentUser()).toBeNull();
  });

  it('returns 403 when CSRF header is missing', async () => {
    await issueSession(1, 'alice@example.com');
    const res = await POST(makeLogoutRequest({ csrf: null }));
    expect(res.status).toBe(403);
    // Session should still exist since we never reached destroySession.
    expect(await getCurrentUser()).not.toBeNull();
  });

  it('is idempotent: returns 200 when called with valid CSRF but no active session', async () => {
    setCsrfCookie();
    expect(await getCurrentUser()).toBeNull();
    const res = await POST(makeLogoutRequest());
    expect(res.status).toBe(200);
  });
});
