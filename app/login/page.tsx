import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getCurrentUser } from "@/lib/auth/session";
import { LoginForm } from "./login-form";

// Pages that depend on cookies must not be statically cached.
export const dynamic = "force-dynamic";

/**
 * Sanitizes a post-login redirect target: must be a same-origin path. Rejects
 * protocol-relative (`//evil`) and backslash-tricks (`/\\evil`), falling back to `/`.
 */
function sanitizeNext(raw: string | undefined | string[]): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value || typeof value !== "string") return "/";
  if (!value.startsWith("/")) return "/";
  if (value.startsWith("//") || value.startsWith("/\\")) return "/";
  return value;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const nextPath = sanitizeNext(params.next);

  // If already authenticated, go straight to the destination.
  const user = await getCurrentUser();
  if (user) {
    redirect(nextPath);
  }

  // CSRF cookie is set by middleware; read the token it forwarded via request header.
  const csrfToken = (await headers()).get("x-csrf-for-page") ?? "";

  return <LoginForm csrfToken={csrfToken} nextPath={nextPath} />;
}
