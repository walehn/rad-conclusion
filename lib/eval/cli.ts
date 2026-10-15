/**
 * Quality evaluation of recorded conclusions.
 *
 *   npm run eval -- rules                       rule checks on new generations
 *   npm run eval -- judge --judge local         LLM judge on new generations
 *   npm run eval -- judge --judge gemini --limit 20
 *   npm run eval -- report [--by version|revision|model|month|all]
 *   npm run eval -- show <generation id>        one generation with its results
 *   npm run eval -- deid [--limit 20]           preview what an external judge receives
 *   npm run eval -- import-finals <reports.jsonl>
 *                                               import signed PACS reports (pft report-export)
 *                                               and re-match every batch to them
 *   npm run eval -- replay --candidates v2,r2 --set matched|pacs [--split dev|test|all]
 *                                               regenerate past inputs with candidate prompts
 *                                               (lib/prompts/candidates.ts) and score them
 *                                               against the signed conclusions
 *   npm run eval -- findings-review [--variants findings-review,findings-review-think]
 *                                               consistency review of signed Findings
 *                                               (lib/findings-review.ts); --sheet writes a
 *                                               review sheet to data/, --tally <sheet> counts
 *                                               the verdicts marked in it
 *
 * Common options:
 *   --since YYYY-MM-DD   only generations created on/after this date
 *   --ids 1,2,3          only these generation ids
 *
 * judge options:
 *   --concurrency N      parallel requests (default 4)
 *   --dry-run            print the first prompt and exit
 *
 * replay options:
 *   --split dev|test|all cases before / from 2026-10-01 (default dev)
 *   --limit N            evenly spaced subset of the split
 *   --concurrency N      parallel requests (default 4)
 *   --report-only        score stored outputs without generating
 *   --examples N         print N de-identified cases side by side
 *
 * findings-review options: --split (default all), --limit, --concurrency,
 * --report-only as for replay; --sheet; --examples N (de-identified issues only)
 *
 * Every command is incremental: rows already evaluated with the current
 * RULES_VERSION / RUBRIC_VERSION and judge are skipped; failed judgments are
 * retried. Results are stored in
 * data/eval.sqlite; data/auth.sqlite is opened read-only.
 */

import { chmodSync, readFileSync, writeFileSync } from "node:fs";
import { PROMPT_CANDIDATES } from "@/lib/prompts/candidates";
import { deidentify } from "./deidentify";
import { MATCHER_VERSION, editSimilarity, matchBatches, parseFinalReportsJsonl } from "./finals";
import {
  REPLAY_MODEL,
  candidateHash,
  comparePaired,
  generateForCase,
  markerShares,
  matchedCases,
  pacsCases,
  scoreCandidate,
  selectCases,
  type CaseSet,
  type Split,
} from "./replay";
import {
  REVIEW_CASE_SET,
  REVIEW_VARIANTS,
  renderReviewSheet,
  renderReviewSummaries,
  reviewAgreement,
  reviewForCase,
  reviewHash,
  signedCases,
  summarizeReviews,
  tallyVerdicts,
} from "./findings-review-run";
import { RULES_VERSION, runRules } from "./rules";
import { RUBRIC_HASH, RUBRIC_VERSION, type Judgment } from "./judge-prompt";
import { JUDGES, JudgeParseError, judgeInput, runJudge } from "./judges";
import {
  judgedIds,
  loadFinalMatches,
  loadFinalReports,
  loadGenerations,
  loadJudgments,
  loadReplays,
  loadRuleResults,
  openEvalDb,
  openSourceDb,
  replaceFinalMatches,
  ruledIds,
  saveFinalReports,
  saveJudgment,
  saveReplay,
  saveRuleResult,
  type LoadFilter,
} from "./store";
import {
  judgeAgreement,
  renderAgreement,
  renderFinalSummaries,
  renderJudgeSummaries,
  renderReplayScores,
  renderRuleSummaries,
  summarizeAdoption,
  summarizeFinals,
  summarizeJudge,
  summarizeRules,
  type GroupBy,
} from "./report";

function parseArgs(argv: string[]) {
  const positional: string[] = [];
  const flags: Record<string, string | true> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith("--")) {
        flags[a.slice(2)] = next;
        i++;
      } else {
        flags[a.slice(2)] = true;
      }
    } else {
      positional.push(a);
    }
  }
  return { positional, flags };
}

function str(flags: Record<string, string | true>, name: string): string | undefined {
  const v = flags[name];
  return typeof v === "string" ? v : undefined;
}

