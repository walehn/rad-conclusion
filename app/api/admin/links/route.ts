import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAccountAdminApi } from '@/lib/auth/guard';
import { validateCsrfOrFail } from '@/lib/auth/csrf';
import { createInvite, createResetLink } from '@/lib/auth/account-links';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('invite'), note: z.string().trim().max(200).optional() }),
  z.object({ kind: z.literal('reset'), userId: z.number().int().positive() }),
]);

/**
 * POST /api/admin/links
 * Creates an invite ({kind:'invite', note}) or a password-reset link
 * ({kind:'reset', userId}). The token is returned once here and never again;
 * the client builds the URL with the token in the fragment.
 */
export async function POST(req: Request) {
  const { session, response } = await requireAccountAdminApi();
  if (response) return response;

  const csrfFailure = await validateCsrfOrFail(req);
  if (csrfFailure) return csrfFailure;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }

  if (parsed.data.kind === 'invite') {
    const link = createInvite({ createdBy: session.userId, note: parsed.data.note || null });
    return NextResponse.json(
      { id: link.id, token: link.token, expiresAt: link.expiresAt.toISOString() },
      { status: 201 }
    );
  }

  const result = createResetLink({ createdBy: session.userId, userId: parsed.data.userId });
  if (!result.ok) {
    return NextResponse.json(
      { error: result.reason === 'disabled' ? '정지된 계정입니다' : '계정을 찾을 수 없습니다' },
      { status: result.reason === 'disabled' ? 409 : 404 }
    );
  }
  return NextResponse.json(
    { id: result.id, token: result.token, expiresAt: result.expiresAt.toISOString() },
    { status: 201 }
  );
}
