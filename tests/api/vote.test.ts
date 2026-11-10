import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CookieStore } from '../helpers/mock-next-cookies';

// Restricted accounts may vote; their votes are stored like any other but
// left out of the tally. The route writes to <cwd>/data/votes.jsonl, so cwd
// is pointed at a temp dir before the route module is loaded.

const { cookieStoreRef, roleRef } = vi.hoisted(() => ({
  cookieStoreRef: { current: null as CookieStore | null },
  roleRef: { current: 'admin' as 'admin' | 'restricted' | null },
}));

vi.mock('next/headers', () => ({
  cookies: async () => cookieStoreRef.current!.jar,
  headers: async () => new Headers(),
}));

vi.mock('@/lib/auth/user-role', () => ({
  getUserRole: vi.fn(async () => roleRef.current),
}));

import { createCookieStore } from '../helpers/mock-next-cookies';
cookieStoreRef.current = createCookieStore();

import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from '@/lib/auth/csrf';
import { issueSession } from '@/lib/auth/session';

type VoteRoute = typeof import('@/app/api/vote/route');

let tmp: string;
let route: VoteRoute;
let cwdSpy: { mockRestore: () => void };

const vote = {
  vote: 'v2',
  style: 'numbered',
  lang: 'en',
  model: 'deepseek-v4-flash-0731',
  findingsLength: 42,
};

async function signInAs(role: 'admin' | 'restricted', userId: number): Promise<void> {
  roleRef.current = role;
  await issueSession(userId, `${role}@example.com`);
  cookieStoreRef.current!.jar.set({ name: CSRF_COOKIE_NAME, value: 'test-csrf-token' });
}

function postVote(body: unknown) {
  return route.POST(
    new Request('http://localhost/api/vote', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        host: 'localhost',
        origin: 'http://localhost',
        [CSRF_HEADER_NAME]: 'test-csrf-token',
      },
      body: JSON.stringify(body),
    }) as never
  );
}

function storedVotes(): Record<string, unknown>[] {
  return readFileSync(path.join(tmp, 'data', 'votes.jsonl'), 'utf-8')
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l));
}

beforeEach(async () => {
  tmp = mkdtempSync(path.join(tmpdir(), 'rad-vote-'));
  cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(tmp);
  vi.resetModules();
  route = await import('@/app/api/vote/route');
  cookieStoreRef.current = createCookieStore();
});

afterEach(() => {
  cwdSpy.mockRestore();
  rmSync(tmp, { recursive: true, force: true });
});

describe('/api/vote', () => {
  it('lets a restricted account vote and stores who voted', async () => {
    await signInAs('restricted', 2);
    const res = await postVote(vote);
    expect(res.status).toBe(200);
    expect(storedVotes()).toEqual([expect.objectContaining({ vote: 'v2', userId: 2, role: 'restricted' })]);
  });

  it('leaves restricted votes out of the tally', async () => {
    await signInAs('admin', 1);
    await postVote({ ...vote, vote: 'v1' });
    await signInAs('restricted', 2);
    const res = await postVote(vote);
    expect((await res.json()).total).toEqual({ v1: 1, v2: 0, tie: 0 });
    expect(storedVotes()).toHaveLength(2);
  });

  it('still counts votes written before roles existed', async () => {
    const dir = path.join(tmp, 'data');
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      path.join(dir, 'votes.jsonl'),
      `${JSON.stringify({ timestamp: 't', ...vote, vote: 'tie' })}\n`
    );
    await signInAs('admin', 1);
    const res = await route.GET();
    expect((await res.json()).total).toEqual({ v1: 0, v2: 0, tie: 1 });
  });
});
