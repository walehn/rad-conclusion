import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CookieStore } from '../helpers/mock-next-cookies';

// Server-side enforcement of the restricted role on the routes that read
// history or touch provider credentials. The UI hides these too, but only
// what is checked here actually limits the account.

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

// In-memory database with the real migrations, in place of data/auth.sqlite.
vi.mock('@/lib/db', async () => {
  const { default: Database } = await import('better-sqlite3');
  const { drizzle } = await import('drizzle-orm/better-sqlite3');
  const schema = await import('@/lib/db/schema');
  const { applyMigrations } = await import('../helpers/test-db');
  const sqlite = new Database(':memory:');
  applyMigrations(sqlite);
  return { db: drizzle(sqlite, { schema }), sqlite };
});

import { createCookieStore } from '../helpers/mock-next-cookies';
cookieStoreRef.current = createCookieStore();

import { db } from '@/lib/db';
import { generations, users, type NewGeneration } from '@/lib/db/schema';
import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from '@/lib/auth/csrf';
import { issueSession } from '@/lib/auth/session';
import { GET as getGenerations } from '@/app/api/generations/route';
import { GET as getProviders } from '@/app/api/providers/route';
import { POST as validateProvider } from '@/app/api/providers/validate/route';
import { GET as listKeys, POST as saveKey } from '@/app/api/user/api-keys/route';
import { DELETE as deleteKey } from '@/app/api/user/api-keys/[provider]/route';

const ADMIN_ID = 1;
const RESTRICTED_ID = 2;

function row(userId: number, batchId: string, promptVersion: 'v1' | 'v2' = 'v1'): NewGeneration {
  return {
    batchId,
    userId,
    findings: `findings of ${batchId}`,
    conclusion: `conclusion of ${batchId} ${promptVersion}`,
    promptVersion,
    style: 'numbered',
    lang: 'en',
    provider: 'local',
    model: 'deepseek-v4-flash-0731',
  };
}

async function signInAs(role: 'admin' | 'restricted'): Promise<void> {
  roleRef.current = role;
  await issueSession(role === 'admin' ? ADMIN_ID : RESTRICTED_ID, `${role}@example.com`);
  cookieStoreRef.current!.jar.set({ name: CSRF_COOKIE_NAME, value: 'test-csrf-token' });
}

function jsonRequest(url: string, method: string, body?: unknown): Request {
  return new Request(url, {
    method,
    headers: {
      'content-type': 'application/json',
      host: 'localhost',
      origin: 'http://localhost',
      [CSRF_HEADER_NAME]: 'test-csrf-token',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function historyIds(query = ''): Promise<{ ids: number[]; total: number }> {
  const res = await getGenerations(new NextRequest(`http://localhost/api/generations?${query}`));
  expect(res.status).toBe(200);
  const body = (await res.json()) as {
    batches: { items: { id: number }[] }[];
    total: number;
  };
  return {
    ids: body.batches.flatMap((b) => b.items.map((i) => i.id)).sort((a, b) => a - b),
    total: body.total,
  };
}

beforeEach(async () => {
  cookieStoreRef.current = createCookieStore();
  roleRef.current = 'admin';
  await db.delete(generations);
  await db.delete(users);
  await db.insert(users).values([
    { id: ADMIN_ID, email: 'admin@example.com', passwordHash: 'x', role: 'admin' },
    { id: RESTRICTED_ID, email: 'restricted@example.com', passwordHash: 'x', role: 'restricted' },
  ]);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('GET /api/generations', () => {
  beforeEach(async () => {
    await db.insert(generations).values([
      { id: 1, ...row(ADMIN_ID, 'admin-batch', 'v1') },
      { id: 2, ...row(ADMIN_ID, 'admin-batch', 'v2') },
      { id: 3, ...row(RESTRICTED_ID, 'own-batch') },
      // Same client-supplied batch id as an admin row.
      { id: 4, ...row(RESTRICTED_ID, 'shared-batch') },
      { id: 5, ...row(ADMIN_ID, 'shared-batch') },
    ]);
  });

  it('admin sees every account by default', async () => {
    await signInAs('admin');
    expect(await historyIds()).toEqual({ ids: [1, 2, 3, 4, 5], total: 3 });
  });

  it('admin can still narrow to own rows with mine=1', async () => {
    await signInAs('admin');
    const { ids } = await historyIds('mine=1');
    expect(ids).toEqual([1, 2, 4, 5]); // shared batch keeps its sibling for admins
  });

  it('restricted sees only its own rows without asking', async () => {
    await signInAs('restricted');
    expect(await historyIds()).toEqual({ ids: [3, 4], total: 2 });
  });

  it('restricted never receives another account row through a shared batch id', async () => {
    await signInAs('restricted');
    const { ids } = await historyIds('q=shared-batch');
    expect(ids).toEqual([4]);
  });
});

describe('GET /api/providers', () => {
  beforeEach(() => {
    vi.stubEnv('GOOGLE_AI_API_KEY', 'test-key');
  });

  it('lists hosted providers for admin', async () => {
    await signInAs('admin');
    const names = ((await (await getProviders()).json()) as { name: string }[]).map((p) => p.name);
    expect(names).toEqual(expect.arrayContaining(['local', 'google']));
  });

  it('lists only the local model for restricted', async () => {
    await signInAs('restricted');
    const names = ((await (await getProviders()).json()) as { name: string }[]).map((p) => p.name);
    expect(names).toEqual(['local']);
  });
});

describe('provider credentials are admin only', () => {
  it('restricted cannot list, save or delete API keys', async () => {
    await signInAs('restricted');
    expect((await listKeys()).status).toBe(403);
    expect(
      (await saveKey(jsonRequest('http://localhost/api/user/api-keys', 'POST', {
        provider: 'openai',
        apiKey: 'sk-test',
      }))).status
    ).toBe(403);
    expect(
      (await deleteKey(jsonRequest('http://localhost/api/user/api-keys/openai', 'DELETE'), {
        params: Promise.resolve({ provider: 'openai' }),
      })).status
    ).toBe(403);
  });

  it('admin can still list API keys', async () => {
    await signInAs('admin');
    const res = await listKeys();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it('restricted cannot make the server probe a provider endpoint', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    await signInAs('restricted');
    const res = await validateProvider(
      jsonRequest('http://localhost/api/providers/validate', 'POST', {
        provider: 'local',
        apiKey: 'not-needed',
        hostUrl: 'http://169.254.169.254',
      })
    );
    expect(res.status).toBe(403);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
