import { integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

/**
 * Users table — stores admin-provisioned accounts with argon2id-hashed passwords.
 * Email is stored lowercase/trimmed for case-insensitive uniqueness (enforced at app layer).
 */
export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  lastLoginAt: integer('last_login_at', { mode: 'timestamp' }),
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
