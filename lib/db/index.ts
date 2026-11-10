import { mkdirSync } from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from '@/lib/db/schema';

// Opening this module from a test would touch the live data/auth.sqlite of
// whatever checkout the tests run from. Tests must vi.mock('@/lib/db') with an
// in-memory database instead (see tests/helpers/test-db.ts).
if (process.env.VITEST) {
  throw new Error(
    "@/lib/db was imported unmocked under Vitest; mock it with an in-memory database"
  );
}

const dataDir = path.resolve(process.cwd(), 'data');
const dbPath = path.resolve(dataDir, 'auth.sqlite');

// Ensure ./data directory exists before opening the SQLite file.
mkdirSync(dataDir, { recursive: true });

const sqlite = new Database(dbPath);
// Enable WAL for better concurrent read/write behavior.
sqlite.pragma('journal_mode = WAL');

/**
 * Drizzle ORM instance bound to the local SQLite file.
 * Import this singleton; never instantiate another connection per request.
 */
export const db = drizzle(sqlite, { schema });

/**
 * Applies pending drizzle migrations from ./drizzle. Invoke from a setup script
 * (e.g., `npm run db:migrate`) — not during request handling.
 */
export function runMigrations(): void {
  const migrationsFolder = path.resolve(process.cwd(), 'drizzle');
  migrate(db, { migrationsFolder });
}
