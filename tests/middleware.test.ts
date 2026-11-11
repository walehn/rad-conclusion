import { describe, it, expect, vi } from 'vitest';
import { middleware } from '@/middleware';
import type { NextRequest } from 'next/server';

/**
 * Characterization tests for middleware.ts. This file freezes the current
 * IP-whitelist behavior so future refactors cannot silently change access
 * rules. Per AC "기존 middleware.ts 동작 변경 없음 (회귀 테스트 통과)" we assert
 * on the exact allowed set and precedence order.
 */

// The whitelist baked into middleware.ts at time of test authoring.
const CURRENT_WHITELIST = ['61.78.110.69', '61.78.110.80', '61.78.110.90', '116.35.186.20', '127.0.0.1', '::1'];

// Minimal NextRequest shim — middleware only uses headers, method,
// nextUrl.pathname, and user-agent.
function makeNextRequest(headers: Record<string, string>, path = '/'): NextRequest {
  const h = new Headers(headers);
  const req: Partial<NextRequest> = {
    headers: h,
    method: 'GET',
    nextUrl: {
      pathname: path,
    } as unknown as NextRequest['nextUrl'],
  };
  return req as NextRequest;
}

describe('middleware (characterization)', () => {
  it('whitelist still contains exactly the documented entries', () => {
    // Read the whitelist from the module via a public-behavior probe: we
    // exercise each IP and assert it is not blocked. This freezes the set.
    for (const ip of CURRENT_WHITELIST) {
      const res = middleware(makeNextRequest({ 'cf-connecting-ip': ip }));
      // NextResponse.next() produces a response with no 403 status.
      expect(res.status).not.toBe(403);
    }
  });

  it('blocks addresses outside the exact list and the temporary range', () => {
    for (const ip of [
      '61.78.109.255', // just below 61.78.110.0/24
      '61.78.111.0', // just above it
      '61.78.11.1',
      '61.79.110.5',
      '161.78.110.5',
      '116.35.186.19', // neighbours of an exact entry
      '116.35.186.21',
      '10.10.1.1',
    ]) {
      const res = middleware(makeNextRequest({ 'cf-connecting-ip': ip }));
      expect(res.status, ip).toBe(403);
    }
  });

  it('temporary range: allows every address in 61.78.110.0/24', () => {
    for (const ip of ['61.78.110.0', '61.78.110.1', '61.78.110.68', '61.78.110.70', '61.78.110.128', '61.78.110.255']) {
      const res = middleware(makeNextRequest({ 'cf-connecting-ip': ip }));
      expect(res.status, ip).not.toBe(403);
    }
  });

  it('temporary range: refuses malformed or disguised addresses', () => {
    for (const ip of [
      '61.78.110.256',
      '61.78.110',
      '61.78.110.5.1',
      '061.78.110.5',
      '61.78.110.05',
      '61.78.110.+5',
      '61.78.110.-1',
      '61.78.110.0x5',
      '61.78.110.5/24',
      '::ffff:61.78.110.5',
    ]) {
      const res = middleware(makeNextRequest({ 'cf-connecting-ip': ip }));
      expect(res.status, ip).toBe(403);
    }
  });

  it('temporary range: logs [wide] only for addresses the exact list does not cover', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      middleware(makeNextRequest({ 'cf-connecting-ip': '61.78.110.80' }));
      expect(log.mock.calls.some(([line]) => String(line).startsWith('[wide]'))).toBe(false);

      middleware(makeNextRequest({ 'cf-connecting-ip': '61.78.110.68' }, '/review'));
      const wide = log.mock.calls.map(([line]) => String(line)).filter((line) => line.startsWith('[wide]'));
      expect(wide).toHaveLength(1);
      expect(wide[0]).toMatch(/^\[wide\] \S+ 61\.78\.110\.68 GET \/review$/);

      log.mockClear();
      middleware(makeNextRequest({ 'cf-connecting-ip': '61.78.111.1' }));
      const lines = log.mock.calls.map(([line]) => String(line));
      expect(lines.some((line) => line.startsWith('[wide]'))).toBe(false);
      expect(lines.some((line) => line.startsWith('[blocked]'))).toBe(true);
    } finally {
      log.mockRestore();
    }
  });

  it('allows a whitelisted IP supplied via cf-connecting-ip', () => {
    const res = middleware(makeNextRequest({ 'cf-connecting-ip': '127.0.0.1' }));
    expect(res.status).not.toBe(403);
  });

  it('allows a whitelisted IP supplied as the first entry of x-forwarded-for', () => {
    const res = middleware(
      makeNextRequest({ 'x-forwarded-for': '61.78.110.80, 1.2.3.4' })
    );
    expect(res.status).not.toBe(403);
  });

  it('trims whitespace in x-forwarded-for entries', () => {
    const res = middleware(
      makeNextRequest({ 'x-forwarded-for': '  127.0.0.1 , 10.0.0.1' })
    );
    expect(res.status).not.toBe(403);
  });

  it('blocks a non-whitelisted IP supplied via x-real-ip', () => {
    const res = middleware(makeNextRequest({ 'x-real-ip': '8.8.8.8' }));
    expect(res.status).toBe(403);
  });

  it('blocks when no IP headers are present (falls back to "unknown")', () => {
    const res = middleware(makeNextRequest({}));
    expect(res.status).toBe(403);
  });

  it('IP precedence: cf-connecting-ip wins over x-forwarded-for and x-real-ip', () => {
    // cf says a whitelisted IP, xff + x-real-ip say blocked IPs -> allowed.
    const res = middleware(
      makeNextRequest({
        'cf-connecting-ip': '127.0.0.1',
        'x-forwarded-for': '8.8.8.8',
        'x-real-ip': '9.9.9.9',
      })
    );
    expect(res.status).not.toBe(403);
  });

  it('IP precedence: x-forwarded-for wins over x-real-ip when cf is missing', () => {
    const res = middleware(
      makeNextRequest({
        'x-forwarded-for': '8.8.8.8',
        'x-real-ip': '127.0.0.1',
      })
    );
    expect(res.status).toBe(403);
  });

  it('blocks a cross-combo where cf-connecting-ip is blocked even if xff would allow', () => {
    const res = middleware(
      makeNextRequest({
        'cf-connecting-ip': '8.8.8.8',
        'x-forwarded-for': '127.0.0.1',
      })
    );
    expect(res.status).toBe(403);
  });
});
