import { readFileSync } from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from '@/lib/db/schema';

/**
 * Creates an ephemeral in-memory SQLite database with the users table schema
 * applied. The schema here MUST stay in sync with ./drizzle/0000_previous_cable.sql
 * plus the role column from ./drizzle/0005_user_role.sql.
 * We avoid running the migrator (which needs a filesystem snapshot directory)
 * and just exec the CREATE TABLE statements directly — this is faster and
 * keeps tests hermetic.
 */
export function createTestDb(): {
  db: BetterSQLite3Database<typeof schema>;
  sqlite: Database.Database;
} {
  const sqlite = new Database(':memory:');
  sqlite.exec(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      email TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'restricted' NOT NULL,
      created_at INTEGER NOT NULL,
      last_login_at INTEGER
    );
    CREATE UNIQUE INDEX users_email_unique ON users (email);
  `);
  const db = drizzle(sqlite, { schema });
  return { db, sqlite };
}

/**
 * Applies the real ./drizzle migrations to a raw connection, in journal order.
 * `from` starts at the named tag and `before` stops ahead of one, so a test
 * can build the schema as it was before a migration, insert rows, and then
 * apply just the rest — the way a deployed database is upgraded.
 */
export function applyMigrations(
  sqlite: Database.Database,
  range: { from?: string; before?: string } = {}
): void {
  const dir = path.resolve(__dirname, '../../drizzle');
  const journal = JSON.parse(readFileSync(path.join(dir, 'meta/_journal.json'), 'utf-8')) as {
    entries: { tag: string }[];
  };
  let started = range.from === undefined;
  for (const { tag } of journal.entries) {
    if (tag === range.before) return;
    if (tag === range.from) started = true;
    if (started) sqlite.exec(readFileSync(path.join(dir, `${tag}.sql`), 'utf-8'));
  }
}
