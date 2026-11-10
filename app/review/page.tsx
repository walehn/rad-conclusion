import { requireSession } from "@/lib/auth/guard";
import { canViewAllGenerations } from "@/lib/auth/roles";
import { ReviewClient } from "./review-client";

// Session-aware pages must not be cached at the route level.
export const dynamic = "force-dynamic";

export default async function ReviewPage() {
  // Redirects to /login?next=/review when no valid session is present.
  const user = await requireSession("/review");
  // The API enforces this too; the prop only keeps the UI honest about it.
  return <ReviewClient ownOnly={!canViewAllGenerations(user.role)} />;
}
