import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

/**
 * Users table — stores admin-provisioned accounts with argon2id-hashed passwords
 * and the account's role.
 * Email is stored lowercase/trimmed for case-insensitive uniqueness (enforced at app layer).
 */
export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  /**
   * Access level; see lib/auth/roles.ts for what each role may do.
   * Defaults to the least-privileged role so an account created without an
   * explicit role never gains admin rights. Migration 0005 promoted the
   * accounts that existed before roles were introduced to 'admin'.
   */
  role: text('role', { enum: ['admin', 'restricted'] }).notNull().default('restricted'),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  lastLoginAt: integer('last_login_at', { mode: 'timestamp' }),
  /** Set while the account is suspended; the guard and login refuse it. */
  disabledAt: integer('disabled_at', { mode: 'timestamp' }),
  /**
   * Sessions issued before this instant are rejected (password reset or
   * change). Millisecond precision to compare with SessionData.issuedAt.
   */
  sessionsValidAfter: integer('sessions_valid_after', { mode: 'timestamp_ms' }),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

/**
 * Per-user API keys table — stores encrypted API keys per provider per user.
 * encryptedKey is nullable to allow the local provider which needs no key.
 */
export const userApiKeys = sqliteTable(
  'user_api_keys',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    provider: text('provider').notNull(), // 'openai' | 'anthropic' | 'google' | 'local'
    encryptedKey: text('encrypted_key'), // nullable for local provider
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => ({
    userProviderUnique: uniqueIndex('user_provider_unique').on(t.userId, t.provider),
  })
);

export type UserApiKey = typeof userApiKeys.$inferSelect;
export type NewUserApiKey = typeof userApiKeys.$inferInsert;

/**
 * Generations table — durable record of every conclusion the app produces.
 *
 * Written server-side from /api/generate once a stream finishes, so a record
 * exists even if the browser navigates away or a follow-up request fails.
 * This is the source of truth for the review screen.
 *
 * A/B compare fires v1 and v2 for the same findings; both rows share a
 * `batchId` so the review screen can put them side by side.
 */
export const generations = sqliteTable(
  'generations',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    /** Shared by every conclusion generated from one user action. */
    batchId: text('batch_id').notNull(),
    /** Null-able so history outlives the account that produced it. */
    userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
    findings: text('findings').notNull(),
    /** Raw model output, before client-side post-processing. */
    conclusion: text('conclusion').notNull(),
    promptVersion: text('prompt_version').notNull(), // 'v1' | 'v2'
    /**
     * Registered prompt revision that produced this row ('r1', 'r2', ...), or
     * 'unregistered' when the prompt text was edited without adding an entry
     * to lib/prompts/revisions.ts. Null on rows written before versioning.
     */
    promptRevision: text('prompt_revision'),
    /** Short sha256 of the rendered prompt set - exact text identity. */
    promptHash: text('prompt_hash'),
    style: text('style').notNull(),
    lang: text('lang').notNull(),
    provider: text('provider').notNull(),
    model: text('model').notNull(),
    finishReason: text('finish_reason'),
    promptTokens: integer('prompt_tokens'),
    completionTokens: integer('completion_tokens'),
    /** Time to first token, milliseconds. Null when no token ever arrived. */
    ttftMs: integer('ttft_ms'),
    /** Full stream duration, milliseconds. */
    totalMs: integer('total_ms'),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => ({
    createdAtIdx: index('generations_created_at_idx').on(t.createdAt),
    batchIdIdx: index('generations_batch_id_idx').on(t.batchId),
  })
);

export type Generation = typeof generations.$inferSelect;
export type NewGeneration = typeof generations.$inferInsert;

/**
 * Structured reports table — durable record of every report the Structured
 * Report Generator produces (/api/structured-report/generate).
 *
 * Kept apart from `generations`: those rows carry conclusion-only columns
 * (style, promptVersion) and feed the conclusion review and eval tooling.
 *
 * `formState` keeps the raw form input next to the serialized `findings`, so
 * reports can be replayed after the serializer or the form fields change.
 */
export const structuredReports = sqliteTable(
  'structured_reports',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    /** Null-able so history outlives the account that produced it. */
    userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
    diseaseCategory: text('disease_category').notNull(), // 'RCC' | 'ProstateCancer' | 'UterineMyoma'
    modality: text('modality').notNull(), // 'CT' | 'MRI' | 'US' | 'Auto'
    lang: text('lang').notNull(),
    /** Serialized findings text exactly as sent to the model. */
    findings: text('findings').notNull(),
    /** JSON of the client form state. Null for non-browser callers. */
    formState: text('form_state'),
    /** Raw model output. */
    report: text('report').notNull(),
    /** Short sha256 of the rendered system prompt and user prompt template. */
    promptHash: text('prompt_hash').notNull(),
    provider: text('provider').notNull(),
    model: text('model').notNull(),
    finishReason: text('finish_reason'),
    promptTokens: integer('prompt_tokens'),
    completionTokens: integer('completion_tokens'),
    /** Time to first token, milliseconds. Null when no token ever arrived. */
    ttftMs: integer('ttft_ms'),
    /** Full stream duration, milliseconds. */
    totalMs: integer('total_ms'),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => ({
    createdAtIdx: index('structured_reports_created_at_idx').on(t.createdAt),
    diseaseIdx: index('structured_reports_disease_idx').on(t.diseaseCategory),
  })
);

export type StructuredReport = typeof structuredReports.$inferSelect;
export type NewStructuredReport = typeof structuredReports.$inferInsert;

/**
 * One-time account links an admin hands out: an invite creates a new account,
 * a reset sets a new password on an existing one. Only the sha256 of the
 * token is stored, so a leaked database cannot be turned back into links.
 */
export const accountLinks = sqliteTable(
  'account_links',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    kind: text('kind', { enum: ['invite', 'reset'] }).notNull(),
    tokenHash: text('token_hash').notNull().unique(),
    /** Invite only: the role the new account gets. */
    role: text('role', { enum: ['admin', 'restricted'] }),
    /** Invite only: who the link is meant for, as typed by the admin. */
    note: text('note'),
    /** Reset only: the account whose password the link sets. */
    targetUserId: integer('target_user_id').references(() => users.id, { onDelete: 'cascade' }),
    /** Invite only: the account created with the link. */
    usedByUserId: integer('used_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    createdBy: integer('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
    expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
    usedAt: integer('used_at', { mode: 'timestamp' }),
    revokedAt: integer('revoked_at', { mode: 'timestamp' }),
  },
  (t) => ({
    targetIdx: index('account_links_target_idx').on(t.targetUserId),
  })
);

export type AccountLink = typeof accountLinks.$inferSelect;
export type NewAccountLink = typeof accountLinks.$inferInsert;
