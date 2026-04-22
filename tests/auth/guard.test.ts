import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { CookieStore } from '../helpers/mock-next-cookies';

const { cookieStoreRef, RedirectError } = vi.hoisted(() => {
  class RedirectError extends Error {
    constructor(public url: string) {
      super('REDIRECT');
      this.name = 'RedirectError';
    }
  }
  return {
    cookieStoreRef: { current: null as CookieStore | null },
    RedirectError,
  };
});

vi.mock('next/headers', () => ({
  cookies: async () => cookieStoreRef.current!.jar,
  headers: async () => new Headers(),
}));

vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new RedirectError(url);
  },
  notFound: () => {
    throw new Error('NOT_FOUND');
  },
}));

import { createCookieStore } from '../helpers/mock-next-cookies';
cookieStoreRef.current = createCookieStore();

// Now import the modules under test.
import { requireSession, requireApiSession } from '@/lib/auth/guard';
import { issueSession, destroySession } from '@/lib/auth/session';

describe('lib/auth/guard', () => {
  beforeEach(() => {
    cookieStoreRef.current = createCookieStore();
  });

  describe('requireApiSession', () => {
    it('returns a 401 response when there is no session', async () => {
      const result = await requireApiSession();
      expect(result.session).toBeNull();
      expect(result.response).not.toBeNull();
      expect(result.response?.status).toBe(401);
      const body = await result.response!.json();
      expect(body).toEqual({ error: 'Unauthorized' });
    });

    it('returns the session payload when a session exists', async () => {
      await issueSession(7, 'carol@example.com');
      const result = await requireApiSession();
      expect(result.response).toBeNull();
      expect(result.session).toMatchObject({ userId: 7, email: 'carol@example.com' });
      await destroySession();
    });
  });

  describe('requireSession', () => {
    it('redirects to /login?next=<encoded> when unauthenticated', async () => {
      await expect(requireSession('/settings')).rejects.toMatchObject({
        name: 'RedirectError',
        url: '/login?next=%2Fsettings',
      });
    });

    it('returns the session payload when a session exists', async () => {
      await issueSession(11, 'dan@example.com');
      const user = await requireSession('/settings');
      expect(user).toMatchObject({ userId: 11, email: 'dan@example.com' });
      await destroySession();
    });

    it('properly encodes complex paths', async () => {
      await expect(requireSession('/a/b?x=1&y=2')).rejects.toMatchObject({
        url: '/login?next=%2Fa%2Fb%3Fx%3D1%26y%3D2',
      });
    });
  });
});
