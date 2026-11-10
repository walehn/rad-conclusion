import { desc } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { accountLinks, users } from '@/lib/db/schema';
import { requireAccountAdminApi } from '@/lib/auth/guard';
import { linkStatus } from '@/lib/auth/account-links';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** How many past links the admin page lists; pending ones are always shown. */
const RECENT_LINKS = 50;

/**
 * GET /api/admin/accounts
 * Accounts and account links for the admin page. Never returns password
 * hashes or link token hashes.
 */
export async function GET() {
  const { response } = await requireAccountAdminApi();
  if (response) return response;

  const now = new Date();
  const userRows = db.select().from(users).orderBy(users.id).all();
  const linkRows = db.select().from(accountLinks).orderBy(desc(accountLinks.id)).all();
  const nameById = new Map(userRows.map((u) => [u.id, u.email]));
  const invitedBy = new Map<number, number | null>();
  for (const l of linkRows) {
    if (l.kind === 'invite' && l.usedByUserId) invitedBy.set(l.usedByUserId, l.createdBy);
  }

  const links = linkRows
    .map((l) => ({
      id: l.id,
      kind: l.kind,
      status: linkStatus(l, now),
      note: l.note,
      target: l.targetUserId ? (nameById.get(l.targetUserId) ?? null) : null,
      usedBy: l.usedByUserId ? (nameById.get(l.usedByUserId) ?? null) : null,
      createdBy: l.createdBy ? (nameById.get(l.createdBy) ?? null) : null,
      createdAt: l.createdAt.toISOString(),
      expiresAt: l.expiresAt.toISOString(),
      usedAt: l.usedAt?.toISOString() ?? null,
    }))
    .filter((l, i) => l.status === 'pending' || i < RECENT_LINKS);

  return NextResponse.json({
    users: userRows.map((u) => {
      const inviter = invitedBy.get(u.id);
      return {
        id: u.id,
        username: u.email,
        role: u.role,
        createdAt: u.createdAt.toISOString(),
        lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
        disabledAt: u.disabledAt?.toISOString() ?? null,
        invitedBy: inviter ? (nameById.get(inviter) ?? null) : null,
      };
    }),
    links,
  });
}
