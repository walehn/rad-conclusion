import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CookieStore } from '../../helpers/mock-next-cookies';

// ---------------------------------------------------------------------------
// Hoisted mock state. vi.mock factories run BEFORE top-level imports, so any
// module-level state they reference must be declared with vi.hoisted.
// ---------------------------------------------------------------------------

const { cookieStoreRef, testDbHandle } = vi.hoisted(() => ({
  cookieStoreRef: { current: null as CookieStore | null },
  testDbHandle: { db: null as unknown },
}));

vi.mock('@/lib/db', () => {
  const dbProxy = new Proxy(
    {},
    {
      get(_target, prop) {
        const target = testDbHandle.db as Record<PropertyKey, unknown> | null;
        if (!target) {
          throw new Error('test DB not initialized — call beforeEach setup first');
        }
        const v = target[prop];
        return typeof v === 'function'
          ? (v as (...a: unknown[]) => unknown).bind(target)
          : v;
      },
    }
  );
  return {
    db: dbProxy,
    runMigrations: vi.fn(),
  };
});

vi.mock('next/headers', () => ({
  cookies: async () => cookieStoreRef.current!.jar,
  headers: async () => new Headers(),
}));

// Spy on verifyPassword so we can assert timing-safe branches ran (EC-04)
// and that it is NOT called when rate-limited / csrf-blocked (AC-03, AC-06).
const verifySpy = vi.hoisted(() => vi.fn());
vi.mock('@/lib/auth/password', async () => {
  const actual = await vi.importActual<typeof import('@/lib/auth/password')>(
    '@/lib/auth/password'
  );
  return {
    ...actual,
    verifyPassword: (...args: Parameters<typeof actual.verifyPassword>) => {
      verifySpy(...args);
      return actual.verifyPassword(...args);
    },
  };
});

// Now safe to import helpers and modules that depend on '@/lib/db'.
import { createCookieStore } from '../../helpers/mock-next-cookies';
import { createTestDb } from '../../helpers/test-db';
cookieStoreRef.current = createCookieStore();
testDbHandle.db = createTestDb().db;

import { POST } from '@/app/api/auth/login/route';
import { users } from '@/lib/db/schema';
import { hashPassword } from '@/lib/auth/password';
import {
  resetAllForTesting,
  ipAttempts,
  emailAttempts,
  MAX_ATTEMPTS,
} from '@/lib/auth/rate-limit';
import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from '@/lib/auth/csrf';

// Accessor for the current test-scoped DB.
function tdb(): ReturnType<typeof createTestDb>['db'] {
  return testDbHandle.db as ReturnType<typeof createTestDb>['db'];
}

// Seed helper.
async function seedAlice(): Promise<{ email: string; password: string; hash: string }> {
  const email = 'alice@example.com';
  const password = 'CorrectHorseBatteryStaple!';
  const hash = await hashPassword(password);
  tdb()
    .insert(users)
    .values({
      email,
      passwordHash: hash,
      createdAt: new Date(),
    })
    .run();
  return { email, password, hash };
}

