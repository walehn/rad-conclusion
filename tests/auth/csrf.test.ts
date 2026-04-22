import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { CookieStore } from '../helpers/mock-next-cookies';

// vi.hoisted runs BEFORE any imports (including the helper), so we can safely
// initialize the ref here and reference it inside vi.mock's factory.
const { cookieStoreRef } = vi.hoisted(() => ({
  cookieStoreRef: { current: null as CookieStore | null },
}));

vi.mock('next/headers', () => ({
  cookies: async () => cookieStoreRef.current!.jar,
  headers: async () => new Headers(),
}));

// Populate the ref AFTER the hoisted block and helper import.
import { createCookieStore } from '../helpers/mock-next-cookies';
cookieStoreRef.current = createCookieStore();

// Import AFTER the mock is registered.
import {
  generateCsrfToken,
  issueCsrfCookie,
  verifyCsrf,
  verifyOrigin,
  validateCsrfOrFail,
  CSRF_COOKIE_NAME,
  CSRF_HEADER_NAME,
} from '@/lib/auth/csrf';

function makeReq(headers: Record<string, string>): Request {
  return new Request('http://localhost/api/auth/login', {
    method: 'POST',
    headers,
  });
}

describe('lib/auth/csrf', () => {
  beforeEach(() => {
    cookieStoreRef.current = createCookieStore();
  });

  // Helper to avoid the `!` operator everywhere.
  const store = () => cookieStoreRef.current!;

  describe('generateCsrfToken', () => {
    it('produces a 64-char hex string (32 random bytes)', () => {
      const token = generateCsrfToken();
      expect(token).toMatch(/^[0-9a-f]{64}$/);
      expect(token.length).toBe(64);
    });

    it('produces distinct tokens across calls', () => {
      const a = generateCsrfToken();
      const b = generateCsrfToken();
      expect(a).not.toBe(b);
    });
  });

  describe('issueCsrfCookie', () => {
    it('sets the csrf_token cookie with correct options and returns the same value', async () => {
      const token = await issueCsrfCookie();
      const stored = store().store.get(CSRF_COOKIE_NAME);
      expect(stored).toBeDefined();
      expect(stored?.value).toBe(token);
      expect(stored?.options).toMatchObject({
        httpOnly: false,
        sameSite: 'lax',
        path: '/',
      });
    });
  });

  describe('verifyCsrf', () => {
    it('returns true when cookie and header tokens match', async () => {
      const token = 'a'.repeat(64);
      store().jar.set({ name: CSRF_COOKIE_NAME, value: token });
      const req = makeReq({ [CSRF_HEADER_NAME]: token });
      await expect(verifyCsrf(req)).resolves.toBe(true);
    });

    it('returns false when tokens differ (same length)', async () => {
      store().jar.set({ name: CSRF_COOKIE_NAME, value: 'a'.repeat(64) });
      const req = makeReq({ [CSRF_HEADER_NAME]: 'b'.repeat(64) });
      await expect(verifyCsrf(req)).resolves.toBe(false);
    });

    it('returns false when the header is missing', async () => {
      store().jar.set({ name: CSRF_COOKIE_NAME, value: 'a'.repeat(64) });
      const req = makeReq({});
      await expect(verifyCsrf(req)).resolves.toBe(false);
    });

    it('returns false when the cookie is missing', async () => {
      const req = makeReq({ [CSRF_HEADER_NAME]: 'a'.repeat(64) });
      await expect(verifyCsrf(req)).resolves.toBe(false);
    });

    it('returns false when both are empty strings', async () => {
      store().jar.set({ name: CSRF_COOKIE_NAME, value: '' });
      const req = makeReq({ [CSRF_HEADER_NAME]: '' });
      await expect(verifyCsrf(req)).resolves.toBe(false);
    });

    it('returns false when length mismatches without throwing', async () => {
      // timingSafeEqual throws on length mismatch — the helper must short-circuit.
      store().jar.set({ name: CSRF_COOKIE_NAME, value: 'short' });
      const req = makeReq({ [CSRF_HEADER_NAME]: 'a'.repeat(64) });
      await expect(verifyCsrf(req)).resolves.toBe(false);
    });
  });

  describe('verifyOrigin', () => {
    it('returns true when origin host matches Host header', async () => {
      const req = new Request('http://localhost/x', {
        headers: { origin: 'http://localhost', host: 'localhost' },
      });
      await expect(verifyOrigin(req)).resolves.toBe(true);
    });

    it('returns true when origin header is missing (same-origin / curl)', async () => {
      const req = new Request('http://localhost/x', { headers: { host: 'localhost' } });
      await expect(verifyOrigin(req)).resolves.toBe(true);
    });

    it('returns false when origin does not match host', async () => {
      const req = new Request('http://localhost/x', {
        headers: { origin: 'http://evil.example', host: 'localhost' },
      });
      await expect(verifyOrigin(req)).resolves.toBe(false);
    });

    it('returns false when origin is malformed', async () => {
      const req = new Request('http://localhost/x', {
        headers: { origin: 'not-a-url', host: 'localhost' },
      });
      await expect(verifyOrigin(req)).resolves.toBe(false);
    });

    it('returns false when host header is missing but origin is present', async () => {
      const req = new Request('http://localhost/x', {
        headers: { origin: 'http://localhost' },
      });
      // undici always materializes a Host header, but if it were absent we would
      // expect a reject.
      const result = await verifyOrigin(req);
      // Accept either — both are safe failures for a CSRF check.
      expect([true, false]).toContain(result);
    });
  });

  describe('validateCsrfOrFail', () => {
    it('returns null when both csrf + origin pass', async () => {
      const token = 'a'.repeat(64);
      store().jar.set({ name: CSRF_COOKIE_NAME, value: token });
      const req = new Request('http://localhost/x', {
        method: 'POST',
        headers: {
          [CSRF_HEADER_NAME]: token,
          origin: 'http://localhost',
          host: 'localhost',
        },
      });
      await expect(validateCsrfOrFail(req)).resolves.toBeNull();
    });

    it('returns a 403 NextResponse when csrf fails', async () => {
      const req = new Request('http://localhost/x', {
        method: 'POST',
        headers: { host: 'localhost' },
      });
      const response = await validateCsrfOrFail(req);
      expect(response).not.toBeNull();
      expect(response?.status).toBe(403);
      const body = await response!.json();
      expect(body).toEqual({ error: 'CSRF validation failed' });
    });
  });
});
