"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Reads a specific cookie value from `document.cookie` (browser only). */
function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const entries = document.cookie.split(";");
  for (const raw of entries) {
    const [key, ...rest] = raw.trim().split("=");
    if (key === name) {
      return decodeURIComponent(rest.join("="));
    }
  }
  return null;
}

/**
 * Small client button that POSTs to `/api/auth/logout` with the CSRF header
 * sourced from the `csrf_token` cookie, then redirects to `/login`.
 */
export function LogoutButton(): React.ReactElement {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  const handleLogout = React.useCallback(async () => {
    if (pending) return;
    setPending(true);
    try {
      const token = readCookie("csrf_token") ?? "";
      await fetch("/api/auth/logout", {
        method: "POST",
        headers: { "x-csrf-token": token },
      });
    } catch {
      // Proceed with redirect even if the network call failed; the session
      // cookie may still be valid, but the user expects a login screen.
    } finally {
      router.push("/login");
      router.refresh();
      setPending(false);
    }
  }, [pending, router]);

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={handleLogout}
      disabled={pending}
      aria-label="로그아웃"
      className="text-muted-foreground hover:text-foreground"
    >
      <LogOut className="mr-1.5 h-4 w-4" />
      로그아웃
    </Button>
  );
}
