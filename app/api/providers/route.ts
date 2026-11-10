import { getAvailableProviders } from "@/lib/providers/registry";
import { requireApiSession } from "@/lib/auth/guard";
import { canUseProvider } from "@/lib/auth/roles";

export async function GET() {
  const { session, response } = await requireApiSession();
  if (response) return response;

  // Only list what this account may use, so the model picker never offers a
  // provider that /api/generate would refuse.
  const providers = getAvailableProviders().filter((p) =>
    canUseProvider(session.role, p.name)
  );
  return Response.json(providers);
}
