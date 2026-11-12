#!/usr/bin/env tsx
/**
 * Seed script: interactively provisions a new user in the auth SQLite DB.
 *
 * Usage:
 *   npx tsx scripts/seed-user.ts <identifier> [--role admin|restricted]
 *
 * - The role defaults to 'restricted' (see lib/auth/roles.ts); pass
 *   `--role admin` only for accounts that need full access.
 * - Prompts for password on stdin (echo suppressed).
 * - Requires password confirmation.
 * - Normalizes email (trim + lowercase) and rejects duplicates.
 * - Runs pending migrations before inserting (idempotent).
 * - Never logs the plaintext password or the stored hash.
 *
 * NOTE: imports `@/lib/db` (which imports `@/lib/db/schema`) and `@/lib/auth/password`
 * only. It does NOT import `@/lib/auth/session`, so `SESSION_SECRET` is not required
 * for seeding.
 */

import { createInterface } from 'node:readline';
import { eq } from 'drizzle-orm';
import { db, runMigrations } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { hashPassword } from '@/lib/auth/password';
import { DEFAULT_ROLE, isRole, ROLES, type Role } from '@/lib/auth/roles';
import {
  isValidUsername,
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
  normalizeUsername,
} from '@/lib/auth/account-rules';


/** Prints usage and exits non-zero. */
function printUsageAndExit(): never {
  process.stderr.write(
    'Usage: npx tsx scripts/seed-user.ts <identifier> [--role admin|restricted]\n' +
      '  <identifier>  Username or email (normalized: trim + lowercase)\n' +
      `  --role        Account role (default: ${DEFAULT_ROLE})\n`
  );
  process.exit(1);
}

/** Parses `<identifier> [--role <role>]`; exits with usage on anything else. */
function parseArgs(argv: string[]): { identifier: string; role: Role } {
  let identifier: string | undefined;
  let role: Role = DEFAULT_ROLE;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--role') {
      const value = argv[++i];
      if (!isRole(value)) {
        process.stderr.write(`--role must be one of: ${ROLES.join(', ')}\n`);
        process.exit(1);
      }
      role = value;
    } else if (arg.startsWith('-') || identifier !== undefined) {
      printUsageAndExit();
    } else {
      identifier = arg;
    }
  }
  if (!identifier) printUsageAndExit();
  return { identifier, role };
}

/**
 * Reads a single line from stdin with echo suppressed. Uses the readline
 * `_writeToOutput` override trick (no external deps).
 */
function readHiddenLine(prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
    });

    // Override the private output writer to swallow characters while the prompt
    // is active. We still need to write the prompt itself once.
    const rlAny = rl as unknown as {
      _writeToOutput: (stringToWrite: string) => void;
    };
    let promptWritten = false;
    rlAny._writeToOutput = (stringToWrite: string): void => {
      if (!promptWritten) {
        process.stdout.write(stringToWrite);
        promptWritten = true;
        return;
      }
      // Swallow keystroke echoes while typing the password.
      if (stringToWrite.includes('\n') || stringToWrite.includes('\r')) {
        process.stdout.write('\n');
      }
    };

    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer);
    });

    rl.on('error', reject);
  });
}


async function main(): Promise<void> {
  const { identifier: arg, role } = parseArgs(process.argv.slice(2));

  const email = normalizeUsername(arg);
  if (!isValidUsername(email)) {
    process.stderr.write(`Invalid identifier format: ${arg}\n`);
    process.exit(1);
  }

  // Apply any pending migrations first; this creates ./data/auth.sqlite and
  // the users table on the very first run.
  runMigrations();

  // Duplicate check.
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (existing.length > 0) {
    process.stderr.write(`User already exists: ${email}\n`);
    process.exit(1);
  }

  // Collect password twice.
  const password = await readHiddenLine('Password: ');
  if (password.length < MIN_PASSWORD_LENGTH) {
    process.stderr.write(
      `Password must be at least ${MIN_PASSWORD_LENGTH} characters.\n`
    );
    process.exit(1);
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    process.stderr.write(
      `Password must be at most ${MAX_PASSWORD_LENGTH} characters.\n`
    );
    process.exit(1);
  }
  const confirm = await readHiddenLine('Confirm password: ');
  if (password !== confirm) {
    process.stderr.write('Passwords do not match. Aborting.\n');
    process.exit(1);
  }

  // Hash and insert.
  const passwordHash = await hashPassword(password);
  const inserted = await db
    .insert(users)
    .values({ email, passwordHash, role, createdAt: new Date() })
    .returning({ id: users.id, email: users.email, role: users.role });

  const created = inserted[0];
  if (!created) {
    process.stderr.write('Insert returned no rows. Aborting.\n');
    process.exit(1);
  }

  // Success output — never include the password or hash.
  process.stdout.write(
    `User created: id=${created.id}, email=${created.email}, role=${created.role}\n`
  );
  process.exit(0);
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`seed-user failed: ${message}\n`);
  process.exit(1);
});
