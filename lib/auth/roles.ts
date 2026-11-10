import type { ProviderName } from '@/lib/providers/types';

/**
 * Account roles and what each one may do. Pure functions only, so routes,
 * pages and tests can share one definition without touching the database.
 *
 * - admin: full access (every account that existed before roles).
 * - restricted: generates conclusions and structured reports with the local
 *   model only, sees only its own history, may vote in the A/B test, and may
 *   change its own password. It cannot send findings to hosted providers,
 *   store API keys, probe provider endpoints, or manage accounts.
 */
export const ROLES = ['admin', 'restricted'] as const;
export type Role = (typeof ROLES)[number];

/** Least-privileged role; used for any value the app does not recognise. */
export const DEFAULT_ROLE: Role = 'restricted';

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value);
}

/**
 * Whether findings may be sent to the given provider. Restricted accounts
 * stay on the on-host model so their input never leaves the server.
 */
export function canUseProvider(role: Role, provider: ProviderName): boolean {
  return role === 'admin' || provider === 'local';
}

/** Whether the account may read other accounts' generation history. */
export function canViewAllGenerations(role: Role): boolean {
  return role === 'admin';
}

/** Whether the account may store API keys and validate provider endpoints. */
export function canManageProviders(role: Role): boolean {
  return role === 'admin';
}

/** Whether the account may invite, suspend and reset other accounts. */
export function canManageAccounts(role: Role): boolean {
  return role === 'admin';
}

/**
 * Whether the account's generations and votes count toward the current
 * evaluation. Restricted accounts' data is still recorded, only left out.
 */
export function countsInEvaluation(role: Role): boolean {
  return role === 'admin';
}
