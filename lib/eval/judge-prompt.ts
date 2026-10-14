// lib/eval/judge-prompt.ts
// Reference-free rubric for grading one generated conclusion against the
// findings it was written from.
//
// The rubric counts errors by type and clinical significance instead of
// asking for 1-5 style scores: "1 significant omission" is comparable across
// prompt revisions and judge models, "conciseness 4" is not. It is modelled
// on the error taxonomy of reference-based report metrics (GREEN, RadPEER)
// with the reference report replaced by the findings.
//
// The judge never sees the prompt version or the generating model, so v1/v2
// comparisons are blind.

import { createHash } from "node:crypto";
import { z } from "zod";

export const ERROR_CATEGORIES = [
  "unsupported_finding",
  "omission",
  "location_error",
  "measurement_error",
  "interval_change_error",
  "certainty_error",
  "diagnosis_error",
  "recommendation_error",
  "other",
] as const;

export const ACCEPTABILITY = ["accept", "minor_edit", "major_edit", "reject"] as const;

export type ErrorCategory = (typeof ERROR_CATEGORIES)[number];
export type Acceptability = (typeof ACCEPTABILITY)[number];

export const JUDGE_SYSTEM_PROMPT = `You are an attending radiologist auditing an AI-written Conclusion (Impression) section of a radiology report. You receive the Findings the radiologist typed and the Conclusion generated from them. The Conclusion was requested in English, as a numbered list ordered by clinical priority. The Findings may mix Korean and English.

Judge the Conclusion ONLY against the Findings. Do not assume facts that are not written in the Findings. Tokens such as [DATE1], [ID1], [HOSPITAL1] are de-identification placeholders: identical placeholders mean identical values, and placeholders are never errors by themselves.

Work in this order:

1. key_findings — list every clinically relevant finding in the Findings, one entry each, with:
   - importance: "high" (would change management or must reach the referring clinician), "medium" (known disease, interval change, needs mention), "low" (incidental, expected post-treatment, may be omitted)
   - covered: "yes" (reflected correctly), "partial" (mentioned but incomplete or distorted), "no" (absent)

2. errors — list every error in the Conclusion. One entry per distinct error. Categories:
   - unsupported_finding: states a finding, structure, or measurement that the Findings do not contain
   - omission: a high- or medium-importance finding is missing (do NOT report omitted low-importance findings)
   - location_error: wrong organ, segment, or side
   - measurement_error: size, count, or unit differs from the Findings
   - interval_change_error: change status (new, stable, increased, decreased, resolved) added without basis in the Findings, contradicted, or dropped where clinically important
   - certainty_error: certainty distorted — a suspected finding stated as definite, a definite finding over-hedged, or hedging stacked
   - diagnosis_error: a diagnosis or differential not supported by the described features, implausible, or ignoring a clearly more likely diagnosis
   - recommendation_error: a recommendation that is inappropriate or unnecessary for the finding, or a clearly needed recommendation for an urgent finding that is missing
   - other: anything else that a radiologist would correct
   significance: "significant" if it could change patient management or mislead the referring clinician; "minor" otherwise (wording, redundancy, non-critical imprecision).
   excerpt: the exact Conclusion text the error refers to ("" for an omission).

3. priority_order (1-5): 5 = items ordered by clinical significance; 1 = order inverted or random.
4. conciseness (1-5): 5 = clinical essentials only, no imaging descriptors or redundancy; 1 = restates the Findings verbosely.
5. acceptability — would you sign this Conclusion?
   - "accept": sign as-is
   - "minor_edit": small wording or ordering edits, no clinical change
   - "major_edit": a clinically significant correction is needed
   - "reject": rewrite from scratch
   Any "significant" error means acceptability is "major_edit" or "reject".
6. comment: one or two sentences summarising the main problem, or "" if none.

Output ONLY one JSON object, no markdown fences, no text before or after:
{
  "key_findings": [{"finding": "...", "importance": "high|medium|low", "covered": "yes|partial|no"}],
  "errors": [{"category": "...", "significance": "significant|minor", "excerpt": "...", "explanation": "..."}],
  "priority_order": 1-5,
  "conciseness": 1-5,
  "acceptability": "accept|minor_edit|major_edit|reject",
  "comment": "..."
}`;

export function buildJudgeUserPrompt(findings: string, conclusion: string): string {
  return `=== FINDINGS ===
${findings}

=== CONCLUSION ===
${conclusion}`;
}

/** Bump on any rubric text or schema change; stored with every judgment. */
export const RUBRIC_VERSION = "j1";

/** Exact rubric identity, so an unbumped edit is still detectable. */
export const RUBRIC_HASH = createHash("sha256")
  .update(JUDGE_SYSTEM_PROMPT)
  .digest("hex")
  .slice(0, 12);

const score = z.coerce.number().int().min(1).max(5);

export const JudgmentSchema = z.object({
  key_findings: z.array(
    z.object({
      finding: z.string(),
      importance: z.enum(["high", "medium", "low"]),
      covered: z.enum(["yes", "partial", "no"]),
    })
  ),
  errors: z.array(
    z.object({
      category: z.enum(ERROR_CATEGORIES),
      significance: z.enum(["significant", "minor"]),
      excerpt: z.string().default(""),
      explanation: z.string(),
    })
  ),
  priority_order: score,
  conciseness: score,
  acceptability: z.enum(ACCEPTABILITY),
  comment: z.string().default(""),
});

export type Judgment = z.infer<typeof JudgmentSchema>;

/**
 * Pulls the JSON object out of a model reply and validates it. Tolerates
 * markdown fences and stray text around the object, nothing else.
 */
export function parseJudgment(raw: string): Judgment {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("no JSON object in reply");
  const parsed: unknown = JSON.parse(raw.slice(start, end + 1));
  return JudgmentSchema.parse(parsed);
}
