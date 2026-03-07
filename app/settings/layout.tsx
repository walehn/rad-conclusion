import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Settings - Rad Conclusion",
  description: "Configure LLM providers and API keys",
};

export default function SettingsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <>{children}</>;
}
