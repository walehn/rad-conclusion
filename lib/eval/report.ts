// lib/eval/report.ts
// Aggregates stored rule results and judgments into monitoring metrics.
//
// Headline metric: share of conclusions with at least one clinically
// significant error, per judge. Everything else explains that number.
// Grouping by prompt revision, model or month is what makes it a monitor:
// a new revision should not raise it.

import {
  ACCEPTABILITY,
  ERROR_CATEGORIES,
  type Acceptability,
  type ErrorCategory,
  type Judgment,
} from "./judge-prompt";
import {
  ADOPTED_THRESHOLD,
  VERBATIM_THRESHOLD,
  editSimilarity,
  type FinalMatch,
  type FinalReport,
} from "./finals";
import { RULE_SEVERITY, type RuleFlagKind, type RuleResult } from "./rules";
import type { SourceGeneration } from "./store";

export type GroupBy = "all" | "version" | "revision" | "model" | "month";

export function groupKey(g: SourceGeneration, by: GroupBy): string {
  switch (by) {
    case "all":
      return "all";
    case "version":
      return g.promptVersion;
    case "revision":
      return `${g.promptRevision ?? "none"}/${g.promptVersion}`;
    case "model":
      return g.model;
    case "month": {
      const d = g.createdAt;
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    }
  }
}

