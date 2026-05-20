import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { hashPassword, verifyPassword } from '@/lib/auth/password';
import { getCurrentUser } from '@/lib/auth/session';
import { validateCsrfOrFail } from '@/lib/auth/csrf';

// Native modules (@node-rs/argon2, better-sqlite3) forbid Edge runtime.
export const runtime = 'nodejs';
// Mutating endpoint must never be cached.
export const dynamic = 'force-dynamic';

const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 1024;

const schema = z.object({
  currentPassword: z.string().min(1).max(MAX_PASSWORD_LENGTH),
  newPassword: z.string().min(MIN_PASSWORD_LENGTH).max(MAX_PASSWORD_LENGTH),
});

export async function POST(request: Request): Promise<Response> {
  // 1. Session gate. Unlike /login this endpoint is protected by an existing
  //    session, so we can attribute the request to a specific user_id without
  //    trusting any field in the request body.
  const session = await getCurrentUser();
  if (!session) {
    return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });
  }

  // 2. CSRF + Origin guard (same pattern as /api/auth/login).
  const csrfFailure = await validateCsrfOrFail(request);
  if (csrfFailure) return csrfFailure;

  // 3. Parse and validate input.
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    if (issue?.path[0] === 'newPassword' && issue.code === 'too_small') {
      return NextResponse.json(
        {
          error: `새 비밀번호는 ${MIN_PASSWORD_LENGTH}자 이상이어야 합니다`,
        },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }
  const { currentPassword, newPassword } = parsed.data;

  if (currentPassword === newPassword) {
    return NextResponse.json(
      { error: '새 비밀번호는 현재 비밀번호와 달라야 합니다' },
      { status: 400 }
    );
  }

  // 4. Fetch the authenticated user's row.
  const rows = await db
    .select()
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);
  const user = rows[0];
  if (!user) {
    // Session is signed/encrypted, so this branch only fires if the user row
    // was deleted out of band. Treat as session invalidation.
    return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });
  }

  // 5. Verify current password against the stored argon2id hash.
  const ok = await verifyPassword(currentPassword, user.passwordHash);
  if (!ok) {
    return NextResponse.json(
      { error: '현재 비밀번호가 일치하지 않습니다' },
      { status: 401 }
    );
  }

  // 6. Hash and persist the new password. Session cookie stays valid — the
  //    iron-session payload does not carry the password and the existing
  //    cookie is still authentic for this user_id.
  const newHash = await hashPassword(newPassword);
  await db
    .update(users)
    .set({ passwordHash: newHash })
    .where(eq(users.id, user.id));

  return NextResponse.json({ ok: true });
}
