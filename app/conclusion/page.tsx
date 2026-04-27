import { requireSession } from "@/lib/auth/guard";
import { ConclusionClient } from "./conclusion-client";

// Session-aware pages must not be cached at the route level.
export const dynamic = "force-dynamic";

export default async function ConclusionPage() {
  // Redirects to /login?next=/conclusion when no valid session is present.
  await requireSession("/conclusion");
  return <ConclusionClient />;
}
