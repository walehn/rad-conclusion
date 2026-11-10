import { redirect } from 'next/navigation';
import { NextResponse } from 'next/server';
import { getCurrentUser, type SessionData } from '@/lib/auth/session';
import { canManageAccounts, type Role } from '@/lib/auth/roles';
import { getUserRole } from '@/lib/auth/user-role';

/** Session payload plus the account's current role from the database. */
export interface AuthedUser extends SessionData {
  role: Role;
}

/**
 * Returns the signed-in account with its role, or null when there is no
 * valid session, or the account was deleted, suspended, or had its password
 * reset after this session was issued (such cookies must stop working).
 */
export async function getAuthedUser(): Promise<AuthedUser | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  const role = await getUserRole(user.userId, user.issuedAt);
  if (!role) return null;
  return { ...user, role };
}

/**
 * Server-component guard: redirects to /login?next=<currentPath> when unauthenticated.
 * The caller must supply the current path explicitly because Next.js does not
 * expose the request path to arbitrary server components.
 */
export async function requireSession(currentPath: string): Promise<AuthedUser> {
  const user = await getAuthedUser();
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
  { session: AuthedUser; response: null } | { session: null; response: NextResponse }
> {
  const user = await getAuthedUser();
  if (!user) {
    return {
      session: null,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }
  return { session: user, response: null };
}

/**
 * API-route guard for account administration: 401 without a session, 403 for
 * roles that may not manage accounts.
 */
export async function requireAccountAdminApi(): Promise<
  { session: AuthedUser; response: null } | { session: null; response: NextResponse }
> {
  const result = await requireApiSession();
  if (result.response) return result;
  if (!canManageAccounts(result.session.role)) return { session: null, response: forbiddenResponse() };
  return result;
}

/** 403 response for an authenticated account whose role does not allow the action. */
export function forbiddenResponse(): NextResponse {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}
