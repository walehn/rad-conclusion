// lib/findings-review.ts
// Internal-consistency review of the Findings the radiologist typed: a side,
// segment, size or statement that contradicts another part of the same
// Findings. It judges the text against itself, never against the images, so
// it cannot tell whether a reading is right — only whether it agrees with
// itself.
//
// The model must quote the conflicting text verbatim; an issue whose quote is
// not in the Findings is dropped, so the reviewer only sees issues it can
// locate. Under evaluation (`npm run eval -- findings-review`) before any UI
// uses it.

import { z } from "zod";

export const FINDINGS_REVIEW_TYPES = ["laterality", "location", "measurement", "contradiction", "history"] as const;
export type FindingsReviewType = (typeof FINDINGS_REVIEW_TYPES)[number];

export interface FindingsIssue {
  type: FindingsReviewType;
  /** Verbatim text from the Findings. */
  quote: string;
  /** Verbatim text it conflicts with, when the conflict spans two places. */
  otherQuote?: string;
  explanation: string;
}

export interface FindingsReview {
  issues: FindingsIssue[];
  /** Issues the model reported whose quotes are not in the Findings. */
  dropped: number;
  /** The output was not the requested JSON. */
  parseError?: string;
}

export const FINDINGS_REVIEW_SYSTEM = `You proofread the Findings section of an abdominal CT or MRI report for internal inconsistencies before the radiologist signs it. You see only the text, not the images. Do not judge whether the interpretation is correct; judge only whether the text agrees with itself.

Report an issue only when it is clearly an error:
- laterality: the same lesion or structure is given different sides, or a side contradicts another statement about it.
- location: an anatomic location that cannot be true as written, such as a liver segment in the wrong lobe (S1 caudate, S2-S4 left lobe, S5-S8 right lobe), or an organ placed where it is not.
- measurement: the same lesion has different sizes in different places, or a stated change contradicts its own numbers ("increased from 2.1 cm to 1.5 cm").
- contradiction: two statements that cannot both be true ("no ascites" and "moderate ascites"; "no hydronephrosis" and "mild hydronephrosis" of the same kidney).
- history: a statement that conflicts with the stated history or with another statement about it, such as a resected organ described as present or normal, or findings for organs of both sexes.

Do not report:
- wording, grammar, spelling, abbreviations or style
- missing information, or findings you would have described differently
- disagreement with a diagnosis or its certainty
- a change from a prior study (a lesion may be new, resolved or different in size from the prior; that is not an inconsistency)
- left and right of different lesions, or bilateral findings
- anything you are unsure about

Most Findings have no issue. When in doubt, report nothing.

Answer with JSON only, no other text:
{"issues": [{"type": "laterality" | "location" | "measurement" | "contradiction" | "history", "quote": "<exact text copied from the Findings>", "other_quote": "<exact text it conflicts with, or empty>", "explanation": "<one short English sentence>"}]}
Copy each quote character for character from the Findings, 3 to 15 words long. Report at most 3 issues. With no issue, answer {"issues": []}.`;

export function buildFindingsReviewPrompt(findings: string): string {
  return `Findings:\n${findings}`;
}

/** Case, spacing and quote marks are not part of what was written. */
function normalizeForQuote(text: string): string {
  return text
    .toLowerCase()
    .replace(/[‘’“”"'`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function quoteFound(quote: string, findings: string): boolean {
  const q = normalizeForQuote(quote);
  return q.length >= 3 && normalizeForQuote(findings).includes(q);
}

/** First top-level {...} in the output: the model may wrap JSON in a code fence. */
function extractJson(text: string): string | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  return start >= 0 && end > start ? text.slice(start, end + 1) : null;
}

const RawIssueSchema = z.object({
  type: z.enum(FINDINGS_REVIEW_TYPES),
  quote: z.string(),
  other_quote: z.string().nullish(),
  explanation: z.string().default(""),
});

export function parseFindingsReview(output: string, findings: string): FindingsReview {
  const json = extractJson(output);
  if (!json) return { issues: [], dropped: 0, parseError: "no JSON object in output" };
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch (error) {
    return { issues: [], dropped: 0, parseError: error instanceof Error ? error.message : String(error) };
  }
  const list = (raw as { issues?: unknown })?.issues;
  if (!Array.isArray(list)) return { issues: [], dropped: 0, parseError: "no issues array" };

  const issues: FindingsIssue[] = [];
  let dropped = 0;
  for (const item of list) {
    const parsed = RawIssueSchema.safeParse(item);
    const quote = parsed.success ? parsed.data.quote.trim() : "";
    const otherQuote = parsed.success ? (parsed.data.other_quote ?? "").trim() : "";
    if (!parsed.success || !quoteFound(quote, findings) || (otherQuote && !quoteFound(otherQuote, findings))) {
      dropped++;
      continue;
    }
    issues.push({
      type: parsed.data.type,
      quote,
      ...(otherQuote ? { otherQuote } : {}),
      explanation: parsed.data.explanation.trim(),
    });
  }
  return { issues, dropped };
}
