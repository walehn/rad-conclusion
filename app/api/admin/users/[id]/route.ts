import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { requireAccountAdminApi } from '@/lib/auth/guard';
import { validateCsrfOrFail } from '@/lib/auth/csrf';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({ disabled: z.boolean() });

/**
 * PATCH /api/admin/users/[id]  { disabled: boolean }
 * Suspends or reinstates an account. A suspended account cannot sign in and
 * its open sessions stop working at once; its history is kept. An admin
 * cannot suspend their own account (that would lock them out).
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireAccountAdminApi();
  if (response) return response;

  const csrfFailure = await validateCsrfOrFail(req);
  if (csrfFailure) return csrfFailure;

  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

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

  if (id === session.userId && parsed.data.disabled) {
    return NextResponse.json({ error: '자기 계정은 정지할 수 없습니다' }, { status: 409 });
  }

  const result = db
    .update(users)
    .set({ disabledAt: parsed.data.disabled ? new Date() : null })
    .where(eq(users.id, id))
    .run();
  if (result.changes !== 1) {
    return NextResponse.json({ error: '계정을 찾을 수 없습니다' }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
