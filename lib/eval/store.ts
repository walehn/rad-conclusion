// lib/eval/store.ts
// Storage for evaluation results.
//
// Results live in data/eval.sqlite, apart from the app database. The app's
// data/auth.sqlite is only ever opened read-only here: evaluation must not
// add tables, migrations or write locks to the database serving requests.

import path from "node:path";
import Database from "better-sqlite3";
import { postProcess } from "@/lib/post-process";
import type { FinalMatch, FinalReport } from "./finals";
import type { Judgment } from "./judge-prompt";
import type { ReplayOutput } from "./replay";
import type { RuleResult } from "./rules";

export interface SourceGeneration {
  id: number;
  batchId: string;
  userId: number | null;
  findings: string;
  /** Raw model output as stored by the app. */
  rawConclusion: string;
  /** What the radiologist sees and copies — what gets evaluated. */
  conclusion: string;
  promptVersion: string;
  promptRevision: string | null;
  style: string;
  lang: string;
  provider: string;
  model: string;
  createdAt: Date;
}

export interface LoadFilter {
  /** Inclusive lower bound on created_at. */
  since?: Date;
  ids?: number[];
}

export function dataDir(): string {
  return path.resolve(process.cwd(), "data");
}

export function openSourceDb(dir = dataDir()): Database.Database {
  return new Database(path.join(dir, "auth.sqlite"), {
    readonly: true,
    fileMustExist: true,
  });
}

export function loadGenerations(
  src: Database.Database,
  filter: LoadFilter = {}
): SourceGeneration[] {
  const where: string[] = [];
  const params: (number | string)[] = [];
  if (filter.since) {
    where.push("created_at >= ?");
    params.push(Math.floor(filter.since.getTime() / 1000));
  }
  if (filter.ids?.length) {
    where.push(`id IN (${filter.ids.map(() => "?").join(",")})`);
    params.push(...filter.ids);
  }
  const rows = src
    .prepare(
      `SELECT id, batch_id, user_id, findings, conclusion, prompt_version,
              prompt_revision, style, lang, provider, model, created_at
         FROM generations
        ${where.length ? "WHERE " + where.join(" AND ") : ""}
        ORDER BY id`
    )
    .all(...params) as Record<string, unknown>[];
  return rows.map((r) => ({
    id: r.id as number,
    batchId: r.batch_id as string,
    userId: (r.user_id as number | null) ?? null,
    findings: r.findings as string,
    rawConclusion: r.conclusion as string,
    conclusion: postProcess(r.conclusion as string, "Conclusion"),
    promptVersion: r.prompt_version as string,
    promptRevision: (r.prompt_revision as string | null) ?? null,
    style: r.style as string,
    lang: r.lang as string,
    provider: r.provider as string,
    model: r.model as string,
    createdAt: new Date((r.created_at as number) * 1000),
  }));
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS rule_results (
  generation_id INTEGER NOT NULL,
  rules_version TEXT NOT NULL,
  flags TEXT NOT NULL,
  metrics TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (generation_id, rules_version)
);
CREATE TABLE IF NOT EXISTS judgments (
  generation_id INTEGER NOT NULL,
  judge_id TEXT NOT NULL,
  rubric_version TEXT NOT NULL,
  rubric_hash TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('ok', 'error')),
  result TEXT,
  raw TEXT,
  error TEXT,
  latency_ms INTEGER,
  input_tokens INTEGER,
  output_tokens INTEGER,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (generation_id, judge_id, rubric_version)
);
-- Signed PACS reports imported from "pft report-export". Contains report text:
-- data/ is local-only, like the app database.
CREATE TABLE IF NOT EXISTS final_reports (
  study_key TEXT PRIMARY KEY,
  accession_num TEXT,
  modality TEXT,
  description TEXT,
  section TEXT,
  study_date TEXT,
  match_date TEXT,
  report_state TEXT,
  report_dttm TEXT NOT NULL,
  findings TEXT NOT NULL,
  conclusion TEXT NOT NULL,
  recommend TEXT,
  reader_role TEXT,
  imported_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS final_matches (
  batch_id TEXT NOT NULL,
  matcher_version TEXT NOT NULL,
  study_key TEXT NOT NULL,
  score REAL NOT NULL,
  runner_up REAL NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (batch_id, matcher_version)
);
-- Offline replays of past inputs with candidate prompts (lib/eval/replay.ts).
CREATE TABLE IF NOT EXISTS replays (
  candidate TEXT NOT NULL,
  prompt_hash TEXT NOT NULL,
  model TEXT NOT NULL,
  case_set TEXT NOT NULL,
  case_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('ok', 'error')),
  output TEXT,
  error TEXT,
  latency_ms INTEGER,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (candidate, prompt_hash, model, case_set, case_id)
);
`;

export function openEvalDb(dir = dataDir()): Database.Database {
  const db = new Database(path.join(dir, "eval.sqlite"));
  db.pragma("journal_mode = WAL");
  db.exec(SCHEMA);
  // Added after the first release of the schema.
  const finalCols = db.prepare("PRAGMA table_info(final_reports)").all() as { name: string }[];
  if (!finalCols.some((c) => c.name === "reader_role")) {
    db.exec("ALTER TABLE final_reports ADD COLUMN reader_role TEXT");
  }
  return db;
}

const now = () => Math.floor(Date.now() / 1000);

export function saveRuleResult(
  db: Database.Database,
  generationId: number,
  rulesVersion: string,
  result: RuleResult
): void {
  db.prepare(
    `INSERT OR REPLACE INTO rule_results
       (generation_id, rules_version, flags, metrics, created_at)
     VALUES (?, ?, ?, ?, ?)`
  ).run(generationId, rulesVersion, JSON.stringify(result.flags), JSON.stringify(result.metrics), now());
}

export interface JudgmentRecord {
  generationId: number;
  judgeId: string;
  rubricVersion: string;
  rubricHash: string;
  status: "ok" | "error";
  judgment?: Judgment;
  raw?: string;
  error?: string;
  latencyMs?: number;
  inputTokens?: number | null;
  outputTokens?: number | null;
}

export function saveJudgment(db: Database.Database, rec: JudgmentRecord): void {
  db.prepare(
    `INSERT OR REPLACE INTO judgments
       (generation_id, judge_id, rubric_version, rubric_hash, status, result,
        raw, error, latency_ms, input_tokens, output_tokens, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    rec.generationId,
    rec.judgeId,
    rec.rubricVersion,
    rec.rubricHash,
    rec.status,
    rec.judgment ? JSON.stringify(rec.judgment) : null,
    rec.raw ?? null,
    rec.error ?? null,
    rec.latencyMs ?? null,
    rec.inputTokens ?? null,
    rec.outputTokens ?? null,
    now()
  );
}

