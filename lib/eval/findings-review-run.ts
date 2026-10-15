// lib/eval/findings-review-run.ts
// Offline measurement of the Findings consistency review (lib/findings-review.ts)
// on the Findings of signed PACS reports.
//
// There is no reference label: whether a flagged issue is a real error is for
// the radiologist to decide. So the run produces a review sheet (Markdown, in
// data/, never committed) with a verdict line per issue, and `--tally` reads
// the marked sheet back into a precision estimate.

import { createHash } from "node:crypto";
import { generateText } from "ai";
import { getModel } from "@/lib/providers/registry";
import {
  FINDINGS_REVIEW_SYSTEM,
  FINDINGS_REVIEW_TYPES,
  buildFindingsReviewPrompt,
  parseFindingsReview,
  type FindingsIssue,
  type FindingsReview,
  type FindingsReviewType,
} from "@/lib/findings-review";
import { deidentify } from "./deidentify";
import { matchKey, type FinalReport } from "./finals";
import { REPLAY_MODEL, TEST_FROM, thinkingModel, type ReplayCase, type ReplayOutput } from "./replay";

export const REVIEW_CASE_SET = "signed";

export interface ReviewVariant {
  id: string;
  thinking: boolean;
}

export const REVIEW_VARIANTS: Record<string, ReviewVariant> = {
  "findings-review": { id: "findings-review", thinking: false },
  "findings-review-think": { id: "findings-review-think", thinking: true },
};

export function reviewHash(v: ReviewVariant): string {
  return createHash("sha256")
    .update(FINDINGS_REVIEW_SYSTEM)
    .update("\n<<<>>>\n")
    .update(buildFindingsReviewPrompt("SAMPLE FINDINGS"))
    .update(v.thinking ? "\n<<<thinking>>>" : "")
    .digest("hex")
    .slice(0, 12);
}

/** Every signed report with descriptive Findings, assisted or not: the review reads the Findings only. */
export function signedCases(finals: FinalReport[]): ReplayCase[] {
  return finals
    .filter((f) => matchKey(f.findings).length >= 30)
    .map((f) => {
      const date = new Date(f.report_dttm);
      return { id: f.study_key, findings: f.findings, reference: f.conclusion, date, split: date >= TEST_FROM ? "test" : "dev" };
    });
}

