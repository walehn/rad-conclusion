import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { DEFAULT_ROLE, isRole, type Role } from '@/lib/auth/roles';

/**
 * Looks up the account's current role. Read on every request rather than
 * stored in the session cookie, so a role change, suspension, password reset
 * or deletion takes effect immediately, and cookies issued before roles
 * existed keep working.
 *
 * Returns null — treat as signed out — when the account no longer exists, is
 * suspended, or `sessionIssuedAt` (ms) predates its last password reset. An
 * unrecognised stored role falls back to the least-privileged role.
 */
export async function getUserRole(
  userId: number,
  sessionIssuedAt?: number
): Promise<Role | null> {
  const rows = await db
    .select({
      role: users.role,
      disabledAt: users.disabledAt,
      sessionsValidAfter: users.sessionsValidAfter,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const row = rows[0];
  if (!row || row.disabledAt) return null;
  if (
    row.sessionsValidAfter &&
    (sessionIssuedAt === undefined || sessionIssuedAt < row.sessionsValidAfter.getTime())
  ) {
    return null;
  }
  return isRole(row.role) ? row.role : DEFAULT_ROLE;
}
