import { NextResponse } from 'next/server';
import { destroySession } from '@/lib/auth/session';
import { validateCsrfOrFail } from '@/lib/auth/csrf';

// Consistent with login route — keep auth endpoints on the Node.js runtime.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  const csrfFailure = await validateCsrfOrFail(request);
  if (csrfFailure) return csrfFailure;

  // Idempotent — safe to call even when no session is active.
  await destroySession();
  return NextResponse.json({ ok: true });
}