/**
 * Generation ids with a successful judgment. Failed attempts (quota, timeout,
 * unparseable reply) are not "done": the next run retries them and a success
 * overwrites the error row.
 */
export function judgedIds(
  db: Database.Database,
  judgeId: string,
  rubricVersion: string
): Set<number> {
  const rows = db
    .prepare(
      `SELECT generation_id FROM judgments
        WHERE judge_id = ? AND rubric_version = ? AND status = 'ok'`
    )
    .all(judgeId, rubricVersion) as { generation_id: number }[];
  return new Set(rows.map((r) => r.generation_id));
}

export function ruledIds(db: Database.Database, rulesVersion: string): Set<number> {
  const rows = db
    .prepare("SELECT generation_id FROM rule_results WHERE rules_version = ?")
    .all(rulesVersion) as { generation_id: number }[];
  return new Set(rows.map((r) => r.generation_id));
}

export function loadRuleResults(
  db: Database.Database,
  rulesVersion: string
): Map<number, RuleResult> {
  const rows = db
    .prepare("SELECT generation_id, flags, metrics FROM rule_results WHERE rules_version = ?")
    .all(rulesVersion) as { generation_id: number; flags: string; metrics: string }[];
  return new Map(
    rows.map((r) => [r.generation_id, { flags: JSON.parse(r.flags), metrics: JSON.parse(r.metrics) }])
  );
}

export interface StoredJudgments {
  /** judge id -> generation id -> judgment, successful runs only. */
  ok: Map<string, Map<number, Judgment>>;
  /** judge id -> number of failed runs. */
  failed: Map<string, number>;
}

