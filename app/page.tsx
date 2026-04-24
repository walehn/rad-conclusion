import { requireSession } from "@/lib/auth/guard";

// Session-aware pages must not be cached at the route level.
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  // Redirects to /login?next=/ when no valid session is present.
  await requireSession("/");
  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Dashboard coming soon. Use direct navigation to /conclusion or /structured-report for now.
      </p>
    </main>
  );
}
