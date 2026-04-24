import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CookieStore } from '../../helpers/mock-next-cookies';

// ---------------------------------------------------------------------------
// Hoisted mock state (must be declared via vi.hoisted because vi.mock
// factories run before top-level imports).
// ---------------------------------------------------------------------------

const { cookieStoreRef } = vi.hoisted(() => ({
  cookieStoreRef: { current: null as CookieStore | null },
}));

vi.mock('next/headers', () => ({
  cookies: async () => cookieStoreRef.current!.jar,
  headers: async () => new Headers(),
}));

// Mock the LLM layer entirely — we don't want to talk to real providers from tests.
vi.mock('@/lib/providers/registry', () => ({
  getModel: vi.fn(() => ({ __mock: true })),
}));

vi.mock('ai', () => ({
  streamText: vi.fn(() => ({
    toDataStreamResponse: () =>
      new Response('mock-stream', {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      }),
  })),
}));

import { createCookieStore } from '../../helpers/mock-next-cookies';
cookieStoreRef.current = createCookieStore();

import { POST } from '@/app/api/structured-report/generate/route';
import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from '@/lib/auth/csrf';
import { issueSession } from '@/lib/auth/session';

// Request factory
function makeReportRequest(
  body: unknown,
  opts: {
    csrf?: string | null;
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

  return new Request('http://localhost/api/structured-report/generate', {
    method: 'POST',
    headers,
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

function setCsrfCookie(token = 'test-csrf-token'): void {
  cookieStoreRef.current!.jar.set({ name: CSRF_COOKIE_NAME, value: token });
}

// Authenticate the test request by planting a valid iron-session cookie in
// the mock jar.
async function authenticate(): Promise<void> {
  await issueSession(1, 'tester@example.com');
}

const validBody = {
  findings: 'Left 3 cm renal mass with heterogeneous enhancement.',
  diseaseCategory: 'RCC' as const,
  modality: 'CT' as const,
  lang: 'en' as const,
  provider: 'openai' as const,
  model: 'gpt-4o-mini',
};

describe('POST /api/structured-report/generate', () => {
  beforeEach(() => {
    cookieStoreRef.current = createCookieStore();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when the request has no session cookie', async () => {
    setCsrfCookie();
    const res = await POST(makeReportRequest(validBody));
    expect(res.status).toBe(401);
  });

  it('returns 400 on empty findings (zod validation failure)', async () => {
    await authenticate();
    setCsrfCookie();
    const res = await POST(
      makeReportRequest({ ...validBody, findings: '' })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it('returns 400 when diseaseCategory is not the supported RCC literal', async () => {
    await authenticate();
    setCsrfCookie();
    const res = await POST(
      makeReportRequest({ ...validBody, diseaseCategory: 'HCC' })
    );
    expect(res.status).toBe(400);
  });

  it('returns 403 when CSRF header is missing on an authenticated request', async () => {
    await authenticate();
    setCsrfCookie('cookie-token');
    const res = await POST(
      makeReportRequest(validBody, { csrf: null })
    );
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/CSRF/i);
  });
});
