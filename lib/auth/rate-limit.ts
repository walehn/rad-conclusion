import { LRUCache } from 'lru-cache';

/** Sliding-window entry: how many failures and when the window began. */
export interface Entry {
  count: number;
  firstAt: number;
}

/** Maximum failed attempts allowed inside a single window before blocking. */
export const MAX_ATTEMPTS = 5;
/** Window duration in milliseconds (15 minutes). */
export const WINDOW_MS = 15 * 60 * 1000;

/** Per-IP failure counter. Keys are client IP strings. */
export const ipAttempts = new LRUCache<string, Entry>({ max: 10000, ttl: WINDOW_MS });
/** Per-email failure counter. Keys are normalized (lowercase+trimmed) emails. */
export const emailAttempts = new LRUCache<string, Entry>({ max: 10000, ttl: WINDOW_MS });

/**
 * Records a failed attempt against the given cache. Resets the window when the
 * previous window has expired. Returns whether the caller should be allowed to
 * proceed and, when blocked, how many seconds until the window clears.
 */
export function recordFailure(
  key: string,
  cache: LRUCache<string, Entry>
): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const entry = cache.get(key);
  if (!entry || now - entry.firstAt > WINDOW_MS) {
    cache.set(key, { count: 1, firstAt: now });
    return { allowed: true, retryAfterSeconds: 0 };
  }
  entry.count += 1;
  cache.set(key, entry);
  if (entry.count > MAX_ATTEMPTS) {
    const retryAfterSeconds = Math.max(
      0,
      Math.ceil((entry.firstAt + WINDOW_MS - now) / 1000)
    );
    return { allowed: false, retryAfterSeconds };
  }
  return { allowed: true, retryAfterSeconds: 0 };
}

/**
 * Inspects the current counter without mutating it. Used to pre-empt expensive
 * work (e.g., argon2 verify) when the caller is already over the limit.
 */
export function checkBeforeAttempt(
  key: string,
  cache: LRUCache<string, Entry>
): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const entry = cache.get(key);
  if (!entry || now - entry.firstAt > WINDOW_MS) {
    return { allowed: true, retryAfterSeconds: 0 };
  }
  if (entry.count >= MAX_ATTEMPTS) {
    const retryAfterSeconds = Math.max(
      0,
      Math.ceil((entry.firstAt + WINDOW_MS - now) / 1000)
    );
    return { allowed: false, retryAfterSeconds };
  }
  return { allowed: true, retryAfterSeconds: 0 };
}

/** Clears the counter for the given key on successful authentication. */
export function resetOnSuccess(key: string, cache: LRUCache<string, Entry>): void {
  cache.delete(key);
}

/** Test-only helper that wipes both caches. Guarded by NODE_ENV==='test'. */
export function resetAllForTesting(): void {
  if (process.env.NODE_ENV === 'test') {
    ipAttempts.clear();
    emailAttempts.clear();
  }
}

/**
 * Extracts the client IP from the request headers using the same precedence as
 * middleware.ts (Cloudflare → XFF → X-Real-IP → 'unknown').
 */
export function extractIp(request: Request): string {
  const cf = request.headers.get('cf-connecting-ip');
  if (cf) return cf;
  const xff = request.headers.get('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0]?.trim();
    if (first) return first;
  }
  const xReal = request.headers.get('x-real-ip');
  if (xReal) return xReal;
  return 'unknown';
}