function loadFilter(flags: Record<string, string | true>): LoadFilter {
  const since = str(flags, "since");
  const ids = str(flags, "ids");
  return {
    since: since ? new Date(`${since}T00:00:00`) : undefined,
    ids: ids ? ids.split(",").map((s) => parseInt(s, 10)) : undefined,
  };
}

async function pool<T>(items: T[], size: number, fn: (item: T) => Promise<void>) {
  let next = 0;
  const workers = Array.from({ length: Math.min(size, items.length) }, async () => {
    while (next < items.length) await fn(items[next++]);
  });
  await Promise.all(workers);
}

function cmdRules(filter: LoadFilter) {
  const src = openSourceDb();
  const db = openEvalDb();
  const done = ruledIds(db, RULES_VERSION);
  const todo = loadGenerations(src, filter).filter((g) => !done.has(g.id));
  const save = db.transaction(() => {
    for (const g of todo) saveRuleResult(db, g.id, RULES_VERSION, runRules(g));
  });
  save();
  console.log(`rules ${RULES_VERSION}: evaluated ${todo.length}, skipped ${done.size} already done`);
}

async function cmdJudge(flags: Record<string, string | true>, filter: LoadFilter) {
  const name = str(flags, "judge") ?? "local";
  const spec = JUDGES[name];
  if (!spec) throw new Error(`unknown judge "${name}" (choose: ${Object.keys(JUDGES).join(", ")})`);
  const src = openSourceDb();
  const db = openEvalDb();
  const done = judgedIds(db, spec.id, RUBRIC_VERSION);
  let todo = loadGenerations(src, filter).filter((g) => !done.has(g.id));
  const limit = str(flags, "limit");
  if (limit) todo = todo.slice(0, parseInt(limit, 10));

  if (flags["dry-run"]) {
    const g = todo[0];
    if (!g) return console.log("nothing to judge");
    const { system, prompt } = judgeInput(g.findings, g.conclusion);
    console.log(`--- generation ${g.id} -> ${spec.id}\n--- system\n${system}\n--- user\n${prompt}`);
    return;
  }

  const concurrency = parseInt(str(flags, "concurrency") ?? "4", 10);
  console.log(
    `judge ${spec.id} (${spec.external ? "external, de-identified" : "local"}), rubric ${RUBRIC_VERSION}/${RUBRIC_HASH}: ` +
      `${todo.length} to judge, concurrency ${concurrency}`
  );
  let ok = 0;
  let failed = 0;
  const t0 = Date.now();
  await pool(todo, concurrency, async (g) => {
    const base = {
      generationId: g.id,
      judgeId: spec.id,
      rubricVersion: RUBRIC_VERSION,
      rubricHash: RUBRIC_HASH,
    };
    try {
      const out = await runJudge(spec, g.findings, g.conclusion);
      saveJudgment(db, { ...base, status: "ok", ...out });
      ok++;
    } catch (error) {
      failed++;
      const message = error instanceof Error ? error.message : String(error);
      saveJudgment(db, {
        ...base,
        status: "error",
        error: message,
        raw: error instanceof JudgeParseError ? error.raw : undefined,
      });
      console.error(`  #${g.id} failed: ${message.slice(0, 200)}`);
    }
    const n = ok + failed;
    if (n % 10 === 0 || n === todo.length) {
      const sec = (Date.now() - t0) / 1000;
      console.log(`  ${n}/${todo.length}  ok ${ok}  failed ${failed}  ${sec.toFixed(0)}s`);
    }
  });
}

function cmdReport(flags: Record<string, string | true>, filter: LoadFilter) {
  const by = (str(flags, "by") ?? "version") as GroupBy;
  const src = openSourceDb();
  const db = openEvalDb();
  const gens = loadGenerations(src, filter);

  console.log(`\n=== Rule checks (${RULES_VERSION}) by ${by}\n`);
  console.log(renderRuleSummaries(summarizeRules(gens, loadRuleResults(db, RULES_VERSION), by)));

  const { ok, failed } = loadJudgments(db, RUBRIC_VERSION);
  for (const [judgeId, judgments] of ok) {
    const f = failed.get(judgeId) ?? 0;
    console.log(`\n=== Judge ${judgeId} (rubric ${RUBRIC_VERSION}) by ${by}${f ? `  [${f} failed]` : ""}\n`);
    console.log(renderJudgeSummaries(summarizeJudge(gens, judgeId, judgments, by)));
  }

  const judges = [...ok.keys()];
  const genIds = new Set(gens.map((g) => g.id));
  const inFilter = (m: Map<number, Judgment>) =>
    new Map([...m].filter(([id]) => genIds.has(id)));
  for (let i = 0; i < judges.length; i++) {
    for (let j = i + 1; j < judges.length; j++) {
      const a = judgeAgreement(
        judges[i],
        inFilter(ok.get(judges[i])!),
        judges[j],
        inFilter(ok.get(judges[j])!)
      );
      console.log(`\n=== Agreement ${judges[i]} vs ${judges[j]}\n`);
      console.log(renderAgreement(a));
    }
  }

  const finals = loadFinalReports(db);
  if (finals.length) {
    const matches = loadFinalMatches(db, MATCHER_VERSION);
    console.log(`\n=== Against signed reports (${finals.length} imported, matcher ${MATCHER_VERSION}) by ${by}\n`);
    console.log(
      renderFinalSummaries(
        summarizeFinals(gens, finals, matches, by),
        summarizeAdoption(gens, finals, matches, by)
      )
    );
  }
  console.log("");
}

