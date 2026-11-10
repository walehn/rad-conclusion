import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { DEFAULT_ROLE, isRole, type Role } from '@/lib/auth/roles';

/**
 * Looks up the account's current role. Read on every request rather than
 * stored in the session cookie, so a role change or account deletion takes
 * effect immediately and cookies issued before roles existed keep working.
 *
 * Returns null when the account no longer exists. An unrecognised stored
 * value falls back to the least-privileged role.
 */
export async function getUserRole(userId: number): Promise<Role | null> {
  const rows = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return isRole(row.role) ? row.role : DEFAULT_ROLE;
}
