import { readFileSync } from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from '@/lib/db/schema';

/**
 * Creates an ephemeral in-memory SQLite database with every ./drizzle
 * migration applied, so tests always see the real schema (users, roles,
 * account links, ...) without a filesystem database.
 */
export function createTestDb(): {
  db: BetterSQLite3Database<typeof schema>;
  sqlite: Database.Database;
} {
  const sqlite = new Database(':memory:');
  applyMigrations(sqlite);
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
