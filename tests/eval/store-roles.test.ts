import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { loadGenerations } from '@/lib/eval/store';
import { applyMigrations } from '../helpers/test-db';

// Restricted accounts' generations are recorded like any other but left out
// of evaluation unless explicitly asked for.

function seed(sqlite: Database.Database, withRoles: boolean): void {
  const addUser = sqlite.prepare(
    withRoles
      ? 'INSERT INTO users (id, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, 0)'
      : 'INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, 0)'
  );
  if (withRoles) {
    addUser.run(1, 'admin', 'x', 'admin');
    addUser.run(2, 'restricted', 'x', 'restricted');
  } else {
    addUser.run(1, 'admin', 'x');
    addUser.run(2, 'other', 'x');
  }
  const addGen = sqlite.prepare(
    `INSERT INTO generations (id, batch_id, user_id, findings, conclusion, prompt_version,
       style, lang, provider, model, created_at)
     VALUES (?, ?, ?, 'f', 'c', 'v1', 'numbered', 'en', 'local', 'm', 0)`
  );
  addGen.run(1, 'a', 1);
  addGen.run(2, 'b', 2);
  addGen.run(3, 'c', null); // account deleted
}

const ids = (gens: { id: number }[]) => gens.map((g) => g.id);

describe('loadGenerations and roles', () => {
  it('keeps only admin accounts by default', () => {
    const sqlite = new Database(':memory:');
    applyMigrations(sqlite);
    seed(sqlite, true);
    expect(ids(loadGenerations(sqlite))).toEqual([1]);
  });

  it('returns every row when includeNonEvaluated is set', () => {
    const sqlite = new Database(':memory:');
    applyMigrations(sqlite);
    seed(sqlite, true);
    expect(ids(loadGenerations(sqlite, { includeNonEvaluated: true }))).toEqual([1, 2, 3]);
  });

  it('applies the role filter together with an id filter', () => {
    const sqlite = new Database(':memory:');
    applyMigrations(sqlite);
    seed(sqlite, true);
    expect(ids(loadGenerations(sqlite, { ids: [1, 2] }))).toEqual([1]);
  });

  it('does not filter a database from before roles existed', () => {
    const sqlite = new Database(':memory:');
    applyMigrations(sqlite, { before: '0005_user_role' });
    seed(sqlite, false);
    expect(ids(loadGenerations(sqlite))).toEqual([1, 2, 3]);
  });
});
