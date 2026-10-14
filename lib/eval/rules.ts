// lib/eval/rules.ts
// Deterministic checks on one (findings, conclusion) pair.
//
// These are cheap, run on every generation, and need no model. They catch the
// errors that can be decided by string comparison alone: a side, number or
// date in the conclusion that the findings never mention, interval-change
// wording with no comparison in the findings, and output-format slips.
//
// A "suspect" flag is a lead, not a verdict: "2 lesions" against findings
// that say "two lesions" is flagged. The LLM judge decides clinical
// correctness; these flags tell you where to look and let you track drift.

import { DATE_PATTERNS } from "./deidentify";

/** Bump when a check changes, so stored results stay comparable. */
export const RULES_VERSION = "rules-1";

export type RuleSeverity = "violation" | "suspect" | "info";

export type RuleFlagKind =
  | "input_without_findings"
  | "format_not_numbered"
  | "format_title_line"
  | "format_filler_opener"
  | "format_markdown"
  | "lang_hangul_in_english"
  | "laterality_introduced"
  | "number_not_in_findings"
  | "date_not_in_findings"
  | "interval_change_introduced"
  | "recommendation_added";

export interface RuleFlag {
  kind: RuleFlagKind;
  severity: RuleSeverity;
  detail: string;
}

export interface RuleMetrics {
  findingsChars: number;
  conclusionChars: number;
  items: number;
  /** conclusionChars / findingsChars. */
  compression: number;
}

export interface RuleResult {
  flags: RuleFlag[];
  metrics: RuleMetrics;
}

export interface RuleInput {
  findings: string;
  /** Post-processed conclusion — the text the radiologist actually copies. */
  conclusion: string;
  style: string;
  lang: string;
}

export const RULE_SEVERITY: Record<RuleFlagKind, RuleSeverity> = {
  input_without_findings: "violation",
  format_not_numbered: "violation",
  format_title_line: "violation",
  format_filler_opener: "violation",
  format_markdown: "violation",
  lang_hangul_in_english: "violation",
  laterality_introduced: "suspect",
  number_not_in_findings: "suspect",
  date_not_in_findings: "suspect",
  interval_change_introduced: "suspect",
  recommendation_added: "info",
};

// ---------------------------------------------------------------------------
// Laterality
// ---------------------------------------------------------------------------

type Side = "left" | "right" | "bilateral";

// Each side is a list of patterns tested separately. Abbreviations are
// case-sensitive on purpose: all-caps "LT"/"RT" in these reports usually mean
// liver transplantation and radiotherapy, not a side. Bare 좌/우 only count
// before an organ, since 우 alone also ends words like 경우.
const SIDE_PATTERNS: Record<Side, readonly RegExp[]> = {
  left: [
    /\bleft\b/i,
    /\b[Ll]t\b/,
    /\bL(?:PV|HV|HA|K|UL|LL|UQ|LQ)\b/,
    /좌측|왼쪽|좌(?=[상중하]엽|신|폐|난소|부신|유방|요관)/,
  ],
  right: [
    /\bright\b/i,
    /\b[Rr]t\b/,
    /\bR(?:PV|HV|HA|K|UL|ML|LL|UQ|LQ)\b/,
    /우측|오른쪽|우(?=[상중하]엽|신|폐|난소|부신|유방|요관)/,
  ],
  // Bare "both" is usually "both lesions", not both sides.
  bilateral: [
    /\bbilateral\w*|\bboth (?:sides?|kidneys?|lungs?|adrenals?|ovaries|breasts?|ureters?|lobes?)\b/i,
    /양측|양쪽/,
  ],
};

// In the findings any "both <structure>" justifies a bilateral conclusion
// ("Both common iliac chain", even the typo "BBoth kidneys").
const FINDINGS_BOTH = /both\b/i;

function sidesIn(text: string): Set<Side> {
  const sides = new Set<Side>();
  for (const side of Object.keys(SIDE_PATTERNS) as Side[]) {
    if (SIDE_PATTERNS[side].some((re) => re.test(text))) sides.add(side);
  }
  return sides;
}

