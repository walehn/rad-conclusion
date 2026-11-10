import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { CookieStore } from '../helpers/mock-next-cookies';

const { cookieStoreRef, RedirectError, roleRef } = vi.hoisted(() => {
  class RedirectError extends Error {
    constructor(public url: string) {
      super('REDIRECT');
      this.name = 'RedirectError';
    }
  }
  return {
    cookieStoreRef: { current: null as CookieStore | null },
    RedirectError,
    roleRef: { current: 'admin' as 'admin' | 'restricted' | null },
  };
});

// Role lookup hits the database; stub it (null = the account no longer exists).
vi.mock('@/lib/auth/user-role', () => ({
  getUserRole: vi.fn(async () => roleRef.current),
}));

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
import {
  forbiddenResponse,
  getAuthedUser,
  requireApiSession,
  requireSession,
} from '@/lib/auth/guard';
import { issueSession, destroySession } from '@/lib/auth/session';

describe('lib/auth/guard', () => {
  beforeEach(() => {
    cookieStoreRef.current = createCookieStore();
    roleRef.current = 'admin';
  });

  describe('getAuthedUser', () => {
    it('returns null without a session', async () => {
      expect(await getAuthedUser()).toBeNull();
    });

    it('attaches the role read from the database', async () => {
      roleRef.current = 'restricted';
      await issueSession(5, 'eve@example.com');
      expect(await getAuthedUser()).toMatchObject({
        userId: 5,
        email: 'eve@example.com',
        role: 'restricted',
      });
      await destroySession();
    });

    it('returns null when the session outlived its account', async () => {
      roleRef.current = null;
      await issueSession(5, 'eve@example.com');
      expect(await getAuthedUser()).toBeNull();
      await destroySession();
    });
  });

  describe('forbiddenResponse', () => {
    it('is a 403 with a JSON error body', async () => {
      const res = forbiddenResponse();
      expect(res.status).toBe(403);
      expect(await res.json()).toEqual({ error: 'Forbidden' });
    });
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
      expect(result.session).toMatchObject({
        userId: 7,
        email: 'carol@example.com',
        role: 'admin',
      });
      await destroySession();
    });

    it('returns 401 when the session belongs to a deleted account', async () => {
      roleRef.current = null;
      await issueSession(7, 'carol@example.com');
      const result = await requireApiSession();
      expect(result.session).toBeNull();
      expect(result.response?.status).toBe(401);
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
      expect(user).toMatchObject({ userId: 11, email: 'dan@example.com', role: 'admin' });
      await destroySession();
    });

    it('redirects to /login when the session belongs to a deleted account', async () => {
      roleRef.current = null;
      await issueSession(11, 'dan@example.com');
      await expect(requireSession('/review')).rejects.toMatchObject({
        url: '/login?next=%2Freview',
      });
      await destroySession();
    });

    it('properly encodes complex paths', async () => {
      await expect(requireSession('/a/b?x=1&y=2')).rejects.toMatchObject({
        url: '/login?next=%2Fa%2Fb%3Fx%3D1%26y%3D2',
      });
    });
  });
});
