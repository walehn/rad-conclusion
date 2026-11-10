/**
 * Version, build time and commit of the running build, stamped by
 * next.config.ts at `next build`. Empty strings when unknown (e.g. tests).
 */
export const BUILD_INFO = {
  version: process.env.NEXT_PUBLIC_APP_VERSION ?? "",
  builtAt: process.env.NEXT_PUBLIC_BUILD_DATE ?? "",
  commit: process.env.NEXT_PUBLIC_BUILD_COMMIT ?? "",
} as const;

/**
 * Build date as YYYY-MM-DD in Korean time. A fixed time zone keeps the
 * server-rendered and hydrated text identical.
 */
export function formatBuildDate(iso: string): string {
  const date = new Date(iso);
  if (!iso || Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
  return parts; // en-CA formats as YYYY-MM-DD
}