function cmdImportFinals(file: string) {
  if (!file) throw new Error("usage: npm run eval -- import-finals <reports.jsonl>");
  const { reports, invalid } = parseFinalReportsJsonl(readFileSync(file, "utf-8"));
  const db = openEvalDb();
  saveFinalReports(db, reports);
  const finals = loadFinalReports(db);

  // One entry per batch: v1 and v2 share the findings.
  const batches = new Map<string, { batchId: string; findings: string; createdAt: Date }>();
  for (const g of loadGenerations(openSourceDb())) {
    if (!batches.has(g.batchId)) {
      batches.set(g.batchId, { batchId: g.batchId, findings: g.findings, createdAt: g.createdAt });
    }
  }
  const matches = matchBatches([...batches.values()], finals);
  replaceFinalMatches(db, MATCHER_VERSION, matches);
  console.log(
    `imported ${reports.length} reports (${invalid} invalid lines), ${finals.length} stored; ` +
      `matched ${matches.length}/${batches.size} batches (matcher ${MATCHER_VERSION})`
  );
}

async function cmdReplay(flags: Record<string, string | true>) {
  const names = (str(flags, "candidates") ?? "v2,r2").split(",").map((s) => s.trim());
  const candidates = names.map((n) => {
    const c = PROMPT_CANDIDATES[n];
    if (!c) throw new Error(`unknown candidate "${n}" (choose: ${Object.keys(PROMPT_CANDIDATES).join(", ")})`);
    return c;
  });
  const set = (str(flags, "set") ?? "matched") as CaseSet;
  if (set !== "matched" && set !== "pacs") throw new Error(`--set must be matched or pacs`);
  const split = (str(flags, "split") ?? "dev") as Split;
  const limit = str(flags, "limit") ? parseInt(str(flags, "limit")!, 10) : undefined;
  const concurrency = parseInt(str(flags, "concurrency") ?? "4", 10);

  const db = openEvalDb();
  const finals = loadFinalReports(db);
  const matches = loadFinalMatches(db, MATCHER_VERSION);
  const all =
    set === "matched" ? matchedCases(loadGenerations(openSourceDb()), finals, matches) : pacsCases(finals, matches);
  const cases = selectCases(all, split, limit);
  console.log(`replay set ${set}, split ${split}: ${cases.length} cases (of ${all.length}), model ${REPLAY_MODEL}`);

  const keys = candidates.map((c) => ({ candidate: c.id, promptHash: candidateHash(c), model: REPLAY_MODEL, caseSet: set }));
  if (!flags["report-only"]) {
    for (const [i, c] of candidates.entries()) {
      const have = loadReplays(db, keys[i]);
      const todo = cases.filter((x) => !have.has(x.id));
      console.log(`  ${c.id} (${keys[i].promptHash}): ${todo.length} to generate`);
      let n = 0;
      let failed = 0;
      const t0 = Date.now();
      await pool(todo, concurrency, async (x) => {
        try {
          saveReplay(db, keys[i], x.id, await generateForCase(c, x.findings));
        } catch (error) {
          failed++;
          saveReplay(db, keys[i], x.id, { error: error instanceof Error ? error.message : String(error) });
        }
        if (++n % 20 === 0 || n === todo.length) {
          console.log(`    ${n}/${todo.length}  failed ${failed}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
        }
      });
    }
  }

  const outputs = keys.map((k) => loadReplays(db, k));
  // Score every candidate on the cases all of them have, so the rows compare.
  const common = cases.filter((x) => outputs.every((o) => o.has(x.id)));
  console.log(renderReplayScores(
    candidates.map((c, i) => scoreCandidate(c.id, common, outputs[i])),
    markerShares(common.map((x) => x.reference)),
    candidates.slice(1).map((c, i) => comparePaired(c.id, candidates[0].id, common, outputs[i + 1], outputs[0]))
  ));

  const examples = parseInt(str(flags, "examples") ?? "0", 10);
  for (const x of selectCases(common, "all", examples).slice(0, examples)) {
    const texts = [x.findings, x.reference, ...outputs.map((o) => o.get(x.id)!.output)];
    const { texts: d } = deidentify(texts);
    console.log(`\n=== ${x.id} (${x.split})\n--- findings\n${d[0]}\n--- signed\n${d[1]}`);
    candidates.forEach((c, i) => {
      console.log(`--- ${c.id}  (similarity ${editSimilarity(texts[i + 2], x.reference).toFixed(2)})\n${d[i + 2]}`);
    });
  }
}

async function cmdFindingsReview(flags: Record<string, string | true>) {
  const sheetPath = str(flags, "tally");
  if (sheetPath) {
    const tally = tallyVerdicts(readFileSync(sheetPath, "utf8"));
    const row = (name: string, t: { real: number; false_alarm: number; unsure: number; unmarked: number }) => {
      const decided = t.real + t.false_alarm;
      const precision = decided ? `${((t.real / decided) * 100).toFixed(0)}%` : "-";
      return (
        `${name.padEnd(22)}  ${String(t.real).padStart(4)}  ${String(t.false_alarm).padStart(11)}  ` +
        `${String(t.unsure).padStart(6)}  ${String(t.unmarked).padStart(8)}  ${precision}`
      );
    };
    const head = `${"".padEnd(22)}  real  false alarm  unsure  unmarked  precision (real / decided)`;
    console.log(head);
    for (const [type, t] of Object.entries(tally.byType)) console.log(row(type, t));
    console.log(`\n${head}`);
    for (const [variant, t] of Object.entries(tally.byVariant)) console.log(row(variant, t));
    return;
  }

  const names = (str(flags, "variants") ?? "findings-review").split(",").map((s) => s.trim());
  const variants = names.map((n) => {
    const v = REVIEW_VARIANTS[n];
    if (!v) throw new Error(`unknown variant "${n}" (choose: ${Object.keys(REVIEW_VARIANTS).join(", ")})`);
    return v;
  });
  const split = (str(flags, "split") ?? "all") as Split;
  const limit = str(flags, "limit") ? parseInt(str(flags, "limit")!, 10) : undefined;
  const concurrency = parseInt(str(flags, "concurrency") ?? "4", 10);

  const db = openEvalDb();
  const finals = loadFinalReports(db);
  const all = signedCases(finals);
  const cases = selectCases(all, split, limit);
  console.log(`findings-review split ${split}: ${cases.length} cases (of ${all.length}), model ${REPLAY_MODEL}`);

  const keys = variants.map((v) => ({ candidate: v.id, promptHash: reviewHash(v), model: REPLAY_MODEL, caseSet: REVIEW_CASE_SET }));
  if (!flags["report-only"]) {
    for (const [i, v] of variants.entries()) {
      const have = loadReplays(db, keys[i]);
      const todo = cases.filter((x) => !have.has(x.id));
      console.log(`  ${v.id} (${keys[i].promptHash}): ${todo.length} to review`);
      let n = 0;
      let failed = 0;
      const t0 = Date.now();
      await pool(todo, concurrency, async (x) => {
        try {
          saveReplay(db, keys[i], x.id, await reviewForCase(v, x.findings));
        } catch (error) {
          failed++;
          saveReplay(db, keys[i], x.id, { error: error instanceof Error ? error.message : String(error) });
        }
        if (++n % 20 === 0 || n === todo.length) {
          console.log(`    ${n}/${todo.length}  failed ${failed}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
        }
      });
    }
  }

  const outputs = keys.map((k) => loadReplays(db, k));
  const common = cases.filter((x) => outputs.every((o) => o.has(x.id)));
  const results = variants.map((v, i) => summarizeReviews(v.id, common, outputs[i]));
  console.log(renderReviewSummaries(results.map((r) => r.summary)));
  if (results.length === 2) {
    const a = reviewAgreement(results[0].reviews, results[1].reviews);
    console.log(
      `flagged by both ${a.both}, only ${variants[0].id} ${a.onlyA}, only ${variants[1].id} ${a.onlyB}, neither ${a.neither}`
    );
  }

  const byKey = new Map(finals.map((f) => [f.study_key, f]));
  if (flags.sheet) {
    const base = `data/findings-review-${keys.map((k) => k.promptHash).join("-")}`;
    const sheetVariants = variants.map((v, i) => ({ id: v.id, promptHash: keys[i].promptHash, reviews: results[i].reviews }));
    for (const [path, deidentified] of [[`${base}.md`, false], [`${base}-deid.md`, true]] as const) {
      writeFileSync(path, renderReviewSheet(sheetVariants, byKey, { deidentified }));
      chmodSync(path, 0o600);
      console.log(`review sheet: ${path}${deidentified ? " (de-identified)" : ""}`);
    }
  }

  const examples = parseInt(str(flags, "examples") ?? "0", 10);
  for (const [i, v] of variants.entries()) {
    const flagged = [...results[i].reviews].filter(([, r]) => r.issues.length).slice(0, examples);
    for (const [id, r] of flagged) {
      const texts = r.issues.flatMap((x) => [x.quote, x.otherQuote ?? "", x.explanation]);
      const { texts: d } = deidentify(texts);
      console.log(`\n=== ${v.id} ${id}`);
      r.issues.forEach((x, k) => {
        console.log(`  [${x.type}] "${d[k * 3]}"${x.otherQuote ? ` <-> "${d[k * 3 + 1]}"` : ""}\n    ${d[k * 3 + 2]}`);
      });
    }
  }
}

function cmdShow(id: number) {
  const src = openSourceDb();
  const db = openEvalDb();
  const [g] = loadGenerations(src, { ids: [id] });
  if (!g) throw new Error(`generation ${id} not found`);
  console.log(`#${g.id}  ${g.promptVersion}/${g.promptRevision}  ${g.model}  ${g.createdAt.toISOString()}`);
  console.log(`\n--- findings\n${g.findings}\n\n--- conclusion\n${g.conclusion}`);
  const rules = loadRuleResults(db, RULES_VERSION).get(id);
  console.log(`\n--- rules ${RULES_VERSION}\n${rules ? JSON.stringify(rules, null, 2) : "(not run)"}`);
  const { ok } = loadJudgments(db, RUBRIC_VERSION);
  for (const [judgeId, m] of ok) {
    const j = m.get(id);
    if (j) console.log(`\n--- ${judgeId}\n${JSON.stringify(j, null, 2)}`);
  }
  const match = loadFinalMatches(db, MATCHER_VERSION).get(g.batchId);
  const signed = match && loadFinalReports(db).find((f) => f.study_key === match.studyKey);
  if (signed) {
    console.log(
      `\n--- signed report (match score ${match.score.toFixed(2)}, runner-up ${match.runnerUp.toFixed(2)}, ` +
        `signed ${signed.report_dttm})\n${signed.conclusion}`
    );
  }
}

function cmdDeid(flags: Record<string, string | true>, filter: LoadFilter) {
  const src = openSourceDb();
  const gens = loadGenerations(src, filter);
  const totals = { date: 0, id: 0, hospital: 0 };
  let touched = 0;
  const limit = parseInt(str(flags, "limit") ?? "10", 10);
  let shown = 0;
  for (const g of gens) {
    const { prompt, replaced } = judgeInput(g.findings, g.conclusion);
    const n = replaced.date + replaced.id + replaced.hospital;
    totals.date += replaced.date;
    totals.id += replaced.id;
    totals.hospital += replaced.hospital;
    if (n === 0) continue;
    touched++;
    if (shown++ < limit) console.log(`--- #${g.id} ${JSON.stringify(replaced)}\n${prompt}\n`);
  }
  console.log(`${gens.length} generations, ${touched} with replacements; totals ${JSON.stringify(totals)}`);
}

async function main() {
  const { positional, flags } = parseArgs(process.argv.slice(2));
  const [command, arg] = positional;
  const filter = loadFilter(flags);
  switch (command) {
    case "rules":
      return cmdRules(filter);
    case "judge":
      return cmdJudge(flags, filter);
    case "report":
      return cmdReport(flags, filter);
    case "show":
      return cmdShow(parseInt(arg, 10));
    case "deid":
      return cmdDeid(flags, filter);
    case "import-finals":
      return cmdImportFinals(arg);
    case "replay":
      return cmdReplay(flags);
    case "findings-review":
      return cmdFindingsReview(flags);
    default:
      console.log(
        "usage: npm run eval -- <rules|judge|report|show|deid|import-finals|replay|findings-review> [options] (see lib/eval/cli.ts)"
      );
      process.exit(command ? 1 : 0);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
