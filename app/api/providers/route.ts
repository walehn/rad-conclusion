import { getAvailableProviders } from "@/lib/providers/registry";
import { requireApiSession } from "@/lib/auth/guard";

export async function GET() {
  const { response } = await requireApiSession();
  if (response) return response;

  const providers = getAvailableProviders();
  return Response.json(providers);
}