function introducedSides(findings: string, conclusion: string): Side[] {
  const allowed = sidesIn(findings);
  if (FINDINGS_BOTH.test(findings)) allowed.add("bilateral");
  // "bilateral" covers each side, and two sides together justify "bilateral".
  if (allowed.has("bilateral")) {
    allowed.add("left");
    allowed.add("right");
  }
  if (allowed.has("left") && allowed.has("right")) allowed.add("bilateral");
  return [...sidesIn(conclusion)].filter((s) => !allowed.has(s));
}

// ---------------------------------------------------------------------------
// Dates and numbers
// ---------------------------------------------------------------------------

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

// Sorted components, so "2025-09-16" and "September 16, 2025" compare equal.
// Day/month order is lost, which only matters for a swapped day and month.
function normalizeDate(raw: string): string {
  const parts = (raw.match(/\d+/g) ?? []).map((n) => parseInt(n, 10));
  const name = raw.match(/[A-Za-z]{3,}/);
  const month = name ? MONTHS.indexOf(name[0].slice(0, 3).toLowerCase()) : -1;
  if (month >= 0) parts.push(month + 1);
  return parts.sort((a, b) => a - b).join("-");
}

function datesIn(text: string): Set<string> {
  const dates = new Set<string>();
  for (const re of DATE_PATTERNS) {
    for (const m of text.match(re) ?? []) dates.add(normalizeDate(m));
  }
  return dates;
}

function stripDates(text: string): string {
  return DATE_PATTERNS.reduce((t, re) => t.replace(re, " "), text);
}

// List markers ("1. ") are structure, not content.
const LIST_MARKER = /^\s*\d+[.)]\s+/gm;

// A number with an optional letter prefix: "2.3", "S7", "L4", "T2".
const NUMBER_TOKEN = /[A-Za-z]*\d+(?:\.\d+)?/g;

function numberTokens(text: string, keepDates = false): string[] {
  const source = keepDates ? text : stripDates(text);
  return (source.replace(LIST_MARKER, " ").match(NUMBER_TOKEN) ?? []).map((t) => t.toLowerCase());
}

function sameValue(a: number, b: number): boolean {
  return Math.abs(a - b) < 1e-9;
}

const numericPart = (token: string) => parseFloat(token.replace(/^[a-z]+/, ""));

// "S7" in the findings is "segment 7" in the conclusion and vice versa, so a
// prefixed token also matches its bare number. The cost: an S7 -> S8 swap
// passes when an unrelated "8" appears in the findings.
function introducedNumbers(findings: string, conclusion: string): string[] {
  // Findings keep their dates: a conclusion may cite just the year ("LDLT in
  // 2011") of a date the date check cannot parse. Conclusion dates are
  // stripped because the date check already covers them.
  const known = new Set(numberTokens(findings, true));
  const knownValues = [...known].map(numericPart);
  const missing = new Set<string>();
  for (const token of numberTokens(conclusion)) {
    if (known.has(token)) continue;
    const v = numericPart(token);
    // Same value, or a cm <-> mm conversion of a number in the findings.
    if (knownValues.some((k) => sameValue(k, v) || sameValue(k, v * 10) || sameValue(k * 10, v))) {
      continue;
    }
    missing.add(token);
  }
  return [...missing];
}

// ---------------------------------------------------------------------------
// Interval change and recommendations
// ---------------------------------------------------------------------------

// "increased"/"decreased" are excluded: in reports they are mostly signal
// descriptors ("increased echogenicity"), not interval change. So are
// "prior"/"previous", which usually refer to treatment ("prior LDLT").
const CHANGE_EN =
  /\b(?:stable|unchanged|no (?:interval |significant )?change|little change|interval\w*|new(?:ly)?|resolv(?:ed|ing)|progress(?:ive|ion|ed)|improv(?:ed|ing|ement)|worsen(?:ed|ing)|persist(?:ent|s|ing)?|regress(?:ed|ion)|aggravat\w*|compared)\b/i;
const CHANGE_KO =
  /변화|생겼|생긴|발생|비슷|증가|감소|커[졌짐지진]|작아|늘어|줄어|새로|새롭|신규|호전|악화|소실|사라|여전|지속|이전|비교|전과|지난|유사|진행|그대로|흡수|증대|f\/u/i;

