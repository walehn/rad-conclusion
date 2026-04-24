import { requireSession } from "@/lib/auth/guard";
import { StructuredReportClient } from "./structured-report-client";

// Session-aware pages must not be cached at the route level.
export const dynamic = "force-dynamic";

export default async function StructuredReportPage() {
  // Redirects to /login?next=/structured-report when no valid session is present.
  await requireSession("/structured-report");
  return <StructuredReportClient />;
}
