import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db/index';
import { userApiKeys } from '@/lib/db/schema';
import { requireApiSession } from '@/lib/auth/guard';
import { validateCsrfOrFail } from '@/lib/auth/csrf';
import type { ProviderName } from '@/lib/providers/types';

const VALID_PROVIDERS: ProviderName[] = ['local', 'openai', 'anthropic', 'google'];

/**
 * DELETE /api/user/api-keys/[provider]
 * Removes the stored API key for the given provider for the current user.
 * Returns 204 No Content on success, 404 if the provider key was not found.
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { session, response } = await requireApiSession();
  if (response) return response;

  const csrfFailure = await validateCsrfOrFail(req);
  if (csrfFailure) return csrfFailure;

  const { provider } = await params;

  if (!VALID_PROVIDERS.includes(provider as ProviderName)) {
    return NextResponse.json(
      { error: `Invalid provider: ${provider}` },
      { status: 400 }
    );
  }

  const result = await db
    .delete(userApiKeys)
    .where(
      and(
        eq(userApiKeys.userId, session.userId),
        eq(userApiKeys.provider, provider)
      )
    )
    .returning({ id: userApiKeys.id });

  if (result.length === 0) {
    return NextResponse.json(
      { error: 'API key not found for this provider' },
      { status: 404 }
    );
  }

  return new NextResponse(null, { status: 204 });
}
