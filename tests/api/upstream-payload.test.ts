import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CookieStore } from '../helpers/mock-next-cookies';

// Characterization of the exact HTTP requests sent to the LLM endpoints.
// An SDK upgrade must not change what vLLM receives while the prompt A/B test
// is running, so every upstream request is captured and snapshotted.

const { cookieStoreRef, roleRef } = vi.hoisted(() => ({
  cookieStoreRef: { current: null as CookieStore | null },
  roleRef: { current: 'admin' as 'admin' | 'restricted' | null },
}));

vi.mock('next/headers', () => ({
  cookies: async () => cookieStoreRef.current!.jar,
  headers: async () => new Headers(),
}));

// The guard reads the account's role from the database; stub it so these
// tests never open data/auth.sqlite.
vi.mock('@/lib/auth/user-role', () => ({
  getUserRole: vi.fn(async () => roleRef.current),
}));

vi.mock('@/lib/api-keys/resolve', () => ({
  resolveApiKey: vi.fn(async () => null),
}));

vi.mock('@/lib/generations/record', () => ({
  recordGeneration: vi.fn(),
}));

import { createCookieStore } from '../helpers/mock-next-cookies';
cookieStoreRef.current = createCookieStore();

import { POST } from '@/app/api/generate/route';
import { recordGeneration } from '@/lib/generations/record';
import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from '@/lib/auth/csrf';
import { issueSession } from '@/lib/auth/session';
import { generateForCase } from '@/lib/eval/replay';
import { reviewForCase, REVIEW_VARIANTS } from '@/lib/eval/findings-review-run';
import { JUDGES, runJudge } from '@/lib/eval/judges';
import { PROMPT_CANDIDATES } from '@/lib/prompts/candidates';

const FINDINGS = 'Left 3 cm renal mass with heterogeneous enhancement.';
const REPLY = '1. Left renal mass, suspicious for RCC.';

interface Captured {
  path: string;
  body: unknown;
}

let captured: Captured[] = [];

// Long strings (prompts) are reduced to a hash so the snapshot stays readable
// while still failing on any change to the text actually sent.
function normalize(value: unknown): unknown {
  if (typeof value === 'string') {
    if (value.length <= 80) return value;
    const sha = createHash('sha256').update(value).digest('hex').slice(0, 12);
    return `<sha:${sha} len:${value.length}>`;
  }
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, normalize(v)])
    );
  }
  return value;
}

function openAiReply(stream: boolean): Response {
  if (!stream) {
    return Response.json({
      id: 'cmpl-1',
      object: 'chat.completion',
      created: 0,
      model: 'stub',
      choices: [
        { index: 0, message: { role: 'assistant', content: REPLY }, finish_reason: 'stop' },
      ],
      usage: { prompt_tokens: 11, completion_tokens: 7, total_tokens: 18 },
    });
  }
  const chunk = (delta: object, finish: string | null, usage?: object) =>
    `data: ${JSON.stringify({
      id: 'cmpl-1',
      object: 'chat.completion.chunk',
      created: 0,
      model: 'stub',
      choices: [{ index: 0, delta, finish_reason: finish }],
      ...(usage ? { usage } : {}),
    })}\n\n`;
  const sse =
    chunk({ role: 'assistant', content: REPLY }, null) +
    chunk({}, 'stop', { prompt_tokens: 11, completion_tokens: 7, total_tokens: 18 }) +
    'data: [DONE]\n\n';
  return new Response(sse, { headers: { 'Content-Type': 'text/event-stream' } });
}

function geminiReply(): Response {
  return Response.json({
    candidates: [
      { content: { role: 'model', parts: [{ text: REPLY }] }, finishReason: 'STOP', index: 0 },
    ],
    usageMetadata: { promptTokenCount: 11, candidatesTokenCount: 7, totalTokenCount: 18 },
  });
}

const fakeFetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input : input.url);
  const raw = typeof init?.body === 'string' ? init.body : '';
  const body = raw ? JSON.parse(raw) : null;
  captured.push({ path: `${url.host}${url.pathname}`, body: normalize(body) });
  if (url.host.includes('googleapis')) return geminiReply();
  return openAiReply(body?.stream === true);
});

