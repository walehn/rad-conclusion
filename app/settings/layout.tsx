import type { Metadata } from "next";
import { requireSession } from "@/lib/auth/guard";

export const metadata: Metadata = {
  title: "Settings - Rad Conclusion",
  description: "Configure LLM providers and API keys",
};

export default async function SettingsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Redirects to /login?next=/settings when no valid session is present.
  await requireSession("/settings");
  return <>{children}</>;
}
