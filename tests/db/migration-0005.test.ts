import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { applyMigrations } from '../helpers/test-db';

// 0005 adds users.role. Accounts that exist when it runs were all provisioned
// as admins and must keep full access; later accounts default to restricted.

const TAG = '0005_user_role';

function insertUser(sqlite: Database.Database, email: string): void {
  sqlite
    .prepare('INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?)')
    .run(email, 'hash', 0);
}

function roleOf(sqlite: Database.Database, email: string): string {
  return (sqlite.prepare('SELECT role FROM users WHERE email = ?').get(email) as { role: string })
    .role;
}

describe(`migration ${TAG}`, () => {
  it('promotes accounts that existed before it to admin', () => {
    const sqlite = new Database(':memory:');
    applyMigrations(sqlite, { before: TAG });
    insertUser(sqlite, 'first');
    insertUser(sqlite, 'second');

    applyMigrations(sqlite, { from: TAG });

    expect(roleOf(sqlite, 'first')).toBe('admin');
    expect(roleOf(sqlite, 'second')).toBe('admin');
  });

  it('gives accounts created afterwards the restricted default', () => {
    const sqlite = new Database(':memory:');
    applyMigrations(sqlite, { before: TAG });
    insertUser(sqlite, 'existing');
    applyMigrations(sqlite, { from: TAG });

    insertUser(sqlite, 'new');

    expect(roleOf(sqlite, 'existing')).toBe('admin');
    expect(roleOf(sqlite, 'new')).toBe('restricted');
  });

  it('works on an empty database', () => {
    const sqlite = new Database(':memory:');
    applyMigrations(sqlite);
    insertUser(sqlite, 'only');
    expect(roleOf(sqlite, 'only')).toBe('restricted');
  });
});
