"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Settings } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { LogoutButton } from "@/app/logout-button";
import { cn } from "@/lib/utils";

/**
 * Shared top navigation bar used across authenticated pages.
 *
 * Covers REQ-NAV-U1 (visual nav bar), REQ-NAV-E1 (activation matrix),
 * and REQ-NAV-UW1 (hidden on unauthenticated or API routes).
 *
 * Rendering rules:
 * - Returns `null` on `/login` and any `/api/*` route.
 * - Returns `null` when no user is provided (defense-in-depth; the layout
 *   should already avoid mounting this component in that case).
 */
interface AppNavProps {
  /** Authenticated user's email, or `null` when unauthenticated. */
  userEmail: string | null;
}

export function AppNav({ userEmail }: AppNavProps): React.ReactElement | null {
  const pathname = usePathname();

  // REQ-NAV-UW1: Hide nav on auth pages and API routes.
  if (pathname === "/login" || pathname.startsWith("/api/")) {
    return null;
  }

  // Defense-in-depth: do not expose the shell (or email) without a user.
  if (!userEmail) {
    return null;
  }

  // REQ-NAV-E1: Path-based active-state matrix (client side only).
  const isHome = pathname === "/";
  const isConclusion =
    pathname === "/conclusion" || pathname.startsWith("/conclusion/");
  const isStructuredReport =
    pathname === "/structured-report" ||
    pathname.startsWith("/structured-report/");

  return (
    <nav
      aria-label="주요 네비게이션"
      className="sticky top-0 z-40 h-14 border-b border-border bg-background/80 backdrop-blur-md"
    >
      <div className="mx-auto flex h-full max-w-7xl items-center justify-between px-4 sm:px-6">
        {/* Left: Dashboard logo link */}
        <Link
          href="/"
          prefetch
          aria-current={isHome ? "page" : undefined}
          aria-label="Dashboard 홈"
          className={cn(
            "flex items-center gap-2 rounded-md px-2 py-1 text-sm font-medium transition-colors duration-150",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            isHome
              ? "text-muted-foreground"
              : "text-foreground hover:bg-accent/50"
          )}
        >
          <Home className="h-5 w-5" aria-hidden="true" />
          <span className="hidden sm:inline">Dashboard</span>
        </Link>

        {/* Center: Pill-style tab group */}
        <div
          role="tablist"
          aria-label="기능 탭"
          className="flex items-center gap-1 rounded-full bg-muted/50 p-1"
        >
          <TabLink
            href="/conclusion"
            label="결론 생성기"
            labelShort="결론"
            active={isConclusion}
          />
          <TabLink
            href="/structured-report"
            label="구조화 리포트"
            labelShort="구조화"
            active={isStructuredReport}
          />
        </div>

        {/* Right: Settings + Theme toggle + email + logout */}
        <div className="flex items-center gap-1 sm:gap-2">
          <Link
            href="/settings"
            aria-label="설정"
            className={cn(
              "inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors duration-150",
              "hover:bg-accent hover:text-foreground",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            )}
          >
            <Settings className="h-5 w-5" aria-hidden="true" />
          </Link>
          <ThemeToggle />
          <span
            className="hidden max-w-[12rem] truncate text-sm text-muted-foreground md:inline-block"
            title={userEmail}
          >
            {userEmail}
          </span>
          <LogoutButton />
        </div>
      </div>
    </nav>
  );
}

interface TabLinkProps {
  href: string;
  label: string;
  labelShort: string;
  active: boolean;
}

/** Single tab item inside the pill-style tab group. */
function TabLink({
  href,
  label,
  labelShort,
  active,
}: TabLinkProps): React.ReactElement {
  return (
    <Link
      href={href}
      prefetch
      role="tab"
      aria-current={active ? "page" : undefined}
      aria-selected={active}
      className={cn(
        "rounded-full px-3 py-1 text-sm font-medium transition-colors duration-150 md:px-4 md:py-1.5",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2",
        active
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      <span className="md:hidden">{labelShort}</span>
      <span className="hidden md:inline">{label}</span>
    </Link>
  );
}