function groupBy<T>(items: T[], key: (t: T) => string): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    if (!out.has(k)) out.set(k, []);
    out.get(k)!.push(item);
  }
  return new Map([...out.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
const rate = (hit: number, n: number) => (n ? hit / n : NaN);

// ---------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------

export interface RuleSummary {
  group: string;
  n: number;
  /** Share with at least one format/language violation. */
  violationRate: number;
  /** Share with at least one suspect flag. */
  suspectRate: number;
  flagRates: Record<RuleFlagKind, number>;
  meanItems: number;
  meanCompression: number;
}

export function summarizeRules(
  gens: SourceGeneration[],
  results: Map<number, RuleResult>,
  by: GroupBy
): RuleSummary[] {
  const scored = gens.filter((g) => results.has(g.id));
  return [...groupBy(scored, (g) => groupKey(g, by))].map(([group, rows]) => {
    const rs = rows.map((g) => results.get(g.id)!);
    const kinds = Object.keys(RULE_SEVERITY) as RuleFlagKind[];
    const hasSeverity = (r: RuleResult, s: string) => r.flags.some((f) => f.severity === s);
    return {
      group,
      n: rs.length,
      violationRate: rate(rs.filter((r) => hasSeverity(r, "violation")).length, rs.length),
      suspectRate: rate(rs.filter((r) => hasSeverity(r, "suspect")).length, rs.length),
      flagRates: Object.fromEntries(
        kinds.map((k) => [k, rate(rs.filter((r) => r.flags.some((f) => f.kind === k)).length, rs.length)])
      ) as Record<RuleFlagKind, number>,
      meanItems: mean(rs.map((r) => r.metrics.items)),
      meanCompression: mean(rs.map((r) => r.metrics.compression)),
    };
  });
}

// ---------------------------------------------------------------------------
// Judgments
// ---------------------------------------------------------------------------

export interface JudgeSummary {
  group: string;
  judgeId: string;
  n: number;
  /** Headline: share with >= 1 significant error. */
  significantErrorRate: number;
  anyErrorRate: number;
  meanErrors: number;
  categories: Record<ErrorCategory, { significant: number; minor: number }>;
  acceptability: Record<Acceptability, number>;
  meanPriority: number;
  meanConciseness: number;
  /** Share of high-importance findings fully covered. */
  highCoverage: number;
}

export function summarizeJudge(
  gens: SourceGeneration[],
  judgeId: string,
  judgments: Map<number, Judgment>,
  by: GroupBy
): JudgeSummary[] {
  const scored = gens.filter((g) => judgments.has(g.id));
  return [...groupBy(scored, (g) => groupKey(g, by))].map(([group, rows]) => {
    const js = rows.map((g) => judgments.get(g.id)!);
    const categories = Object.fromEntries(
      ERROR_CATEGORIES.map((c) => [c, { significant: 0, minor: 0 }])
    ) as JudgeSummary["categories"];
    for (const j of js) for (const e of j.errors) categories[e.category][e.significance]++;
    const high = js.flatMap((j) => j.key_findings.filter((k) => k.importance === "high"));
    return {
      group,
      judgeId,
      n: js.length,
      significantErrorRate: rate(
        js.filter((j) => j.errors.some((e) => e.significance === "significant")).length,
        js.length
      ),
      anyErrorRate: rate(js.filter((j) => j.errors.length > 0).length, js.length),
      meanErrors: mean(js.map((j) => j.errors.length)),
      categories,
      acceptability: Object.fromEntries(
        ACCEPTABILITY.map((a) => [a, rate(js.filter((j) => j.acceptability === a).length, js.length)])
      ) as Record<Acceptability, number>,
      meanPriority: mean(js.map((j) => j.priority_order)),
      meanConciseness: mean(js.map((j) => j.conciseness)),
      highCoverage: rate(high.filter((k) => k.covered === "yes").length, high.length),
    };
  });
}

// ---------------------------------------------------------------------------
// Judge agreement
// ---------------------------------------------------------------------------

/** Cohen's kappa for two raters over categories 0..k-1, optionally weighted. */
export function cohenKappa(
  a: number[],
  b: number[],
  k: number,
  weighting: "none" | "quadratic" = "none"
): number {
  const n = a.length;
  if (n === 0 || n !== b.length) return NaN;
  const w = (i: number, j: number) =>
    weighting === "quadratic" ? ((i - j) * (i - j)) / ((k - 1) * (k - 1)) : i === j ? 0 : 1;
  const obs = Array.from({ length: k }, () => new Array(k).fill(0));
  const ra = new Array(k).fill(0);
  const rb = new Array(k).fill(0);
  for (let i = 0; i < n; i++) {
    obs[a[i]][b[i]]++;
    ra[a[i]]++;
    rb[b[i]]++;
  }
  let observed = 0;
  let expected = 0;
  for (let i = 0; i < k; i++) {
    for (let j = 0; j < k; j++) {
      observed += w(i, j) * obs[i][j];
      expected += (w(i, j) * ra[i] * rb[j]) / n;
    }
  }
  return expected === 0 ? 1 : 1 - observed / expected;
}

export interface Agreement {
  judgeA: string;
  judgeB: string;
  n: number;
  acceptabilityExact: number;
  acceptabilityKappaQ: number;
  significantAgreement: number;
  significantKappa: number;
  /** Significant-error rate per judge on the shared set. */
  significantRateA: number;
  significantRateB: number;
}

export function judgeAgreement(
  judgeA: string,
  a: Map<number, Judgment>,
  judgeB: string,
  b: Map<number, Judgment>
): Agreement {
  const ids = [...a.keys()].filter((id) => b.has(id));
  const acc = (j: Judgment) => ACCEPTABILITY.indexOf(j.acceptability);
  const sig = (j: Judgment) => (j.errors.some((e) => e.significance === "significant") ? 1 : 0);
  const accA = ids.map((id) => acc(a.get(id)!));
  const accB = ids.map((id) => acc(b.get(id)!));
  const sigA = ids.map((id) => sig(a.get(id)!));
  const sigB = ids.map((id) => sig(b.get(id)!));
  return {
    judgeA,
    judgeB,
    n: ids.length,
    acceptabilityExact: rate(accA.filter((v, i) => v === accB[i]).length, ids.length),
    acceptabilityKappaQ: cohenKappa(accA, accB, ACCEPTABILITY.length, "quadratic"),
    significantAgreement: rate(sigA.filter((v, i) => v === sigB[i]).length, ids.length),
    significantKappa: cohenKappa(sigA, sigB, 2),
    significantRateA: mean(sigA),
    significantRateB: mean(sigB),
  };
}

// ---------------------------------------------------------------------------
// Against signed reports
// ---------------------------------------------------------------------------

export interface FinalSummary {
  group: string;
  /** Generations in the group whose batch matched a signed report. */
  n: number;
  /** Generations in the group, matched or not. */
  total: number;
  meanSimilarity: number;
  /** Share signed (nearly) as generated. */
  verbatimRate: number;
}

export interface AdoptionSummary {
  group: string;
  /** Matched A/B batches. */
  batches: number;
  /** Share of batches whose signed conclusion is closest to each version. */
  v1: number;
  v2: number;
  tie: number;
  /** Neither version resembles what was signed. */
  neither: number;
}

/** Signed conclusion for each generation whose batch matched. */
function signedByGeneration(
  gens: SourceGeneration[],
  finals: FinalReport[],
  matches: Map<string, FinalMatch>
): Map<number, string> {
  const byKey = new Map(finals.map((f) => [f.study_key, f]));
  const out = new Map<number, string>();
  for (const g of gens) {
    const m = matches.get(g.batchId);
    const f = m && byKey.get(m.studyKey);
    if (f) out.set(g.id, f.conclusion);
  }
  return out;
}

export function summarizeFinals(
  gens: SourceGeneration[],
  finals: FinalReport[],
  matches: Map<string, FinalMatch>,
  by: GroupBy
): FinalSummary[] {
  const signed = signedByGeneration(gens, finals, matches);
  return [...groupBy(gens, (g) => groupKey(g, by))].map(([group, rows]) => {
    const sims = rows
      .filter((g) => signed.has(g.id))
      .map((g) => editSimilarity(g.conclusion, signed.get(g.id)!));
    return {
      group,
      n: sims.length,
      total: rows.length,
      meanSimilarity: mean(sims),
      verbatimRate: rate(sims.filter((x) => x >= VERBATIM_THRESHOLD).length, sims.length),
    };
  });
}

/**
 * Which prompt version the radiologist actually used, per A/B batch. This is
 * the revealed preference the vote button was meant to collect.
 * Grouping by version makes no sense here, so it falls back to "all".
 */
export function summarizeAdoption(
  gens: SourceGeneration[],
  finals: FinalReport[],
  matches: Map<string, FinalMatch>,
  by: GroupBy
): AdoptionSummary[] {
  const signed = signedByGeneration(gens, finals, matches);
  const batches = groupBy(
    gens.filter((g) => signed.has(g.id)),
    (g) => g.batchId
  );
  const outcomes: { group: string; outcome: "v1" | "v2" | "tie" | "neither" }[] = [];
  for (const rows of batches.values()) {
    const sim = (v: string) => {
      const g = rows.find((r) => r.promptVersion === v);
      return g ? editSimilarity(g.conclusion, signed.get(g.id)!) : NaN;
    };
    const s1 = sim("v1");
    const s2 = sim("v2");
    if (Number.isNaN(s1) || Number.isNaN(s2)) continue;
    const outcome =
      Math.max(s1, s2) < ADOPTED_THRESHOLD
        ? "neither"
        : Math.abs(s1 - s2) < 0.02
          ? "tie"
          : s1 > s2
            ? "v1"
            : "v2";
    outcomes.push({ group: groupKey(rows[0], by === "version" ? "all" : by), outcome });
  }
  return [...groupBy(outcomes, (o) => o.group)].map(([group, os]) => ({
    group,
    batches: os.length,
    v1: rate(os.filter((o) => o.outcome === "v1").length, os.length),
    v2: rate(os.filter((o) => o.outcome === "v2").length, os.length),
    tie: rate(os.filter((o) => o.outcome === "tie").length, os.length),
    neither: rate(os.filter((o) => o.outcome === "neither").length, os.length),
  }));
}

// ---------------------------------------------------------------------------
// Text rendering for the CLI
// ---------------------------------------------------------------------------

const pct = (x: number) => (Number.isNaN(x) ? "-" : `${(x * 100).toFixed(1)}%`);
const num = (x: number, d = 2) => (Number.isNaN(x) ? "-" : x.toFixed(d));

function table(header: string[], rows: string[][]): string {
  const widths = header.map((h, i) => Math.max(h.length, ...rows.map((r) => r[i].length)));
  const line = (cells: string[]) => cells.map((c, i) => c.padEnd(widths[i])).join("  ");
  return [line(header), widths.map((w) => "-".repeat(w)).join("  "), ...rows.map(line)].join("\n");
}

export function renderRuleSummaries(rows: RuleSummary[]): string {
  const kinds = Object.keys(RULE_SEVERITY) as RuleFlagKind[];
  const main = table(
    ["group", "n", "violation", "suspect", "items", "compress"],
    rows.map((r) => [
      r.group,
      String(r.n),
      pct(r.violationRate),
      pct(r.suspectRate),
      num(r.meanItems, 1),
      num(r.meanCompression),
    ])
  );
  const byKind = table(
    ["flag", ...rows.map((r) => r.group)],
    kinds.map((k) => [k, ...rows.map((r) => pct(r.flagRates[k]))])
  );
  return `${main}\n\n${byKind}`;
}

export function renderJudgeSummaries(rows: JudgeSummary[]): string {
  const main = table(
    ["group", "n", "sig.err", "any.err", "errs/rpt", "accept", "minor", "major", "reject", "prio", "concise", "hi.cover"],
    rows.map((r) => [
      r.group,
      String(r.n),
      pct(r.significantErrorRate),
      pct(r.anyErrorRate),
      num(r.meanErrors),
      pct(r.acceptability.accept),
      pct(r.acceptability.minor_edit),
      pct(r.acceptability.major_edit),
      pct(r.acceptability.reject),
      num(r.meanPriority),
      num(r.meanConciseness),
      pct(r.highCoverage),
    ])
  );
  const cats = table(
    ["error (significant/minor)", ...rows.map((r) => r.group)],
    ERROR_CATEGORIES.map((c) => [
      c,
      ...rows.map((r) => `${r.categories[c].significant}/${r.categories[c].minor}`),
    ])
  );
  return `${main}\n\n${cats}`;
}

export function renderAgreement(a: Agreement): string {
  return table(
    ["metric", "value"],
    [
      ["shared judgments", String(a.n)],
      ["acceptability exact agreement", pct(a.acceptabilityExact)],
      ["acceptability kappa (quadratic)", num(a.acceptabilityKappaQ)],
      ["significant-error agreement", pct(a.significantAgreement)],
      ["significant-error kappa", num(a.significantKappa)],
      [`significant-error rate ${a.judgeA}`, pct(a.significantRateA)],
      [`significant-error rate ${a.judgeB}`, pct(a.significantRateB)],
    ]
  );
}

export function renderFinalSummaries(rows: FinalSummary[], adoption: AdoptionSummary[]): string {
  const sim = table(
    ["group", "matched", "of", "similarity", "verbatim"],
    rows.map((r) => [r.group, String(r.n), String(r.total), num(r.meanSimilarity), pct(r.verbatimRate)])
  );
  const adopt = table(
    ["group", "A/B batches", "used v1", "used v2", "tie", "neither"],
    adoption.map((a) => [a.group, String(a.batches), pct(a.v1), pct(a.v2), pct(a.tie), pct(a.neither)])
  );
  return `${sim}\n\n${adopt}`;
}
