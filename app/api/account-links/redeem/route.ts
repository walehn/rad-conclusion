import { NextResponse } from 'next/server';
import { z } from 'zod';
import { validateCsrfOrFail } from '@/lib/auth/csrf';
import { hashPassword } from '@/lib/auth/password';
import { inspectLink, redeemInvite, redeemReset } from '@/lib/auth/account-links';
import {
  isValidUsername,
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
  normalizeUsername,
} from '@/lib/auth/account-rules';
import { invalidLink, linkRateLimited } from '@/lib/auth/link-request';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  token: z.string().min(1).max(200),
  /** Invite only; ignored for a reset link. */
  username: z.string().max(300).optional(),
  password: z.string(),
});

/**
 * POST /api/account-links/redeem  { token, username?, password }
 * Invite: creates the account with the chosen username (restricted role).
 * Reset: sets the new password and ends the account's other sessions.
 * Either way the link is used up; the caller then signs in normally.
 */
export async function POST(req: Request) {
  const limited = linkRateLimited(req);
  if (limited) return limited;

  const csrfFailure = await validateCsrfOrFail(req);
  if (csrfFailure) return csrfFailure;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return invalidLink(req);
  const { token, password } = parsed.data;

  // Cheap check first so a bad token never costs an argon2 hash.
  const info = inspectLink(token);
  if (!info) return invalidLink(req);

  if (password.length < MIN_PASSWORD_LENGTH || password.length > MAX_PASSWORD_LENGTH) {
    return NextResponse.json(
      { error: `비밀번호는 ${MIN_PASSWORD_LENGTH}자 이상이어야 합니다` },
      { status: 400 }
    );
  }

  if (info.kind === 'invite') {
    const username = normalizeUsername(parsed.data.username ?? '');
    if (!isValidUsername(username)) {
      return NextResponse.json(
        { error: '아이디는 영문 소문자, 숫자와 . _ @ + - 만 쓸 수 있습니다' },
        { status: 400 }
      );
    }
    const result = redeemInvite({ token, username, passwordHash: await hashPassword(password) });
    if (!result.ok) {
      if (result.reason === 'taken') {
        return NextResponse.json({ error: '이미 쓰고 있는 아이디입니다' }, { status: 409 });
      }
      return invalidLink(req);
    }
    return NextResponse.json({ ok: true, kind: 'invite', username: result.username });
  }

  const result = redeemReset({ token, passwordHash: await hashPassword(password) });
  if (!result.ok) return invalidLink(req);
  return NextResponse.json({ ok: true, kind: 'reset', username: result.username });
}
