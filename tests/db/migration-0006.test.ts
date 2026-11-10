import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { applyMigrations } from '../helpers/test-db';

describe('migration 0006_account_links', () => {
  it('leaves existing accounts active with no session cutoff', () => {
    const sqlite = new Database(':memory:');
    applyMigrations(sqlite, { before: '0006_account_links' });
    sqlite.prepare("INSERT INTO users (email, password_hash, role, created_at) VALUES ('a', 'x', 'admin', 0)").run();
    applyMigrations(sqlite, { from: '0006_account_links' });
    expect(sqlite.prepare("SELECT role, disabled_at, sessions_valid_after FROM users WHERE email = 'a'").get()).toEqual({
      role: 'admin',
      disabled_at: null,
      sessions_valid_after: null,
    });
  });

  it('enforces unique token hashes', () => {
    const sqlite = new Database(':memory:');
    applyMigrations(sqlite);
    const add = sqlite.prepare(
      "INSERT INTO account_links (kind, token_hash, created_at, expires_at) VALUES ('invite', 'h', 0, 1)"
    );
    add.run();
    expect(() => add.run()).toThrow(/UNIQUE/);
  });
});
