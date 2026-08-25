import { db } from "@/lib/db";
import { generations, type NewGeneration } from "@/lib/db/schema";

/**
 * Persists one finished generation.
 *
 * Called from the streaming `onFinish` hook, so it must never throw: a failed
 * write is a lost history row, not a failed request for the user. Failures are
 * logged and swallowed.
 *
 * better-sqlite3 is synchronous, so this returns immediately — no promise is
 * left dangling after the response stream closes.
 */
export function recordGeneration(entry: NewGeneration): void {
  try {
    // An empty conclusion carries no review value and would pollute the log.
    if (!entry.conclusion.trim()) return;
    db.insert(generations).values(entry).run();
  } catch (error) {
    console.error("[generations] failed to record generation:", error);
  }
}