export async function reviewForCase(v: ReviewVariant, findings: string, timeoutMs = 180_000): Promise<ReplayOutput> {
  const t0 = performance.now();
  const res = await generateText({
    model: v.thinking ? thinkingModel() : getModel("local", REPLAY_MODEL, { deepReasoning: false }),
    system: FINDINGS_REVIEW_SYSTEM,
    prompt: buildFindingsReviewPrompt(findings),
    temperature: 0,
    maxTokens: v.thinking ? 6000 : 1200,
    maxRetries: 2,
    abortSignal: AbortSignal.timeout(timeoutMs),
  });
  return { output: res.text, latencyMs: Math.round(performance.now() - t0) };
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

export interface ReviewSummary {
  variant: string;
  n: number;
  flagged: number;
  issues: number;
  byType: Record<FindingsReviewType, number>;
  dropped: number;
  parseErrors: number;
  meanLatencyMs: number;
}

export function summarizeReviews(
  variant: string,
  cases: ReplayCase[],
  outputs: Map<string, ReplayOutput>
): { summary: ReviewSummary; reviews: Map<string, FindingsReview> } {
  const reviews = new Map<string, FindingsReview>();
  const byType = Object.fromEntries(FINDINGS_REVIEW_TYPES.map((t) => [t, 0])) as Record<FindingsReviewType, number>;
  let flagged = 0, issues = 0, dropped = 0, parseErrors = 0, latency = 0;
  for (const c of cases) {
    const o = outputs.get(c.id);
    if (!o) continue;
    const r = parseFindingsReview(o.output, c.findings);
    reviews.set(c.id, r);
    if (r.issues.length) flagged++;
    issues += r.issues.length;
    for (const i of r.issues) byType[i.type]++;
    dropped += r.dropped;
    if (r.parseError) parseErrors++;
    latency += o.latencyMs;
  }
  const n = reviews.size;
  return {
    summary: { variant, n, flagged, issues, byType, dropped, parseErrors, meanLatencyMs: n ? latency / n : 0 },
    reviews,
  };
}

const pct = (a: number, b: number) => (b ? `${((a / b) * 100).toFixed(1)}%` : "-");

export function renderReviewSummaries(rows: ReviewSummary[]): string {
  const head = ["variant", "n", "flagged", "issues", ...FINDINGS_REVIEW_TYPES, "dropped", "parse err", "latency"];
  const body = rows.map((r) => [
    r.variant,
    String(r.n),
    `${r.flagged} (${pct(r.flagged, r.n)})`,
    String(r.issues),
    ...FINDINGS_REVIEW_TYPES.map((t) => String(r.byType[t])),
    String(r.dropped),
    String(r.parseErrors),
    `${(r.meanLatencyMs / 1000).toFixed(1)}s`,
  ]);
  const widths = head.map((h, i) => Math.max(h.length, ...body.map((b) => b[i].length)));
  const line = (cells: string[]) => cells.map((c, i) => c.padEnd(widths[i])).join("  ");
  return [line(head), line(widths.map((w) => "-".repeat(w))), ...body.map(line)].join("\n");
}

/** Cases flagged by one variant only: where thinking changes the answer. */
export function reviewAgreement(a: Map<string, FindingsReview>, b: Map<string, FindingsReview>) {
  let both = 0, onlyA = 0, onlyB = 0, neither = 0;
  for (const [id, ra] of a) {
    const rb = b.get(id);
    if (!rb) continue;
    const fa = ra.issues.length > 0, fb = rb.issues.length > 0;
    if (fa && fb) both++;
    else if (fa) onlyA++;
    else if (fb) onlyB++;
    else neither++;
  }
  return { both, onlyA, onlyB, neither };
}

// ---------------------------------------------------------------------------
// Review sheet
// ---------------------------------------------------------------------------

const VERDICT_LINE = "판정: [ ] 오류 맞음  [ ] 거짓 경보  [ ] 애매";

/** Bold each quoted span inside the Findings so the reader sees where to look. */
function highlight(findings: string, quotes: string[]): string {
  let out = findings;
  for (const q of quotes) {
    const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+"), "i");
    out = out.replace(re, (m) => `**${m}**`);
  }
  return out;
}

export interface SheetVariant {
  id: string;
  promptHash: string;
  reviews: Map<string, FindingsReview>;
}

interface SheetIssue extends FindingsIssue {
  variants: string[];
}

const quoteKey = (q: string) => q.toLowerCase().replace(/\s+/g, " ").trim();

/** Two variants reporting the same conflict quote the same text, or one quote inside the other. */
function sameIssue(a: FindingsIssue, b: FindingsIssue): boolean {
  const qa = [a.quote, a.otherQuote ?? ""].filter(Boolean).map(quoteKey);
  const qb = [b.quote, b.otherQuote ?? ""].filter(Boolean).map(quoteKey);
  return qa.some((x) => qb.some((y) => x.includes(y) || y.includes(x)));
}

/**
 * One sheet for every variant, so a case flagged by several is judged once.
 * Each issue heading lists the variants that reported it; --tally scores each
 * variant on the issues it reported.
 *
 * `deidentified` drops the accession number and exam date from each heading
 * and scrubs dates, ID numbers and hospital names from the text, for reading
 * on another device. Case numbers match the full sheet, and --tally reads
 * either one.
 */
export function renderReviewSheet(
  variants: SheetVariant[],
  finals: Map<string, FinalReport>,
  { deidentified = false }: { deidentified?: boolean } = {}
): string {
  const byCase = new Map<string, SheetIssue[]>();
  for (const v of variants) {
    for (const [id, r] of v.reviews) {
      const merged = byCase.get(id) ?? [];
      for (const issue of r.issues) {
        const same = merged.find((m) => !m.variants.includes(v.id) && sameIssue(m, issue));
        if (same) same.variants.push(v.id);
        else merged.push({ ...issue, variants: [v.id] });
      }
      if (merged.length) byCase.set(id, merged);
    }
  }
  const flagged = [...byCase].sort(([a], [b]) =>
    (finals.get(a)?.study_date ?? "").localeCompare(finals.get(b)?.study_date ?? "") || a.localeCompare(b)
  );
  const reviewed = Math.max(...variants.map((v) => v.reviews.size));
  const parts = [
    `# 소견 모순 검사 검토표 (${variants.map((v) => `${v.id} ${v.promptHash}`).join(", ")})`,
    "",
    `서명 판독문 ${reviewed}건 중 ${flagged.length}건에 경고가 나왔습니다. 경고마다 판정 칸 하나에 x를 넣어 주세요.`,
    "제목 끝은 그 경고를 낸 검사 방식입니다. 다 표시한 뒤 `npm run eval -- findings-review --tally <이 파일>`로 집계합니다.",
    ...(deidentified
      ? ["", "> 비식별본: accession·검사일을 빼고 날짜·번호·병원명을 가렸습니다. 케이스 번호는 PC의 원본 검토표와 같습니다."]
      : []),
    "",
  ];
  flagged.forEach(([id, issues], n) => {
    const f = finals.get(id);
    const quotes = issues.flatMap((i) => [i.quote, ...(i.otherQuote ? [i.otherQuote] : [])]);
    // One de-identify call per case, so a placeholder means the same value in every line of it.
    const raw = [
      f?.description ?? "",
      highlight(f?.findings ?? "", quotes),
      ...issues.flatMap((i) => [i.quote, i.otherQuote ?? "", i.explanation]),
    ];
    const text = deidentified ? deidentify(raw).texts : raw;
    const heading = deidentified
      ? `## ${n + 1}. ${f?.modality ?? ""} ${text[0]}`
      : `## ${n + 1}. ${f?.accession_num || id}  ${f?.study_date.slice(0, 10) ?? ""}  ${f?.modality ?? ""} ${text[0]}`;
    parts.push(heading.trimEnd(), "");
    issues.forEach((i, k) => {
      const [quote, otherQuote, explanation] = text.slice(2 + k * 3, 5 + k * 3);
      parts.push(
        `### ${n + 1}-${k + 1} ${i.type} · ${i.variants.join(", ")}`,
        "",
        `- 근거: "${quote}"${otherQuote ? ` ↔ "${otherQuote}"` : ""}`,
        `- 설명: ${explanation}`,
        `- ${VERDICT_LINE}`,
        ""
      );
    });
    parts.push("<details><summary>소견 전문</summary>", "", text[1], "", "</details>", "");
  });
  return parts.join("\n");
}

export type Verdict = "real" | "false_alarm" | "unsure" | "unmarked";
type VerdictCounts = Record<Verdict, number>;

const emptyCounts = (): VerdictCounts => ({ real: 0, false_alarm: 0, unsure: 0, unmarked: 0 });

export interface VerdictTally {
  byType: Record<FindingsReviewType, VerdictCounts>;
  /** Each variant scored on the issues it reported. */
  byVariant: Record<string, VerdictCounts>;
}

/** Reads a marked review sheet back: one verdict per "### n-k <type> · <variants>" heading. */
export function tallyVerdicts(sheet: string): VerdictTally {
  const byType = Object.fromEntries(FINDINGS_REVIEW_TYPES.map((t) => [t, emptyCounts()])) as Record<
    FindingsReviewType,
    VerdictCounts
  >;
  const byVariant: Record<string, VerdictCounts> = {};
  let current: { type: FindingsReviewType; variants: string[] } | null = null;
  for (const line of sheet.split("\n")) {
    const h = line.match(/^###\s+\d+-\d+\s+(\w+)(?:\s+·\s+(.+))?$/);
    if (h) {
      const known = (FINDINGS_REVIEW_TYPES as readonly string[]).includes(h[1]);
      current = known
        ? { type: h[1] as FindingsReviewType, variants: (h[2] ?? "").split(",").map((v) => v.trim()).filter(Boolean) }
        : null;
      continue;
    }
    if (!current || !line.includes("판정:")) continue;
    const marks = [...line.matchAll(/\[([^\]]?)\]\s*([^[]+)/g)].filter((m) => m[1].trim() !== "");
    const label = marks.length === 1 ? marks[0][2].trim() : "";
    const verdict: Verdict = label.startsWith("오류")
      ? "real"
      : label.startsWith("거짓")
        ? "false_alarm"
        : label.startsWith("애매")
          ? "unsure"
          : "unmarked";
    byType[current.type][verdict]++;
    for (const v of current.variants) (byVariant[v] ??= emptyCounts())[verdict]++;
    current = null;
  }
  return { byType, byVariant };
}
