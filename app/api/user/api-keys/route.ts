import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db/index';
import { userApiKeys } from '@/lib/db/schema';
import { requireApiSession } from '@/lib/auth/guard';
import { validateCsrfOrFail } from '@/lib/auth/csrf';
import { decryptApiKey, encryptApiKey, maskApiKey } from '@/lib/crypto/api-key-crypto';

const upsertSchema = z.object({
  provider: z.enum(['local', 'openai', 'anthropic', 'google']),
  apiKey: z.string().min(1).optional(),
  enabled: z.boolean().optional(),
});

/**
 * GET /api/user/api-keys
 * Returns a list of providers for the current user with masked key info.
 * Never returns plaintext or encrypted keys.
 */
export async function GET() {
  const { session, response } = await requireApiSession();
  if (response) return response;

  const rows = await db
    .select()
    .from(userApiKeys)
    .where(eq(userApiKeys.userId, session.userId));

  const result = rows.map((row) => ({
    provider: row.provider,
    hasKey: row.encryptedKey !== null,
    maskedKey: row.encryptedKey ? maskApiKey(decryptApiKey(row.encryptedKey)) : null,
  }));

  return NextResponse.json(result);
}

/**
 * POST /api/user/api-keys
 * Upserts an API key for the given provider for the current user.
 * Returns the provider name and masked key. Never returns plaintext or encrypted key.
 */
export async function POST(req: Request) {
  const { session, response } = await requireApiSession();
  if (response) return response;

  const csrfFailure = await validateCsrfOrFail(req);
  if (csrfFailure) return csrfFailure;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = upsertSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { provider, apiKey } = parsed.data;

  const encryptedKey = apiKey ? encryptApiKey(apiKey) : null;

  await db
    .insert(userApiKeys)
    .values({
      userId: session.userId,
      provider,
      encryptedKey,
    })
    .onConflictDoUpdate({
      target: [userApiKeys.userId, userApiKeys.provider],
      set: {
        encryptedKey,
        updatedAt: new Date(),
      },
    });

  return NextResponse.json({
    provider,
    maskedKey: apiKey ? maskApiKey(apiKey) : null,
  });
}
