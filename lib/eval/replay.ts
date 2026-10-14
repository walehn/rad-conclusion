// lib/eval/replay.ts
// Offline replay: regenerate past inputs with candidate prompts and score the
// outputs against the conclusions the radiologist actually signed.
//
// Two case sets:
//   matched — A/B batches matched to a signed report. Input is what was typed
//             into the app, so it measures the real workflow.
//   pacs    — signed reports written without the app (not matched to any
//             batch). Input is the final PACS findings, so it measures the
//             house style given complete findings. Matched reports are left
//             out because their wording was seeded by the v2 output the
//             radiologist edited, which would favour v2.
// Cases from TEST_FROM on form the test split. Tune drafts on dev only; look at
// test once per draft, or the drafts end up fitted to it.

import { createHash } from "node:crypto";
import { generateText } from "ai";
import { postProcess } from "@/lib/post-process";
import { getModel, supportsReasoningEffort } from "@/lib/providers/registry";
import type { PromptCandidate } from "@/lib/prompts/candidates";
import { VERBATIM_THRESHOLD, editSimilarity, matchKey, normalizeConclusion, type FinalMatch, type FinalReport } from "./finals";
import { runRules, RULE_SEVERITY } from "./rules";
import type { SourceGeneration } from "./store";

export const REPLAY_MODEL = "deepseek-v4-flash-0731";
export const TEST_FROM = new Date("2026-10-01T00:00:00+09:00");
const STYLE = "numbered" as const;
const LANG = "en" as const;
const TITLE = "Conclusion";

export type CaseSet = "matched" | "pacs";
export type Split = "dev" | "test" | "all";

export interface ReplayCase {
  id: string;
  findings: string;
  reference: string;
  date: Date;
  split: "dev" | "test";
}

const splitOf = (d: Date): "dev" | "test" => (d >= TEST_FROM ? "test" : "dev");

export function matchedCases(
  gens: SourceGeneration[],
  finals: FinalReport[],
  matches: Map<string, FinalMatch>
): ReplayCase[] {
  const byKey = new Map(finals.map((f) => [f.study_key, f]));
  const out = new Map<string, ReplayCase>();
  for (const g of gens) {
    if (out.has(g.batchId)) continue;
    const f = byKey.get(matches.get(g.batchId)?.studyKey ?? "");
    if (!f || !f.conclusion.trim()) continue;
    out.set(g.batchId, { id: g.batchId, findings: g.findings, reference: f.conclusion, date: g.createdAt, split: splitOf(g.createdAt) });
  }
  return [...out.values()];
}

export function pacsCases(finals: FinalReport[], matches: Map<string, FinalMatch>): ReplayCase[] {
  const assisted = new Set([...matches.values()].map((m) => m.studyKey));
  return finals
    .filter((f) => !assisted.has(f.study_key) && matchKey(f.findings).length >= 30 && f.conclusion.trim())
    .map((f) => {
      const date = new Date(f.report_dttm);
      return { id: f.study_key, findings: f.findings, reference: f.conclusion, date, split: splitOf(date) };
    });
}

export function selectCases(cases: ReplayCase[], split: Split, limit?: number): ReplayCase[] {
  const chosen = cases
    .filter((c) => split === "all" || c.split === split)
    .sort((a, b) => a.date.getTime() - b.date.getTime() || a.id.localeCompare(b.id));
  if (!limit || chosen.length <= limit) return chosen;
  // Evenly spaced, so a limited run still spans the whole period.
  const step = chosen.length / limit;
  return Array.from({ length: limit }, (_, i) => chosen[Math.floor(i * step)]);
}

/** Identifies the rendered prompt text: editing a draft invalidates its stored outputs. */
export function candidateHash(c: PromptCandidate): string {
  return createHash("sha256")
    .update(c.buildSystem({ style: STYLE, lang: LANG, title: TITLE }))
    .update("\n<<<>>>\n")
    .update(c.buildUser("SAMPLE FINDINGS", TITLE))
    .digest("hex")
    .slice(0, 12);
}

export interface ReplayOutput {
  output: string;
  latencyMs: number;
}