// Request factory for login POST.
function makeLoginRequest(
  body: unknown,
  opts: {
    csrf?: string | null;
    ip?: string;
    origin?: string | null;
    host?: string;
  } = {}
): Request {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    host: opts.host ?? 'localhost',
  };
  if (opts.origin !== null) headers.origin = opts.origin ?? 'http://localhost';
  if (opts.csrf !== null) headers[CSRF_HEADER_NAME] = opts.csrf ?? 'test-csrf-token';
  if (opts.ip !== undefined) headers['cf-connecting-ip'] = opts.ip;

  return new Request('http://localhost/api/auth/login', {
    method: 'POST',
    headers,
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

function setCsrfCookie(token = 'test-csrf-token'): void {
  cookieStoreRef.current!.jar.set({ name: CSRF_COOKIE_NAME, value: token });
}

describe('POST /api/auth/login', () => {
  beforeEach(() => {
    // Fresh DB per test
    testDbHandle.db = createTestDb().db;
    // Fresh cookie store per test
    cookieStoreRef.current = createCookieStore();
    // Reset rate limiters
    resetAllForTesting();
    // Reset spy
    verifySpy.mockClear();
  });

  afterEach(() => {
    resetAllForTesting();
  });

  // -------------------------------------------------------------------------
  // AC-01: Valid credentials -> 200, redirectTo, session cookie issued.
  // -------------------------------------------------------------------------
  it('AC-01: returns 200 with redirectTo and issues a session cookie on valid credentials', async () => {
    const { email, password } = await seedAlice();
    setCsrfCookie();

    const req = makeLoginRequest(
      { email, password, next: '/dashboard' },
      { ip: '1.2.3.4' }
    );
    const res = await POST(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true, redirectTo: '/dashboard' });

    // Session cookie was written to the mock jar.
    const sessionCookie = cookieStoreRef.current!.store.get('rad_conclusion_session');
    expect(sessionCookie).toBeDefined();
    expect(sessionCookie?.value.length ?? 0).toBeGreaterThan(0);

    // last_login_at was updated.
    const row = tdb().select().from(users).all()[0];
    expect(row.lastLoginAt).toBeInstanceOf(Date);

    // Rate-limit counters were cleared on success.
    expect(ipAttempts.get('1.2.3.4')).toBeUndefined();
    expect(emailAttempts.get(email)).toBeUndefined();
  });

  it('AC-01: falls back to "/" when next is missing', async () => {
    const { email, password } = await seedAlice();
    setCsrfCookie();
    const res = await POST(makeLoginRequest({ email, password }, { ip: '1.2.3.4' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.redirectTo).toBe('/');
  });

  // -------------------------------------------------------------------------
  // AC-02: Wrong password -> 401, counters incremented, no session cookie.
  // -------------------------------------------------------------------------
  it('AC-02: returns 401 on wrong password with a generic message, increments IP+email counters, issues no session', async () => {
    const { email } = await seedAlice();
    setCsrfCookie();

    const res = await POST(
      makeLoginRequest({ email, password: 'wrong' }, { ip: '9.9.9.9' })
    );

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('이메일 또는 비밀번호가 올바르지 않습니다');

    // No session cookie.
    expect(cookieStoreRef.current!.store.get('rad_conclusion_session')).toBeUndefined();

    // Counters incremented by 1 each.
    expect(ipAttempts.get('9.9.9.9')?.count).toBe(1);
    expect(emailAttempts.get(email)?.count).toBe(1);
  });

  // -------------------------------------------------------------------------
  // AC-03: Rate limit exceeded (6th IP attempt) -> 429, argon2 NOT called.
  // -------------------------------------------------------------------------
  it('AC-03: returns 429 with Retry-After on 6th attempt from same IP and does NOT call verifyPassword', async () => {
    const { email, password } = await seedAlice();
    setCsrfCookie();

    // Record 5 failures on the IP directly (simulating prior failed attempts).
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      ipAttempts.set('1.2.3.4', {
        count: ipAttempts.get('1.2.3.4')?.count ?? 0 + 0,
        firstAt: Date.now(),
      });
    }
    // Use the recordFailure helper instead to ensure proper state.
    ipAttempts.clear();
    const { recordFailure } = await import('@/lib/auth/rate-limit');
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      recordFailure('1.2.3.4', ipAttempts);
    }

    verifySpy.mockClear();
    const res = await POST(
      // Even with correct password the request must be blocked.
      makeLoginRequest({ email, password }, { ip: '1.2.3.4' })
    );

    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBeDefined();
    expect(Number(res.headers.get('Retry-After'))).toBeGreaterThan(0);

    // Must NOT have invoked argon2 verify (cost avoidance).
    expect(verifySpy).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // AC-06: Missing / mismatched CSRF -> 403, no verify, no counter bump.
  // -------------------------------------------------------------------------
  it('AC-06: returns 403 when x-csrf-token header is missing and does NOT call verifyPassword or bump counters', async () => {
    const { email, password } = await seedAlice();
    setCsrfCookie('correct-token');
    // No header on the request.
    const req = makeLoginRequest(
      { email, password },
      { csrf: null, ip: '5.5.5.5' }
    );
    verifySpy.mockClear();
    const res = await POST(req);

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/CSRF/i);

    expect(verifySpy).not.toHaveBeenCalled();
    expect(ipAttempts.get('5.5.5.5')).toBeUndefined();
    expect(emailAttempts.get(email)).toBeUndefined();
  });

  it('AC-06: returns 403 when x-csrf-token does not match cookie', async () => {
    const { email, password } = await seedAlice();
    setCsrfCookie('cookie-token');
    verifySpy.mockClear();
    const res = await POST(
      makeLoginRequest({ email, password }, { csrf: 'header-token', ip: '5.5.5.5' })
    );
    expect(res.status).toBe(403);
    expect(verifySpy).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // EC-01: Empty inputs -> 400.
  // -------------------------------------------------------------------------
  it('EC-01: returns 400 on empty email', async () => {
    setCsrfCookie();
    verifySpy.mockClear();
    const res = await POST(
      makeLoginRequest({ email: '', password: 'something' }, { ip: '1.1.1.1' })
    );
    expect(res.status).toBe(400);
    expect(verifySpy).not.toHaveBeenCalled();
  });

  it('EC-01: returns 400 on empty password', async () => {
    setCsrfCookie();
    const res = await POST(
      makeLoginRequest({ email: 'x@y.z', password: '' }, { ip: '1.1.1.1' })
    );
    expect(res.status).toBe(400);
  });

  it('EC-01: returns 400 on invalid JSON body', async () => {
    setCsrfCookie();
    const res = await POST(makeLoginRequest('not-json-{{{', { ip: '1.1.1.1' }));
    expect(res.status).toBe(400);
  });

  // -------------------------------------------------------------------------
  // EC-02: Overly long inputs -> 400.
  // -------------------------------------------------------------------------
  it('EC-02: returns 400 when email exceeds 254 chars', async () => {
    setCsrfCookie();
    const longEmail = 'a'.repeat(250) + '@example.com';
    const res = await POST(
      makeLoginRequest({ email: longEmail, password: 'whatever' }, { ip: '1.1.1.1' })
    );
    expect(res.status).toBe(400);
  });

  // -------------------------------------------------------------------------
  // EC-03: Email is normalized to lowercase+trim before lookup.
  // -------------------------------------------------------------------------
  it('EC-03: matches user when email is supplied with mixed case / whitespace', async () => {
    const { password } = await seedAlice();
    setCsrfCookie();
    const res = await POST(
      makeLoginRequest(
        { email: '  Alice@Example.COM  ', password },
        { ip: '1.2.3.4' }
      )
    );
    expect(res.status).toBe(200);
  });

  // -------------------------------------------------------------------------
  // EC-04: Unknown email -> 401 AND verifyPassword was still called (with DUMMY_HASH).
  // -------------------------------------------------------------------------
  it('EC-04: unknown email returns 401 but verifyPassword WAS called to prevent user enumeration', async () => {
    setCsrfCookie();
    verifySpy.mockClear();
    const res = await POST(
      makeLoginRequest(
        { email: 'ghost@example.com', password: 'any-password' },
        { ip: '1.1.1.1' }
      )
    );
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('이메일 또는 비밀번호가 올바르지 않습니다');
    // Crucial: verifyPassword was still invoked (with DUMMY_HASH) to flatten timing.
    expect(verifySpy).toHaveBeenCalledTimes(1);
    const [, hashUsed] = verifySpy.mock.calls[0];
    // Hash used should be the DUMMY_HASH since user doesn't exist.
    const { DUMMY_HASH } = await import('@/lib/auth/password');
    expect(hashUsed).toBe(DUMMY_HASH);
  });

  // -------------------------------------------------------------------------
  // EC-07: A corrupted session cookie does not break login.
  // -------------------------------------------------------------------------
  it('EC-07: corrupted session cookie still allows a fresh login', async () => {
    const { email, password } = await seedAlice();
    setCsrfCookie();
    // Plant a bogus session cookie.
    cookieStoreRef.current!.jar.set({
      name: 'rad_conclusion_session',
      value: 'garbage-ciphertext',
    });
    const res = await POST(makeLoginRequest({ email, password }, { ip: '1.2.3.4' }));
    expect(res.status).toBe(200);
  });

  // -------------------------------------------------------------------------
  // EC-08: IP rate limit applies independently of email rate limit.
  // -------------------------------------------------------------------------
  it('EC-08: email rate-limit exhausted blocks even when IP is fresh', async () => {
    const { email, password } = await seedAlice();
    setCsrfCookie();
    const { recordFailure } = await import('@/lib/auth/rate-limit');
    // Exhaust the EMAIL bucket.
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      recordFailure(email, emailAttempts);
    }
    verifySpy.mockClear();
    const res = await POST(
      makeLoginRequest({ email, password }, { ip: 'fresh-ip-99.99.99.99' })
    );
    expect(res.status).toBe(429);
    expect(verifySpy).not.toHaveBeenCalled();
  });

  it('EC-08: IP rate-limit exhausted blocks even with an untouched email', async () => {
    const { password } = await seedAlice();
    setCsrfCookie();
    const { recordFailure } = await import('@/lib/auth/rate-limit');
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      recordFailure('1.2.3.4', ipAttempts);
    }
    verifySpy.mockClear();
    const res = await POST(
      makeLoginRequest({ email: 'other@example.com', password }, { ip: '1.2.3.4' })
    );
    expect(res.status).toBe(429);
    expect(verifySpy).not.toHaveBeenCalled();
  });
});
