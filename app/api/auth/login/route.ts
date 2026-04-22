import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { DUMMY_HASH, verifyPassword } from '@/lib/auth/password';
import { issueSession } from '@/lib/auth/session';
import {
  checkBeforeAttempt,
  emailAttempts,
  extractIp,
  ipAttempts,
  recordFailure,
  resetOnSuccess,
} from '@/lib/auth/rate-limit';
import { validateCsrfOrFail } from '@/lib/auth/csrf';

// Native modules (@node-rs/argon2, better-sqlite3) forbid Edge runtime.
export const runtime = 'nodejs';
// Login must never be cached.
export const dynamic = 'force-dynamic';

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(1024),
  next: z.string().optional(),
});

/**
 * Sanitizes a post-login redirect target: must be a same-origin path. Rejects
 * protocol-relative (`//evil`) and backslash-tricks (`/\\evil`), falling back to `/`.
 */
function sanitizeNext(next: string | undefined): string {
  if (!next || typeof next !== 'string') return '/';
  if (!next.startsWith('/')) return '/';
  if (next.startsWith('//') || next.startsWith('/\\')) return '/';
  return next;
}

const GENERIC_AUTH_ERROR = '이메일 또는 비밀번호가 올바르지 않습니다';

export async function POST(request: Request): Promise<Response> {
  // 1. Parse and validate input (do not leak which field failed).
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }
  const { email, password, next } = parsed.data;

  // 2. Pre-check rate limits BEFORE expensive work (argon2 verify).
  const ip = extractIp(request);
  const ipCheck = checkBeforeAttempt(ip, ipAttempts);
  if (!ipCheck.allowed) {
    return NextResponse.json(
      { error: GENERIC_AUTH_ERROR },
      {
        status: 429,
        headers: { 'Retry-After': String(ipCheck.retryAfterSeconds) },
      }
    );
  }
  const emailCheck = checkBeforeAttempt(email, emailAttempts);
  if (!emailCheck.allowed) {
    return NextResponse.json(
      { error: GENERIC_AUTH_ERROR },
      {
        status: 429,
        headers: { 'Retry-After': String(emailCheck.retryAfterSeconds) },
      }
    );
  }

  // 3. CSRF validation. Per AC-06, CSRF failure does NOT increment counters.
  const csrfFailure = await validateCsrfOrFail(request);
  if (csrfFailure) return csrfFailure;

  // 4. Lookup user by normalized email.
  const rows = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  const user = rows[0];

  // 5. Always run verifyPassword against either the real hash or DUMMY_HASH to
  // flatten response timing (EC-04: prevent user-enumeration via timing).
  const hashToCheck = user?.passwordHash ?? DUMMY_HASH;
  const passwordMatches = await verifyPassword(password, hashToCheck);

  if (user && passwordMatches) {
    // Success: issue session, update last_login_at, clear rate-limit state.
    await issueSession(user.id, user.email);
    await db
      .update(users)
      .set({ lastLoginAt: new Date() })
      .where(eq(users.id, user.id));
    resetOnSuccess(ip, ipAttempts);
    resetOnSuccess(email, emailAttempts);
    return NextResponse.json({ ok: true, redirectTo: sanitizeNext(next) });
  }

  // 6. Failure: record in rate-limiter, return generic 401.
  recordFailure(ip, ipAttempts);
  recordFailure(email, emailAttempts);
  return NextResponse.json({ error: GENERIC_AUTH_ERROR }, { status: 401 });
}
