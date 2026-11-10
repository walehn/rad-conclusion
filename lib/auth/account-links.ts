import { createHash, randomBytes } from 'node:crypto';
import { and, eq, isNull } from 'drizzle-orm';
import { db } from '@/lib/db';
import { accountLinks, users, type AccountLink } from '@/lib/db/schema';
import type { Role } from '@/lib/auth/roles';

/**
 * One-time account links: invites create a new restricted account, resets set
 * a new password on an existing one. The token travels only in the URL
 * fragment (never sent to the server or Cloudflare in the request line) and
 * is stored as its sha256, so neither access logs nor the database hold a
 * usable link.
 */

/** How long a link stays usable after it is created. */
export const LINK_TTL_MS = 48 * 60 * 60 * 1000;

/** Invites never grant more than this; admin accounts come from the seed script. */
export const INVITE_ROLE: Role = 'restricted';

export type LinkKind = AccountLink['kind'];
export type LinkStatus = 'pending' | 'used' | 'expired' | 'revoked';

export function generateLinkToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashLinkToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function linkStatus(link: Pick<AccountLink, 'usedAt' | 'revokedAt' | 'expiresAt'>, now: Date): LinkStatus {
  if (link.usedAt) return 'used';
  if (link.revokedAt) return 'revoked';
  if (link.expiresAt.getTime() <= now.getTime()) return 'expired';
  return 'pending';
}

export interface CreatedLink {
  id: number;
  token: string;
  expiresAt: Date;
}

/** Creates an invite for a new restricted account. */
export function createInvite(opts: { createdBy: number; note: string | null; now?: Date }): CreatedLink {
  const now = opts.now ?? new Date();
  const token = generateLinkToken();
  const expiresAt = new Date(now.getTime() + LINK_TTL_MS);
  const row = db
    .insert(accountLinks)
    .values({
      kind: 'invite',
      tokenHash: hashLinkToken(token),
      role: INVITE_ROLE,
      note: opts.note,
      createdBy: opts.createdBy,
      createdAt: now,
      expiresAt,
    })
    .returning({ id: accountLinks.id })
    .get();
  return { id: row.id, token, expiresAt };
}

export type CreateResetResult =
  | ({ ok: true } & CreatedLink)
  | { ok: false; reason: 'no-account' | 'disabled' };

/**
 * Creates a password-reset link for an active account. Any earlier unused
 * reset link for the same account is revoked, so only the newest one works.
 */
export function createResetLink(opts: { createdBy: number; userId: number; now?: Date }): CreateResetResult {
  const now = opts.now ?? new Date();
  return db.transaction((tx) => {
    const target = tx
      .select({ id: users.id, disabledAt: users.disabledAt })
      .from(users)
      .where(eq(users.id, opts.userId))
      .get();
    if (!target) return { ok: false as const, reason: 'no-account' as const };
    if (target.disabledAt) return { ok: false as const, reason: 'disabled' as const };

    tx.update(accountLinks)
      .set({ revokedAt: now })
      .where(
        and(
          eq(accountLinks.kind, 'reset'),
          eq(accountLinks.targetUserId, opts.userId),
          isNull(accountLinks.usedAt),
          isNull(accountLinks.revokedAt)
        )
      )
      .run();

    const token = generateLinkToken();
    const expiresAt = new Date(now.getTime() + LINK_TTL_MS);
    const row = tx
      .insert(accountLinks)
      .values({
        kind: 'reset',
        tokenHash: hashLinkToken(token),
        targetUserId: opts.userId,
        createdBy: opts.createdBy,
        createdAt: now,
        expiresAt,
      })
      .returning({ id: accountLinks.id })
      .get();
    return { ok: true as const, id: row.id, token, expiresAt };
  });
}

/** Revokes an unused link. Returns false when it was already used or revoked. */
export function revokeLink(id: number, now: Date = new Date()): boolean {
  const result = db
    .update(accountLinks)
    .set({ revokedAt: now })
    .where(and(eq(accountLinks.id, id), isNull(accountLinks.usedAt), isNull(accountLinks.revokedAt)))
    .run();
  return result.changes === 1;
}

export interface LinkInfo {
  kind: LinkKind;
  expiresAt: Date;
  /** Reset only: the account whose password will be set. */
  username: string | null;
}

