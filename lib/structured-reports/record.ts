import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import { structuredReports, type NewStructuredReport } from "@/lib/db/schema";

/** Hex characters kept from the sha256, matching the conclusion fingerprint. */
const PROMPT_HASH_LENGTH = 12;

/**
 * Short sha256 identifying the prompt text that produced a report.
 *
 * `userPromptTemplate` must be rendered with fixed sample findings so the hash
 * tracks the prompt text, not the caller's input.
 */
export function hashReportPrompt(systemPrompt: string, userPromptTemplate: string): string {
  return createHash("sha256")
    .update(`${systemPrompt}\n<<<>>>\n${userPromptTemplate}`)
    .digest("hex")
    .slice(0, PROMPT_HASH_LENGTH);
}

/**
 * Persists one finished structured report.
 *
 * Called from the streaming `onFinish` hook, so it must never throw: a failed
 * write is a lost history row, not a failed request for the user. Failures are
 * logged and swallowed.
 */
export function recordStructuredReport(entry: NewStructuredReport): void {
  try {
    // An empty report carries no review value and would pollute the log.
    if (!entry.report.trim()) return;
    db.insert(structuredReports).values(entry).run();
  } catch (error) {
    console.error("[structured-reports] failed to record report:", error);
  }
}
