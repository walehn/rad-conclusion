import { NextResponse } from 'next/server';
import { z } from 'zod';
import { validateCsrfOrFail } from '@/lib/auth/csrf';
import { checkLink } from '@/lib/auth/account-links';
import { invalidLink, linkRateLimited, unusableLink } from '@/lib/auth/link-request';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({ token: z.string().min(1).max(200) });

/**
 * POST /api/account-links/inspect  { token }
 * Tells the setup page what a link is for. The token is sent in the body,
 * never in the URL, so it does not reach access logs.
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

  const check = checkLink(parsed.data.token);
  if (!check.ok) return unusableLink(req, check.reason, check.kind);
  const { info } = check;
  return NextResponse.json({
    kind: info.kind,
    expiresAt: info.expiresAt.toISOString(),
    username: info.username,
  });
}
