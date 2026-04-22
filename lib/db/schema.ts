import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

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
