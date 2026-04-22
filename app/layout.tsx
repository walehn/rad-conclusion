import type { Metadata } from "next";
import { ThemeProvider } from "@/components/theme-provider";
import { getCurrentUser } from "@/lib/auth/session";
import { LogoutButton } from "./logout-button";
import "./globals.css";

export const metadata: Metadata = {
  title: "Rad Conclusion - Radiology Report Generator",
  description:
    "AI-powered radiology conclusion generator with multi-LLM support",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getCurrentUser();

  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen antialiased">
        <ThemeProvider>
          {user ? (
            <div className="flex items-center justify-end gap-3 border-b border-border/50 bg-background/80 px-4 py-2 text-xs text-muted-foreground sm:px-6">
              <span
                className="max-w-[14rem] truncate"
                title={user.email}
                aria-label={`로그인 사용자: ${user.email}`}
              >
                {user.email}
              </span>
              <LogoutButton />
            </div>
          ) : null}
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
