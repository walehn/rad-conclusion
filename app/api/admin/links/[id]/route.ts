import { NextResponse } from 'next/server';
import { requireAccountAdminApi } from '@/lib/auth/guard';
import { validateCsrfOrFail } from '@/lib/auth/csrf';
import { revokeLink } from '@/lib/auth/account-links';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * DELETE /api/admin/links/[id]
 * Revokes an unused link. 409 when it was already used or revoked.
 */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { response } = await requireAccountAdminApi();
  if (response) return response;

  const csrfFailure = await validateCsrfOrFail(req);
  if (csrfFailure) return csrfFailure;

  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }
  if (!revokeLink(id)) {
    return NextResponse.json({ error: '이미 사용됐거나 취소된 링크입니다' }, { status: 409 });
  }
  return new NextResponse(null, { status: 204 });
}
