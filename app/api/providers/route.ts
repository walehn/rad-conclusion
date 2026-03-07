import { getAvailableProviders } from "@/lib/providers/registry";

export async function GET() {
  const providers = getAvailableProviders();
  return Response.json(providers);
}
