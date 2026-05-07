/**
 * Single-line JSON performance logger for local-model latency analysis.
 *
 * Output is gated by RAD_PERF_LOG=1 so production noise stays zero. Each call
 * emits exactly one line on stdout (via console.log), grep/jq friendly:
 *
 *   {"perf":"gen","stage":"ttft","route":"/api/generate","provider":"local",...}
 *
 * Used by:
 *   - app/api/generate/route.ts                   (TTFT / finish)
 *   - app/api/structured-report/generate/route.ts (TTFT / finish)
 *   - lib/providers/registry.ts                   (upstream headers)
 *
 * The helper itself is side-effect free aside from the console.log; callers
 * are expected to wrap any failure-prone payload construction in try/catch.
 */

export type PerfPayload = Record<string, unknown> & { perf: string };

const PERF_ENV_FLAG = "RAD_PERF_LOG";

export function isPerfLogEnabled(): boolean {
  return process.env[PERF_ENV_FLAG] === "1";
}

export function perfLog(payload: PerfPayload): void {
  if (!isPerfLogEnabled()) return;
  try {
    // Single-line JSON — compatible with `jq -c` and grep filters.
    console.log(JSON.stringify(payload));
  } catch {
    // Never let observability throw into the hot path. Swallow circular refs etc.
  }
}
