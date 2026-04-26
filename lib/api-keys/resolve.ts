import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db/index';
import { userApiKeys } from '@/lib/db/schema';
import { decryptApiKey } from '@/lib/crypto/api-key-crypto';
import type { ProviderName } from '@/lib/providers/types';

/**
 * Resolves the API key for a given user and provider.
 *
 * Resolution order:
 * 1. User's stored encrypted key in the database (decrypted on-the-fly)
 * 2. Fallback to environment variable for the provider
 * 3. null for local provider (no key needed) or if no key is found
 */
export async function resolveApiKey(
  userId: number,
  provider: ProviderName
): Promise<string | null> {
  // Local provider needs no API key; skip DB lookup so this works even when
  // the user_api_keys migration has not been applied.
  if (provider === 'local') {
    return null;
  }

  // 1. Look up user's stored key
  const rows = await db
    .select()
    .from(userApiKeys)
    .where(
      and(
        eq(userApiKeys.userId, userId),
        eq(userApiKeys.provider, provider)
      )
    )
    .limit(1);

  const row = rows[0];
  if (row && row.encryptedKey) {
    return decryptApiKey(row.encryptedKey);
  }

  // 2. Fallback to environment variables
  switch (provider) {
    case 'openai':
      return process.env.OPENAI_API_KEY ?? null;
    case 'anthropic':
      return process.env.ANTHROPIC_API_KEY ?? null;
    case 'google':
      return process.env.GOOGLE_AI_API_KEY ?? null;
    default:
      return null;
  }
}
