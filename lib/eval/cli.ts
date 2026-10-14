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
 *
 * Common options:
 *   --since YYYY-MM-DD   only generations created on/after this date
 *   --ids 1,2,3          only these generation ids
 *
 * judge options:
 *   --concurrency N      parallel requests (default 4)
 *   --dry-run            print the first prompt and exit
 *
 * Every command is incremental: rows already evaluated with the current
 * RULES_VERSION / RUBRIC_VERSION and judge are skipped; failed judgments are
 * retried. Results are stored in
 * data/eval.sqlite; data/auth.sqlite is opened read-only.
 */

import { readFileSync } from "node:fs";
import { MATCHER_VERSION, matchBatches, parseFinalReportsJsonl } from "./finals";
import { RULES_VERSION, runRules } from "./rules";
import { RUBRIC_HASH, RUBRIC_VERSION, type Judgment } from "./judge-prompt";
import { JUDGES, JudgeParseError, judgeInput, runJudge } from "./judges";
import {
  judgedIds,
  loadFinalMatches,
  loadFinalReports,
  loadGenerations,
  loadJudgments,
  loadRuleResults,
  openEvalDb,
  openSourceDb,
  replaceFinalMatches,
  ruledIds,
  saveFinalReports,
  saveJudgment,
  saveRuleResult,
  type LoadFilter,
} from "./store";
import {
  judgeAgreement,
  renderAgreement,
  renderFinalSummaries,
  renderJudgeSummaries,
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
    default:
      console.log(
        "usage: npm run eval -- <rules|judge|report|show|deid|import-finals> [options] (see lib/eval/cli.ts)"
      );
      process.exit(command ? 1 : 0);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
