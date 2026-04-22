import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MAX_ATTEMPTS,
  WINDOW_MS,
  ipAttempts,
  emailAttempts,
  recordFailure,
  checkBeforeAttempt,
  resetOnSuccess,
  resetAllForTesting,
  extractIp,
} from '@/lib/auth/rate-limit';

describe('lib/auth/rate-limit', () => {
  beforeEach(() => {
    resetAllForTesting();
  });

  afterEach(() => {
    vi.useRealTimers();
    resetAllForTesting();
  });

  describe('checkBeforeAttempt', () => {
    it('returns allowed:true on an empty cache', () => {
      const result = checkBeforeAttempt('1.2.3.4', ipAttempts);
      expect(result).toEqual({ allowed: true, retryAfterSeconds: 0 });
    });

    it('remains allowed:true through the first MAX_ATTEMPTS failures', () => {
      for (let i = 0; i < MAX_ATTEMPTS; i++) {
        recordFailure('1.2.3.4', ipAttempts);
        const check = checkBeforeAttempt('1.2.3.4', ipAttempts);
        if (i < MAX_ATTEMPTS - 1) {
          expect(check.allowed).toBe(true);
        }
      }
      // After 5 failures recorded, check must now block.
      const after = checkBeforeAttempt('1.2.3.4', ipAttempts);
      expect(after.allowed).toBe(false);
      expect(after.retryAfterSeconds).toBeGreaterThan(0);
    });

    it('blocks the 6th attempt within the window', () => {
      for (let i = 0; i < 5; i++) {
        recordFailure('1.2.3.4', ipAttempts);
      }
      const sixth = checkBeforeAttempt('1.2.3.4', ipAttempts);
      expect(sixth.allowed).toBe(false);
      expect(sixth.retryAfterSeconds).toBeGreaterThan(0);
      expect(sixth.retryAfterSeconds).toBeLessThanOrEqual(WINDOW_MS / 1000);
    });
  });

  describe('recordFailure', () => {
    it('increments the count per call', () => {
      recordFailure('key', ipAttempts);
      recordFailure('key', ipAttempts);
      const entry = ipAttempts.get('key');
      expect(entry?.count).toBe(2);
    });

    it('returns allowed:false once count exceeds MAX_ATTEMPTS', () => {
      // 1..5 are allowed, 6 is blocked
      for (let i = 0; i < MAX_ATTEMPTS; i++) {
        const r = recordFailure('key', ipAttempts);
        expect(r.allowed).toBe(true);
      }
      const over = recordFailure('key', ipAttempts);
      expect(over.allowed).toBe(false);
      expect(over.retryAfterSeconds).toBeGreaterThan(0);
    });

    it('resets the window when more than WINDOW_MS has elapsed', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));

      // Fill up to the limit.
      for (let i = 0; i < MAX_ATTEMPTS; i++) {
        recordFailure('key', ipAttempts);
      }
      expect(checkBeforeAttempt('key', ipAttempts).allowed).toBe(false);

      // Advance past the window.
      vi.setSystemTime(new Date(Date.now() + WINDOW_MS + 1_000));
      // The LRUCache TTL also kicks in; either way recordFailure must reset.
      const after = recordFailure('key', ipAttempts);
      expect(after.allowed).toBe(true);
      expect(after.retryAfterSeconds).toBe(0);
    });
  });

  describe('resetOnSuccess', () => {
    it('clears the key so subsequent attempts are allowed', () => {
      for (let i = 0; i < MAX_ATTEMPTS; i++) {
        recordFailure('key', ipAttempts);
      }
      expect(checkBeforeAttempt('key', ipAttempts).allowed).toBe(false);
      resetOnSuccess('key', ipAttempts);
      expect(checkBeforeAttempt('key', ipAttempts).allowed).toBe(true);
    });
  });

  describe('cache independence (EC-08)', () => {
    it('exhausting the IP cache does not block a different email key', () => {
      for (let i = 0; i < MAX_ATTEMPTS; i++) {
        recordFailure('1.2.3.4', ipAttempts);
      }
      expect(checkBeforeAttempt('1.2.3.4', ipAttempts).allowed).toBe(false);
      expect(checkBeforeAttempt('alice@example.com', emailAttempts).allowed).toBe(true);
    });

    it('exhausting the email cache does not block a different IP key', () => {
      for (let i = 0; i < MAX_ATTEMPTS; i++) {
        recordFailure('alice@example.com', emailAttempts);
      }
      expect(checkBeforeAttempt('alice@example.com', emailAttempts).allowed).toBe(false);
      expect(checkBeforeAttempt('1.2.3.4', ipAttempts).allowed).toBe(true);
    });
  });

  describe('extractIp precedence', () => {
    function reqWith(headers: Record<string, string>): Request {
      return new Request('http://localhost/x', { headers });
    }

    it('prefers cf-connecting-ip when present', () => {
      const req = reqWith({
        'cf-connecting-ip': '1.1.1.1',
        'x-forwarded-for': '2.2.2.2',
        'x-real-ip': '3.3.3.3',
      });
      expect(extractIp(req)).toBe('1.1.1.1');
    });

    it('falls back to the first trimmed x-forwarded-for entry', () => {
      const req = reqWith({ 'x-forwarded-for': '  61.78.110.80 , 10.0.0.1 ' });
      expect(extractIp(req)).toBe('61.78.110.80');
    });

    it('falls back to x-real-ip when others absent', () => {
      const req = reqWith({ 'x-real-ip': '8.8.8.8' });
      expect(extractIp(req)).toBe('8.8.8.8');
    });

    it("returns 'unknown' when no IP header is present", () => {
      const req = reqWith({});
      expect(extractIp(req)).toBe('unknown');
    });
  });

  describe('resetAllForTesting', () => {
    it('is a no-op when NODE_ENV !== test', () => {
      const env = process.env as Record<string, string | undefined>;
      const original = env.NODE_ENV;
      try {
        env.NODE_ENV = 'production';
        recordFailure('key', ipAttempts);
        resetAllForTesting();
        expect(ipAttempts.get('key')).toBeDefined();
      } finally {
        env.NODE_ENV = original;
      }
    });

    it('clears both caches when NODE_ENV === test', () => {
      recordFailure('k1', ipAttempts);
      recordFailure('k2', emailAttempts);
      resetAllForTesting();
      expect(ipAttempts.get('k1')).toBeUndefined();
      expect(emailAttempts.get('k2')).toBeUndefined();
    });
  });
});
