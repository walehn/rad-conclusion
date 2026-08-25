import fs from "node:fs";
import path from "node:path";

const EVALUATIONS_FILE = path.join(process.cwd(), "data", "evaluations.jsonl");

export interface EvaluationScores {
  conciseness?: number;
  intervalChange?: number;
  dxAppropriateness?: number;
  redundancy?: number;
  hedgingAccuracy?: number;
  clinicalPriority?: number;
}

export interface EvaluationSummary {
  scores: EvaluationScores;
  issues: string[];
  overallScore: number | null;
}

/**
 * Key for matching a judged evaluation back to a generation row.
 *
 * The judge queue (data/evaluations.jsonl) predates the generations table and
 * carries no shared id, so rows are matched on their exact text. Both sides
 * store the raw model output, so the strings line up. The separator is NUL,
 * which cannot appear in either field.
 */
function key(findings: string, conclusion: string): string {
  return `${findings}\u0000${conclusion}`;
}

let cache: {
  mtimeMs: number;
  size: number;
  map: Map<string, EvaluationSummary>;
} | null = null;

/**
 * Loads judged evaluations, keyed by findings+conclusion.
 *
 * The file is re-parsed only when its mtime or size changes, so the review
 * screen does not re-read it on every request. Returns an empty map when the
 * judge worker has never run.
 */
export function loadEvaluationIndex(): Map<string, EvaluationSummary> {
  let stat: fs.Stats;
  try {
    stat = fs.statSync(EVALUATIONS_FILE);
  } catch {
    return new Map();
  }

  if (cache && cache.mtimeMs === stat.mtimeMs && cache.size === stat.size) {
    return cache.map;
  }

  const map = new Map<string, EvaluationSummary>();
  try {
    const content = fs.readFileSync(EVALUATIONS_FILE, "utf-8");
    for (const line of content.split("\n")) {
      if (!line.trim()) continue;
      try {
        const row = JSON.parse(line);
        if (
          typeof row?.findings !== "string" ||
          typeof row?.conclusion !== "string"
        ) {
          continue;
        }
        // Later judgements of the same text win.
        map.set(key(row.findings, row.conclusion), {
          scores: row.scores ?? {},
          issues: Array.isArray(row.issues) ? row.issues : [],
          overallScore:
            typeof row.overallScore === "number" ? row.overallScore : null,
        });
      } catch {
        // skip malformed lines, same as the existing evaluate route
      }
    }
  } catch {
    return new Map();
  }

  cache = { mtimeMs: stat.mtimeMs, size: stat.size, map };
  return map;
}

/** Looks up the judged evaluation for one generation, if the worker scored it. */
export function findEvaluation(
  index: Map<string, EvaluationSummary>,
  findings: string,
  conclusion: string
): EvaluationSummary | null {
  return index.get(key(findings, conclusion)) ?? null;
}
