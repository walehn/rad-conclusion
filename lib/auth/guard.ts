import { redirect } from 'next/navigation';
import { NextResponse } from 'next/server';
import { getCurrentUser, type SessionData } from '@/lib/auth/session';

/**
 * Server-component guard: redirects to /login?next=<currentPath> when unauthenticated.
 * The caller must supply the current path explicitly because Next.js does not
 * expose the request path to arbitrary server components.
 */
export async function requireSession(currentPath: string): Promise<SessionData> {
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(currentPath)}`);
  }
  return user;
}

/**
 * API-route guard: returns either a session payload or a 401 NextResponse.
 * Callers should `if (result.response) return result.response;`.
 */
export async function requireApiSession(): Promise<
  { session: SessionData; response: null } | { session: null; response: NextResponse }
> {
  const user = await getCurrentUser();
  if (!user) {
    return {
      session: null,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }
  return { session: user, response: null };
}
