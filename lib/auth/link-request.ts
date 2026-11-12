import { NextResponse } from 'next/server';
import type { LinkKind, UnusableReason } from '@/lib/auth/account-links';
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

/** What the setup page shows for a link that cannot be used. */
export function unusableLinkMessage(reason: UnusableReason, kind: LinkKind | null): string {
  switch (reason) {
    case 'used':
      return kind === 'reset'
        ? '이미 사용된 비밀번호 재설정 링크입니다. 새 비밀번호를 정하셨다면 로그인 화면에서 로그인해 주세요.'
        : '이미 가입에 사용된 링크입니다. 이 링크로 가입하셨다면 로그인 화면에서 로그인해 주세요.';
    case 'expired':
      return '기한(48시간)이 지난 링크입니다. 관리자에게 새 링크를 요청해 주세요.';
    case 'revoked':
      return '취소된 링크입니다. 관리자가 취소했거나 새 링크로 바뀌었습니다. 새 링크를 받으셨다면 그 링크를 열어 주세요.';
    default:
      return INVALID_LINK_ERROR;
  }
}

/**
 * Counts a link that cannot be used against the caller and answers 404 with
 * the reason, so the page can say what to do next.
 */
export function unusableLink(
  request: Request,
  reason: UnusableReason = 'invalid',
  kind: LinkKind | null = null
): NextResponse {
  recordFailure(extractIp(request), linkAttempts);
  return NextResponse.json({ error: unusableLinkMessage(reason, kind), reason }, { status: 404 });
}

/** Counts an unknown or malformed token against the caller and answers 404. */
export function invalidLink(request: Request): NextResponse {
  return unusableLink(request, 'invalid', null);
}
