import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { CookieStore } from '../helpers/mock-next-cookies';

const { cookieStoreRef } = vi.hoisted(() => ({
  cookieStoreRef: { current: null as CookieStore | null },
}));

vi.mock('next/headers', () => ({
  cookies: async () => cookieStoreRef.current!.jar,
  headers: async () => new Headers(),
}));

import { createCookieStore } from '../helpers/mock-next-cookies';
cookieStoreRef.current = createCookieStore();

// Lazy imports — done inside tests when we need to re-evaluate the module for
// env-var guard tests.
describe('lib/auth/session', () => {
  beforeEach(() => {
    cookieStoreRef.current = createCookieStore();
  });


  afterEach(() => {
    vi.resetModules();
  });

  describe('SESSION_SECRET guard', () => {
    it('throws when SESSION_SECRET is undefined', async () => {
      const original = process.env.SESSION_SECRET;
      vi.resetModules();
      delete process.env.SESSION_SECRET;
      await expect(import('@/lib/auth/session')).rejects.toThrow(/SESSION_SECRET/);
      process.env.SESSION_SECRET = original;
    });

    it('throws when SESSION_SECRET is shorter than 32 characters', async () => {
      const original = process.env.SESSION_SECRET;
      vi.resetModules();
      process.env.SESSION_SECRET = 'tooshort';
      await expect(import('@/lib/auth/session')).rejects.toThrow(/SESSION_SECRET/);
      process.env.SESSION_SECRET = original;
    });

    it('imports successfully with a valid 64-char secret', async () => {
      vi.resetModules();
      const mod = await import('@/lib/auth/session');
      expect(mod.sessionOptions.cookieName).toBe('rad_conclusion_session');
    });
  });

  describe('sessionOptions', () => {
    it('sets httpOnly, sameSite=lax, path=/, maxAge=604800', async () => {
      vi.resetModules();
      const { sessionOptions } = await import('@/lib/auth/session');
      expect(sessionOptions.cookieOptions?.httpOnly).toBe(true);
      expect(sessionOptions.cookieOptions?.sameSite).toBe('lax');
      expect(sessionOptions.cookieOptions?.path).toBe('/');
      expect(sessionOptions.cookieOptions?.maxAge).toBe(60 * 60 * 24 * 7);
    });
  });

  describe('getCurrentUser', () => {
    it('returns null when no session is set', async () => {
      vi.resetModules();
      const { getCurrentUser } = await import('@/lib/auth/session');
      await expect(getCurrentUser()).resolves.toBeNull();
    });
  });

  describe('issueSession + getCurrentUser round-trip', () => {
    it('issues a cookie and retrieves the session', async () => {
      vi.resetModules();
      const { issueSession, getCurrentUser } = await import('@/lib/auth/session');
      await issueSession(42, 'alice@example.com');
      // iron-session wrote to the mock cookie jar; verify retrieval.
      const user = await getCurrentUser();
      expect(user).toMatchObject({ userId: 42, email: 'alice@example.com' });
      expect(user?.issuedAt).toBeGreaterThan(0);
    });
  });

  describe('destroySession', () => {
    it('clears the session so getCurrentUser returns null', async () => {
      vi.resetModules();
      const { issueSession, destroySession, getCurrentUser } = await import(
        '@/lib/auth/session'
      );
      await issueSession(99, 'bob@example.com');
      expect(await getCurrentUser()).not.toBeNull();
      await destroySession();
      expect(await getCurrentUser()).toBeNull();
    });
  });
});
