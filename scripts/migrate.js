'use strict';
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const Database = require('better-sqlite3');

const dbPath = path.resolve(process.cwd(), 'data/auth.sqlite');
const migrationsDir = path.resolve(process.cwd(), 'drizzle');

const sqlite = new Database(dbPath);
sqlite.pragma('journal_mode = WAL');

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS __drizzle_migrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    hash TEXT NOT NULL,
    created_at INTEGER
  )
`);

const journal = JSON.parse(
  fs.readFileSync(path.join(migrationsDir, 'meta/_journal.json'), 'utf-8')
);

for (const entry of journal.entries) {
  const sqlFile = path.join(migrationsDir, `${entry.tag}.sql`);
  const sql = fs.readFileSync(sqlFile, 'utf-8');
  const hash = crypto.createHash('sha256').update(sql).digest('hex');

  const applied = sqlite.prepare('SELECT id FROM __drizzle_migrations WHERE hash = ?').get(hash);
  if (!applied) {
    sqlite.exec(sql);
    sqlite.prepare('INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)').run(hash, Date.now());
    console.log(`[migrate] applied: ${entry.tag}`);
  }
}

sqlite.close();
console.log('[startup] migrations complete');
