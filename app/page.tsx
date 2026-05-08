import type { Metadata } from "next";
import { requireSession } from "@/lib/auth/guard";
import { DashboardCards } from "./dashboard-cards";

// Session-aware pages must not be cached at the route level.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Dashboard - rad_conclusion",
};

export default async function DashboardPage() {
  // Redirects to /login?next=/ when no valid session is present.
  await requireSession("/");

  return <DashboardCards />;
}
