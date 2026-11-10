/**
 * Account name and password rules, shared by the seed script, the invite
 * page and password changes so every path accepts the same values.
 */
export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 1024;
export const MAX_USERNAME_LENGTH = 254;

// Plain usernames (e.g. "cmcabdomen") and email addresses. A safe subset, so
// no whitespace, control characters or look-alike surprises.
const USERNAME_REGEX = /^[a-z0-9._@+-]+$/;

/** Usernames are stored trimmed and lowercase for case-insensitive uniqueness. */
export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

/** Checks an already-normalized username. */
export function isValidUsername(username: string): boolean {
  return (
    username.length > 0 &&
    username.length <= MAX_USERNAME_LENGTH &&
    USERNAME_REGEX.test(username)
  );
}
