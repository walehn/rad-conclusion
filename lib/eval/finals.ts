// lib/eval/finals.ts
// Links generations to the reports the radiologist actually signed in PACS.
//
// Input is the JSONL written by `pft report-export` (pacsforge-tools): one
// signed report per line, no patient identifiers. The app never stored an
// accession number, so a batch is matched by text: the findings typed into
// the app reappear, possibly edited or as a subset, in the PACS findings.
//
// Once matched, the signed conclusion is a reference for every generation in
// the batch: how much was edited, and which of v1/v2 was actually used.

import { z } from "zod";

/** Bump when matching logic or thresholds change. */
export const MATCHER_VERSION = "m1";

export const FinalReportSchema = z.object({
  study_key: z.string().min(1),
  accession_num: z.string().default(""),
  modality: z.string().default(""),
  description: z.string().default(""),
  section: z.string().default(""),
  study_date: z.string().default(""),
  match_date: z.string().default(""),
  report_state: z.string().default(""),
  report_dttm: z.string(),
  findings: z.string(),
  conclusion: z.string(),
  recommend: z.string().default(""),
  /** The user's role on the signed report: "creator", "approver" or "creator+approver". */
  reader_role: z.string().default(""),
});

export type FinalReport = z.infer<typeof FinalReportSchema>;

export function parseFinalReportsJsonl(text: string): { reports: FinalReport[]; invalid: number } {
  const reports: FinalReport[] = [];
  let invalid = 0;
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    try {
      reports.push(FinalReportSchema.parse(JSON.parse(line)));
    } catch {
      invalid++;
    }
  }
  return { reports, invalid };
}

// ---------------------------------------------------------------------------
// Findings matching
// ---------------------------------------------------------------------------

/** Letters, digits and Hangul only, lowercased: survives re-typing and wrapping. */
export function matchKey(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9가-힣]/g, "");
}

function trigrams(key: string): Set<string> {
  const grams = new Set<string>();
  for (let i = 0; i + 3 <= key.length; i++) grams.add(key.slice(i, i + 3));
  return grams;
}

/** Share of the app findings' trigrams found in the PACS findings. */
export function containment(appFindings: string, pacsFindings: string): number {
  const a = trigrams(matchKey(appFindings));
  if (a.size === 0) return 0;
  const b = trigrams(matchKey(pacsFindings));
  let hit = 0;
  for (const g of a) if (b.has(g)) hit++;
  return hit / a.size;
}

export interface MatchBatch {
  batchId: string;
  findings: string;
  createdAt: Date;
}

export interface FinalMatch {
  batchId: string;
  studyKey: string;
  score: number;
  /** Best score among the other candidates; 0 when there were none. */
  runnerUp: number;
}

/** Signed report must fall in [generated - 1h, generated + 14d]. */
const WINDOW_BEFORE_MS = 60 * 60 * 1000;
const WINDOW_AFTER_MS = 14 * 24 * 60 * 60 * 1000;
const MIN_SCORE = 0.6;
const MIN_MARGIN = 0.1;
/** Below this the findings are too short to identify a study. */
const MIN_KEY_LENGTH = 30;

export function matchBatches(batches: MatchBatch[], finals: FinalReport[]): FinalMatch[] {
  const candidates = finals
    .map((f) => ({ f, at: Date.parse(f.report_dttm), key: f.findings }))
    .filter((c) => !Number.isNaN(c.at));
  const matches: FinalMatch[] = [];
  for (const b of batches) {
    if (matchKey(b.findings).length < MIN_KEY_LENGTH) continue;
    const t = b.createdAt.getTime();
    const scored = candidates
      .filter((c) => c.at >= t - WINDOW_BEFORE_MS && c.at <= t + WINDOW_AFTER_MS)
      .map((c) => ({ studyKey: c.f.study_key, score: containment(b.findings, c.key) }))
      .sort((x, y) => y.score - x.score);
    const [best, second] = scored;
    if (!best || best.score < MIN_SCORE) continue;
    const runnerUp = second?.score ?? 0;
    if (best.score - runnerUp < MIN_MARGIN) continue;
    matches.push({ batchId: b.batchId, studyKey: best.studyKey, score: best.score, runnerUp });
  }
  return matches;
}

// ---------------------------------------------------------------------------
// Conclusion comparison
// ---------------------------------------------------------------------------

/** List markers, case, punctuation and spacing are not edits a reader makes. */
export function normalizeConclusion(text: string): string {
  return text
    .replace(/^\s*(?:\d+[.)]|\(\d+\)|[-*•])\s*/gm, "")
    .toLowerCase()
    .replace(/[^a-z0-9가-힣\s.]/g, " ")
    // Keep decimal points ("1.1 cm" is one word); drop sentence periods.
    .replace(/(?<!\d)\.|\.(?!\d)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Word-level Levenshtein distance. */
function wordDistance(a: string[], b: string[]): number {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

/**
 * 1 - (word edits / longer length). 1 = signed verbatim, 0 = rewritten.
 * Word level, because a radiologist edits words; character level would
 * score "left" -> "right" as a small change.
 */
export function editSimilarity(generated: string, signed: string): number {
  const a = normalizeConclusion(generated).split(" ").filter(Boolean);
  const b = normalizeConclusion(signed).split(" ").filter(Boolean);
  const longer = Math.max(a.length, b.length);
  if (longer === 0) return 1;
  return 1 - wordDistance(a, b) / longer;
}

/** Similarity at or above which a conclusion counts as signed as-is. */
export const VERBATIM_THRESHOLD = 0.9;
/** Below this for every version, the radiologist wrote their own. */
export const ADOPTED_THRESHOLD = 0.5;
