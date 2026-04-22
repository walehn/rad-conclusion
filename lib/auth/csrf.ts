import { randomBytes, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

/** Cookie name that carries the double-submit CSRF token (non-httpOnly so the client can echo it). */
export const CSRF_COOKIE_NAME = 'csrf_token';
/** Header name the client uses to echo the CSRF token on state-changing requests. */
export const CSRF_HEADER_NAME = 'x-csrf-token';

/** Generates a 32-byte hex CSRF token. */
export function generateCsrfToken(): string {
  return randomBytes(32).toString('hex');
}

/** Issues a fresh CSRF cookie and returns the token value (for embedding into forms). */
export async function issueCsrfCookie(): Promise<string> {
  const token = generateCsrfToken();
  const jar = await cookies();
  jar.set({
    name: CSRF_COOKIE_NAME,
    value: token,
    httpOnly: false,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  });
  return token;
}

/**
 * Verifies that the CSRF cookie and the request header contain the same token
 * using a constant-time comparison. Returns false if either side is missing.
 */
export async function verifyCsrf(request: Request): Promise<boolean> {
  const jar = await cookies();
  const cookieToken = jar.get(CSRF_COOKIE_NAME)?.value;
  const headerToken = request.headers.get(CSRF_HEADER_NAME);
  if (!cookieToken || !headerToken) {
    return false;
  }
  const a = Buffer.from(cookieToken, 'utf8');
  const b = Buffer.from(headerToken, 'utf8');
  if (a.length !== b.length) {
    return false;
  }
  return timingSafeEqual(a, b);
}

/**
 * Verifies the Origin header's host matches the Host header. Missing Origin is
 * treated as same-origin (common for non-CORS server-side fetches).
 */
export async function verifyOrigin(request: Request): Promise<boolean> {
  const origin = request.headers.get('origin');
  const host = request.headers.get('host');
  if (!origin) {
    return true;
  }
  if (!host) {
    return false;
  }
  try {
    const originHost = new URL(origin).host;
    return originHost === host;
  } catch {
    return false;
  }
}

/**
 * Combined CSRF + Origin guard. Returns a 403 NextResponse if validation fails,
 * or null when the request may proceed. Callers: `if (r) return r;`.
 */
export async function validateCsrfOrFail(request: Request): Promise<NextResponse | null> {
  const [csrfOk, originOk] = await Promise.all([verifyCsrf(request), verifyOrigin(request)]);
  if (!csrfOk || !originOk) {
    return NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 });
  }
  return null;
}
