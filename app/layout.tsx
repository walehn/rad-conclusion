import type { Metadata } from "next";
import { ThemeProvider } from "@/components/theme-provider";
import { getCurrentUser } from "@/lib/auth/session";
import { AppNav } from "@/components/app-nav";
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
          <AppNav userEmail={user?.email ?? null} />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