/** One generation, with the parameters /api/generate uses for a local model. */
export async function generateForCase(c: PromptCandidate, findings: string, timeoutMs = 180_000): Promise<ReplayOutput> {
  const t0 = performance.now();
  const reasoningEffort = c.deepReasoning ? "medium" : "low";
  const res = await generateText({
    model: getModel("local", REPLAY_MODEL, { deepReasoning: c.deepReasoning }),
    system: c.buildSystem({ style: STYLE, lang: LANG, title: TITLE }),
    prompt: c.buildUser(findings, TITLE),
    temperature: 0.3,
    topP: 0.9,
    providerOptions: supportsReasoningEffort("local", REPLAY_MODEL) ? { openai: { reasoningEffort } } : undefined,
    maxRetries: 2,
    abortSignal: AbortSignal.timeout(timeoutMs),
  });
  return { output: postProcess(res.text, TITLE), latencyMs: Math.round(performance.now() - t0) };
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

const STYLE_MARKERS: [string, RegExp][] = [
  ["recommendation", /recommend|suggested\b|further (evaluation|work)|correlation|follow[- ]?up/i],
  ["em dash / semicolon", /[—;]/],
  ["little change", /little (interval )?change/i],
  ["stable / unchanged", /\b(stable|unchanged)\b/i],
  ["probably / suspicion", /\bprobabl|suspici|suspected/i],
  ["consistent / compatible / suggestive", /consistent with|compatible with|suggestive of|most likely/i],
];

export interface CandidateScore {
  candidate: string;
  n: number;
  meanSimilarity: number;
  /** Order-free content-word F1 against the signed conclusion: right content, different wording. */
  meanOverlap: number;
  verbatimRate: number;
  /** Outputs with at least one "suspect" rule flag (laterality, number, date, interval change). */
  suspectRate: number;
  violationRate: number;
  meanItems: number;
  meanLatencyMs: number;
  /** Share of outputs using each style marker; the reference row gives the target. */
  markers: Record<string, number>;
}

export interface PairedComparison {
  candidate: string;
  baseline: string;
  n: number;
  meanDelta: number;
  ci95: [number, number];
  wins: number;
  ties: number;
  losses: number;
}

const STOPWORDS = new Set(
  "a an the of in on at to and or with without for by from as is are was were be no not there this that its it".split(" ")
);

/** F1 of content words (multiset) between two conclusions. */
export function contentOverlap(a: string, b: string): number {
  const bag = (t: string) => {
    const m = new Map<string, number>();
    for (const w of normalizeConclusion(t).split(" ")) if (w && !STOPWORDS.has(w)) m.set(w, (m.get(w) ?? 0) + 1);
    return m;
  };
  const x = bag(a);
  const y = bag(b);
  const total = (m: Map<string, number>) => [...m.values()].reduce((s, v) => s + v, 0);
  let common = 0;
  for (const [w, n] of x) common += Math.min(n, y.get(w) ?? 0);
  const nx = total(x);
  const ny = total(y);
  if (!nx && !ny) return 1;
  if (!common) return 0;
  const precision = common / nx;
  const recall = common / ny;
  return (2 * precision * recall) / (precision + recall);
}

const itemCount = (t: string) => t.split("\n").filter((l) => l.trim()).length;
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
const share = (xs: string[], re: RegExp) => (xs.length ? xs.filter((x) => re.test(x)).length / xs.length : NaN);

export function markerShares(texts: string[]): Record<string, number> {
  return Object.fromEntries(STYLE_MARKERS.map(([name, re]) => [name, share(texts, re)]));
}

export function scoreCandidate(
  candidate: string,
  cases: ReplayCase[],
  outputs: Map<string, ReplayOutput>
): CandidateScore {
  const done = cases.filter((c) => outputs.has(c.id));
  const texts = done.map((c) => outputs.get(c.id)!.output);
  const sims = done.map((c, i) => editSimilarity(texts[i], c.reference));
  const flags = done.map((c, i) => runRules({ findings: c.findings, conclusion: texts[i], style: STYLE, lang: LANG }).flags);
  return {
    candidate,
    n: done.length,
    meanSimilarity: mean(sims),
    meanOverlap: mean(done.map((c, i) => contentOverlap(texts[i], c.reference))),
    verbatimRate: done.length ? sims.filter((s) => s >= VERBATIM_THRESHOLD).length / done.length : NaN,
    suspectRate: done.length ? flags.filter((f) => f.some((x) => RULE_SEVERITY[x.kind] === "suspect")).length / done.length : NaN,
    violationRate: done.length ? flags.filter((f) => f.some((x) => RULE_SEVERITY[x.kind] === "violation")).length / done.length : NaN,
    meanItems: mean(texts.map(itemCount)),
    meanLatencyMs: mean(done.map((c) => outputs.get(c.id)!.latencyMs)),
    markers: markerShares(texts),
  };
}

/** Deterministic PRNG so the bootstrap interval is reproducible. */
function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Similarity of candidate minus baseline, on cases both have, with a bootstrap 95% CI. */
export function comparePaired(
  candidate: string,
  baseline: string,
  cases: ReplayCase[],
  cand: Map<string, ReplayOutput>,
  base: Map<string, ReplayOutput>,
  resamples = 2000
): PairedComparison {
  const both = cases.filter((c) => cand.has(c.id) && base.has(c.id));
  const deltas = both.map(
    (c) => editSimilarity(cand.get(c.id)!.output, c.reference) - editSimilarity(base.get(c.id)!.output, c.reference)
  );
  const rand = mulberry32(20261014);
  const boots: number[] = [];
  for (let r = 0; r < resamples && deltas.length; r++) {
    let s = 0;
    for (let i = 0; i < deltas.length; i++) s += deltas[Math.floor(rand() * deltas.length)];
    boots.push(s / deltas.length);
  }
  boots.sort((a, b) => a - b);
  const q = (p: number) => (boots.length ? boots[Math.min(boots.length - 1, Math.floor(p * boots.length))] : NaN);
  return {
    candidate,
    baseline,
    n: deltas.length,
    meanDelta: mean(deltas),
    ci95: [q(0.025), q(0.975)],
    wins: deltas.filter((d) => d > 0.02).length,
    ties: deltas.filter((d) => Math.abs(d) <= 0.02).length,
    losses: deltas.filter((d) => d < -0.02).length,
  };
}