const RECOMMEND_EN =
  /\b(?:recommend\w*|suggested|follow[- ]?up|correlat\w*|consult\w*|further (?:evaluation|work-?up|assessment|imaging)|biopsy|advis\w*|warrant\w*)\b/i;
const RECOMMEND_KO = /권고|권장|추적|요망|필요|바람|상관|확인\s?요|고려|f\/u/i;

// ---------------------------------------------------------------------------
// Format
// ---------------------------------------------------------------------------

function checkNumbered(conclusion: string): string | null {
  const lines = conclusion.split("\n").filter((l) => l.trim());
  if (lines.some((l) => /^\s*(?:\(\d+\)|[-*•])\s/.test(l))) {
    return "uses (1) or bullet markers";
  }
  const numbers = lines
    .map((l) => l.match(/^\s*(\d+)\.\s/))
    .filter((m): m is RegExpMatchArray => m !== null)
    .map((m) => parseInt(m[1], 10));
  if (numbers.length === 0) return "no numbered items";
  if (!/^\s*1\.\s/.test(lines[0])) return "first line is not item 1";
  if (numbers.some((n, i) => n !== i + 1)) return `numbering ${numbers.join(",")}`;
  return null;
}

// ---------------------------------------------------------------------------

export function runRules(input: RuleInput): RuleResult {
  const { findings, conclusion, style, lang } = input;
  const flags: RuleFlag[] = [];
  const add = (kind: RuleFlagKind, detail: string) =>
    flags.push({ kind, severity: RULE_SEVERITY[kind], detail });

  // A pasted registration number or a stray keystroke still yields a fluent,
  // entirely invented conclusion; any conclusion for such input is an error.
  const words = findings.match(/[A-Za-z가-힣]{2,}/g) ?? [];
  if (words.length < 2) add("input_without_findings", `${findings.trim().length} chars, ${words.length} words`);

  if (style === "numbered") {
    const problem = checkNumbered(conclusion);
    if (problem) add("format_not_numbered", problem);
  }
  const title = conclusion.match(/^\s*\**(?:impression|conclusion|summary|결론|인상소견)\**\s*:/im);
  if (title) add("format_title_line", title[0].trim());
  const filler = conclusion.match(
    /^\s*(?:\d+\.\s*)?(?:in summary|overall,|based on the (?:above )?findings|to summarize)/im
  );
  if (filler) add("format_filler_opener", filler[0].trim());
  if (/\*\*|^#+\s/m.test(conclusion)) add("format_markdown", "markdown markup in output");
  if (lang === "en") {
    const hangul = conclusion.match(/[가-힣]+/g);
    if (hangul) add("lang_hangul_in_english", hangul.slice(0, 5).join(" "));
  }

  const sides = introducedSides(findings, conclusion);
  if (sides.length) add("laterality_introduced", sides.join(","));

  const findingsDates = datesIn(findings);
  const newDates = [...datesIn(conclusion)].filter((d) => !findingsDates.has(d));
  if (newDates.length) add("date_not_in_findings", newDates.join(","));

  const numbers = introducedNumbers(findings, conclusion);
  if (numbers.length) add("number_not_in_findings", numbers.join(","));

  const change = conclusion.match(CHANGE_EN);
  if (change && !CHANGE_EN.test(findings) && !CHANGE_KO.test(findings)) {
    add("interval_change_introduced", change[0]);
  }

  const rec = conclusion.match(RECOMMEND_EN);
  if (rec && !RECOMMEND_EN.test(findings) && !RECOMMEND_KO.test(findings)) {
    add("recommendation_added", rec[0]);
  }

  const items = (conclusion.match(/^\s*\d+\.\s/gm) ?? []).length ||
    conclusion.split("\n").filter((l) => l.trim()).length;
  const findingsChars = findings.trim().length;
  const conclusionChars = conclusion.trim().length;

  return {
    flags,
    metrics: {
      findingsChars,
      conclusionChars,
      items,
      compression: findingsChars ? +(conclusionChars / findingsChars).toFixed(3) : 0,
    },
  };
}
