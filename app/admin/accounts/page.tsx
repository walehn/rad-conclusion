import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth/guard";
import { canManageAccounts } from "@/lib/auth/roles";
import { AccountsClient } from "./accounts-client";

// Session-aware pages must not be cached at the route level.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "계정 관리 - Rad Conclusion",
};

export default async function AdminAccountsPage() {
  const user = await requireSession("/admin/accounts");
  // Other roles get a plain 404: the page is not advertised to them at all.
  if (!canManageAccounts(user.role)) notFound();
  return <AccountsClient currentUserId={user.userId} />;
}