export function loadJudgments(db: Database.Database, rubricVersion: string): StoredJudgments {
  const rows = db
    .prepare(
      "SELECT generation_id, judge_id, status, result FROM judgments WHERE rubric_version = ?"
    )
    .all(rubricVersion) as {
    generation_id: number;
    judge_id: string;
    status: string;
    result: string | null;
  }[];
  const ok = new Map<string, Map<number, Judgment>>();
  const failed = new Map<string, number>();
  for (const r of rows) {
    if (r.status === "ok" && r.result) {
      if (!ok.has(r.judge_id)) ok.set(r.judge_id, new Map());
      ok.get(r.judge_id)!.set(r.generation_id, JSON.parse(r.result));
    } else {
      failed.set(r.judge_id, (failed.get(r.judge_id) ?? 0) + 1);
    }
  }
  return { ok, failed };
}

export function saveFinalReports(db: Database.Database, reports: FinalReport[]): void {
  const stmt = db.prepare(
    `INSERT OR REPLACE INTO final_reports
       (study_key, accession_num, modality, description, section, study_date,
        match_date, report_state, report_dttm, findings, conclusion, recommend, reader_role, imported_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const t = now();
  db.transaction(() => {
    for (const r of reports) {
      stmt.run(
        r.study_key, r.accession_num, r.modality, r.description, r.section, r.study_date,
        r.match_date, r.report_state, r.report_dttm, r.findings, r.conclusion, r.recommend,
        r.reader_role, t
      );
    }
  })();
}

export function loadFinalReports(db: Database.Database): FinalReport[] {
  return db
    .prepare(
      `SELECT study_key, accession_num, modality, description, section, study_date,
              match_date, report_state, report_dttm, findings, conclusion, recommend,
              COALESCE(reader_role, '') AS reader_role
         FROM final_reports`
    )
    .all() as FinalReport[];
}

/** Replaces every match of this matcher version: matching is recomputed in full. */
export function replaceFinalMatches(
  db: Database.Database,
  matcherVersion: string,
  matches: FinalMatch[]
): void {
  const stmt = db.prepare(
    `INSERT INTO final_matches (batch_id, matcher_version, study_key, score, runner_up, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  );
  const t = now();
  db.transaction(() => {
    db.prepare("DELETE FROM final_matches WHERE matcher_version = ?").run(matcherVersion);
    for (const m of matches) stmt.run(m.batchId, matcherVersion, m.studyKey, m.score, m.runnerUp, t);
  })();
}

/** batch id -> matched study key. */
export function loadFinalMatches(db: Database.Database, matcherVersion: string): Map<string, FinalMatch> {
  const rows = db
    .prepare(
      "SELECT batch_id, study_key, score, runner_up FROM final_matches WHERE matcher_version = ?"
    )
    .all(matcherVersion) as { batch_id: string; study_key: string; score: number; runner_up: number }[];
  return new Map(
    rows.map((r) => [
      r.batch_id,
      { batchId: r.batch_id, studyKey: r.study_key, score: r.score, runnerUp: r.runner_up },
    ])
  );
}

export interface ReplayKey {
  candidate: string;
  promptHash: string;
  model: string;
  caseSet: string;
}

export function saveReplay(
  db: Database.Database,
  key: ReplayKey,
  caseId: string,
  result: { output: string; latencyMs: number } | { error: string }
): void {
  const ok = "output" in result;
  db.prepare(
    `INSERT OR REPLACE INTO replays
       (candidate, prompt_hash, model, case_set, case_id, status, output, error, latency_ms, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    key.candidate, key.promptHash, key.model, key.caseSet, caseId,
    ok ? "ok" : "error", ok ? result.output : null, ok ? null : result.error,
    ok ? result.latencyMs : null, now()
  );
}

/** Successful outputs for this exact prompt text, by case id. */
export function loadReplays(db: Database.Database, key: ReplayKey): Map<string, ReplayOutput> {
  const rows = db
    .prepare(
      `SELECT case_id, output, latency_ms FROM replays
        WHERE candidate = ? AND prompt_hash = ? AND model = ? AND case_set = ? AND status = 'ok'`
    )
    .all(key.candidate, key.promptHash, key.model, key.caseSet) as { case_id: string; output: string; latency_ms: number }[];
  return new Map(rows.map((r) => [r.case_id, { output: r.output, latencyMs: r.latency_ms }]));
}
