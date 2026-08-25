import { requireSession } from "@/lib/auth/guard";
import { ReviewClient } from "./review-client";

// Session-aware pages must not be cached at the route level.
export const dynamic = "force-dynamic";

export default async function ReviewPage() {
  // Redirects to /login?next=/review when no valid session is present.
  await requireSession("/review");
  return <ReviewClient />;
}
