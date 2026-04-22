import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from '@/lib/db/schema';

/**
 * Creates an ephemeral in-memory SQLite database with the users table schema
 * applied. The schema here MUST stay in sync with ./drizzle/0000_previous_cable.sql.
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
      created_at INTEGER NOT NULL,
      last_login_at INTEGER
    );
    CREATE UNIQUE INDEX users_email_unique ON users (email);
  `);
  const db = drizzle(sqlite, { schema });
  return { db, sqlite };
}