/** Describes a usable link, or null for an unknown, used, revoked or expired one. */
export function inspectLink(token: string, now: Date = new Date()): LinkInfo | null {
  const link = db
    .select()
    .from(accountLinks)
    .where(eq(accountLinks.tokenHash, hashLinkToken(token)))
    .get();
  if (!link || linkStatus(link, now) !== 'pending') return null;
  if (link.kind === 'invite') return { kind: 'invite', expiresAt: link.expiresAt, username: null };

  const target = link.targetUserId
    ? db
        .select({ email: users.email, disabledAt: users.disabledAt })
        .from(users)
        .where(eq(users.id, link.targetUserId))
        .get()
    : undefined;
  if (!target || target.disabledAt) return null;
  return { kind: 'reset', expiresAt: link.expiresAt, username: target.email };
}

export type RedeemResult =
  | { ok: true; userId: number; username: string }
  | { ok: false; reason: 'invalid' | 'taken' };

/** Thrown inside a transaction to roll it back when a concurrent redeem won. */
class LinkAlreadyUsed extends Error {}

function usableLink(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  token: string,
  kind: LinkKind,
  now: Date
): AccountLink | null {
  const link = tx
    .select()
    .from(accountLinks)
    .where(and(eq(accountLinks.tokenHash, hashLinkToken(token)), eq(accountLinks.kind, kind)))
    .get();
  return link && linkStatus(link, now) === 'pending' ? link : null;
}

/**
 * Creates the invited account and marks the invite used, atomically.
 * `username` must already be normalized and validated; `passwordHash` is the
 * argon2id hash of the chosen password.
 */
export function redeemInvite(opts: {
  token: string;
  username: string;
  passwordHash: string;
  now?: Date;
}): RedeemResult {
  const now = opts.now ?? new Date();
  try {
    return db.transaction((tx) => {
      const link = usableLink(tx, opts.token, 'invite', now);
      if (!link) return { ok: false as const, reason: 'invalid' as const };

      const existing = tx.select({ id: users.id }).from(users).where(eq(users.email, opts.username)).get();
      if (existing) return { ok: false as const, reason: 'taken' as const };

      const created = tx
        .insert(users)
        .values({
          email: opts.username,
          passwordHash: opts.passwordHash,
          role: link.role ?? INVITE_ROLE,
          createdAt: now,
        })
        .returning({ id: users.id })
        .get();

      const marked = tx
        .update(accountLinks)
        .set({ usedAt: now, usedByUserId: created.id })
        .where(and(eq(accountLinks.id, link.id), isNull(accountLinks.usedAt)))
        .run();
      if (marked.changes !== 1) throw new LinkAlreadyUsed();

      return { ok: true as const, userId: created.id, username: opts.username };
    });
  } catch (err) {
    if (err instanceof LinkAlreadyUsed) return { ok: false, reason: 'invalid' };
    throw err;
  }
}

/**
 * Sets the new password, ends every existing session of the account, and
 * marks the reset link used, atomically.
 */
export function redeemReset(opts: { token: string; passwordHash: string; now?: Date }): RedeemResult {
  const now = opts.now ?? new Date();
  try {
    return db.transaction((tx) => {
      const link = usableLink(tx, opts.token, 'reset', now);
      if (!link || !link.targetUserId) return { ok: false as const, reason: 'invalid' as const };

      const target = tx
        .select({ id: users.id, email: users.email, disabledAt: users.disabledAt })
        .from(users)
        .where(eq(users.id, link.targetUserId))
        .get();
      if (!target || target.disabledAt) return { ok: false as const, reason: 'invalid' as const };

      tx.update(users)
        .set({ passwordHash: opts.passwordHash, sessionsValidAfter: now })
        .where(eq(users.id, target.id))
        .run();

      const marked = tx
        .update(accountLinks)
        .set({ usedAt: now })
        .where(and(eq(accountLinks.id, link.id), isNull(accountLinks.usedAt)))
        .run();
      if (marked.changes !== 1) throw new LinkAlreadyUsed();

      return { ok: true as const, userId: target.id, username: target.email };
    });
  } catch (err) {
    if (err instanceof LinkAlreadyUsed) return { ok: false, reason: 'invalid' };
    throw err;
  }
}