function makeGenerateRequest(body: object): Request {
  return new Request('http://localhost/api/generate', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      host: 'localhost',
      origin: 'http://localhost',
      [CSRF_HEADER_NAME]: 'test-csrf-token',
    },
    body: JSON.stringify(body),
  });
}

describe('upstream LLM request payloads', () => {
  beforeEach(() => {
    captured = [];
    cookieStoreRef.current = createCookieStore();
    roleRef.current = 'admin';
    vi.clearAllMocks();
    vi.stubGlobal('fetch', fakeFetch);
    vi.stubEnv('RAD_LOCAL_DEEPSEEK_HOST', 'http://vllm.test');
    vi.stubEnv('RAD_LOCAL_HOST', 'http://qwen.test');
    vi.stubEnv('GOOGLE_AI_API_KEY', 'test-key');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  for (const promptVersion of ['v1', 'v2'] as const) {
    for (const model of ['deepseek-v4-flash-0731', 'Qwen/Qwen3.6-35B-A3B-FP8']) {
      it(`/api/generate ${promptVersion} ${model}`, async () => {
        await issueSession(1, 'tester@example.com');
        cookieStoreRef.current!.jar.set({ name: CSRF_COOKIE_NAME, value: 'test-csrf-token' });

        const res = await POST(
          makeGenerateRequest({ findings: FINDINGS, provider: 'local', model, promptVersion })
        );
        expect(res.status).toBe(200);
        const streamed = await res.text();
        expect(streamed).toContain('suspicious for RCC');

        expect(captured).toMatchSnapshot();
        const row = vi.mocked(recordGeneration).mock.calls[0][0];
        expect({
          conclusion: row.conclusion,
          finishReason: row.finishReason,
          promptTokens: row.promptTokens,
          completionTokens: row.completionTokens,
        }).toMatchSnapshot();
      });
    }
  }

  it('restricted account: local request body is identical to an admin one', async () => {
    const send = async () => {
      await issueSession(1, 'tester@example.com');
      cookieStoreRef.current!.jar.set({ name: CSRF_COOKIE_NAME, value: 'test-csrf-token' });
      const res = await POST(
        makeGenerateRequest({
          findings: FINDINGS,
          provider: 'local',
          model: 'deepseek-v4-flash-0731',
          promptVersion: 'v1',
        })
      );
      expect(res.status).toBe(200);
      await res.text();
    };
    await send();
    const asAdmin = captured;
    captured = [];
    roleRef.current = 'restricted';
    await send();
    expect(captured).toEqual(asAdmin);
  });

  it('restricted account: hosted provider is refused before any upstream request', async () => {
    roleRef.current = 'restricted';
    await issueSession(1, 'tester@example.com');
    cookieStoreRef.current!.jar.set({ name: CSRF_COOKIE_NAME, value: 'test-csrf-token' });
    const res = await POST(
      makeGenerateRequest({ findings: FINDINGS, provider: 'google', promptVersion: 'v1' })
    );
    expect(res.status).toBe(403);
    expect(captured).toEqual([]);
    expect(recordGeneration).not.toHaveBeenCalled();
  });

  it('replay generateForCase (every candidate)', async () => {
    for (const c of Object.values(PROMPT_CANDIDATES)) {
      const out = await generateForCase(c, FINDINGS);
      expect(out.output).toContain('suspicious for RCC');
    }
    expect(captured).toMatchSnapshot();
  });

  it('findings review (both variants)', async () => {
    for (const v of Object.values(REVIEW_VARIANTS)) {
      const out = await reviewForCase(v, FINDINGS);
      expect(out.output).toBe(REPLY);
    }
    expect(captured).toMatchSnapshot();
  });

  it('judges (local and gemini)', async () => {
    for (const spec of Object.values(JUDGES)) {
      // The stub reply is not a valid judgment; only the request matters here.
      await runJudge(spec, FINDINGS, REPLY).catch(() => undefined);
    }
    expect(captured).toMatchSnapshot();
  });
});
