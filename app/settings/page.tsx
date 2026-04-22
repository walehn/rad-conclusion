import { requireSession } from "@/lib/auth/guard";
import SettingsClient from "./settings-client";

// Session-aware pages must not be cached at the route level.
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  // Redirects to /login?next=/settings when no valid session is present.
  await requireSession("/settings");
  return <SettingsClient />;
}
