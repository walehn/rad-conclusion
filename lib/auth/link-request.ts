import { NextResponse } from 'next/server';
import { checkBeforeAttempt, extractIp, linkAttempts, recordFailure } from '@/lib/auth/rate-limit';

/**
 * Shared guard for the public account-link routes: they are reachable
 * without a session, so guessing tokens is throttled per IP.
 */
export const INVALID_LINK_ERROR = '유효하지 않거나 만료된 링크입니다';

export function linkRateLimited(request: Request): NextResponse | null {
  const check = checkBeforeAttempt(extractIp(request), linkAttempts);
  if (check.allowed) return null;
  return NextResponse.json(
    { error: '시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.' },
    { status: 429, headers: { 'Retry-After': String(check.retryAfterSeconds) } }
  );
}

/** Counts an unknown/used/expired token against the caller and answers 404. */
export function invalidLink(request: Request): NextResponse {
  recordFailure(extractIp(request), linkAttempts);
  return NextResponse.json({ error: INVALID_LINK_ERROR }, { status: 404 });
}
