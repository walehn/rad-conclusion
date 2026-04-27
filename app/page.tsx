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

  return (
    <main className="mx-auto w-full max-w-6xl px-4 pt-12 pb-16 sm:px-6 md:pt-20 lg:pt-24">
      <header className="mb-10 text-center md:mb-12">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          시작할 기능을 선택하세요
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Findings를 어떻게 처리하시겠어요?
        </p>
      </header>
      <DashboardCards />
    </main>
  );
}
