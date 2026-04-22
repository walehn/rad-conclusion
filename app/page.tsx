import { requireSession } from "@/lib/auth/guard";
import HomeClient from "./home-client";

// Session-aware pages must not be cached at the route level.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  // Redirects to /login?next=/ when no valid session is present.
  await requireSession("/");
  return <HomeClient />;
}
