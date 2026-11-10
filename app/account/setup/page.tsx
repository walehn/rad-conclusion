import type { Metadata } from "next";
import { headers } from "next/headers";
import { SetupForm } from "./setup-form";

// Reads the per-request CSRF token; must not be statically cached.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "계정 설정 - Rad Conclusion",
  // The page is opened from a private link; keep it out of search results.
  robots: { index: false, follow: false },
};

/**
 * Landing page for invite and password-reset links. Public by design: the
 * one-time token in the URL fragment is the credential, checked by
 * /api/account-links/*.
 */
export default async function AccountSetupPage() {
  // CSRF cookie is set by middleware; read the token it forwarded via request header.
  const csrfToken = (await headers()).get("x-csrf-for-page") ?? "";
  return <SetupForm csrfToken={csrfToken} />;
}
