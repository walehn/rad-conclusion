import { describe, it, expect } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { PROMPT_CANDIDATES } from '@/lib/prompts/candidates';
import { buildSystemPrompt } from '@/lib/prompts/system-prompt';
import { computePromptFingerprint } from '@/lib/prompts/fingerprint';
import { CURRENT_PROMPT_REVISION } from '@/lib/prompts/revisions';
import type { FinalReport } from '@/lib/eval/finals';
import {
  candidateHash,
  comparePaired,
  matchedCases,
  pacsCases,
  scoreCandidate,
  selectCases,
  type ReplayCase,
  type ReplayOutput,
} from '@/lib/eval/replay';
import { loadReplays, openEvalDb, saveReplay, type SourceGeneration } from '@/lib/eval/store';

const FINDINGS = 'Liver S7에 0.9cm 크기의 arterial enhancing lesion 있고, washout보여 HCC 가능성 있음.';

const report = (over: Partial<FinalReport>): FinalReport => ({
  study_key: 'S1', accession_num: '', modality: 'CT', description: '', section: 'GI', study_date: '',
  match_date: '', report_state: '5010', report_dttm: '2026-09-10T15:00:00', findings: FINDINGS,
  conclusion: '1. Probably HCC in S7.', recommend: '', reader_role: 'approver', ...over,
});

const gen = (id: number, batchId: string, createdAt: string): SourceGeneration => ({
  id, batchId, userId: 1, findings: FINDINGS, rawConclusion: 'x', conclusion: 'x', promptVersion: id % 2 ? 'v1' : 'v2',
  promptRevision: 'r1', style: 'numbered', lang: 'en', provider: 'local', model: 'm', createdAt: new Date(createdAt),
});

const out = (output: string): ReplayOutput => ({ output, latencyMs: 1000 });

describe('lib/prompts/candidates', () => {
  const opts = { style: 'numbered' as const, lang: 'en' as const, title: 'Conclusion' };

  it('renders the live prompts unchanged for v1 and v2', () => {
    expect(PROMPT_CANDIDATES.v1.buildSystem(opts)).toBe(buildSystemPrompt({ ...opts, version: 'v1' }));
    expect(PROMPT_CANDIDATES.v2.buildSystem(opts)).toBe(buildSystemPrompt({ ...opts, version: 'v2' }));
  });

  it('keeps drafts out of the live prompt fingerprint', () => {
    expect(computePromptFingerprint()).toBe(CURRENT_PROMPT_REVISION.fingerprint);
  });

  it('hashes each candidate by its rendered text', () => {
    expect(candidateHash(PROMPT_CANDIDATES.r2)).toMatch(/^[0-9a-f]{12}$/);
    expect(candidateHash(PROMPT_CANDIDATES.r2)).not.toBe(candidateHash(PROMPT_CANDIDATES.v2));
    expect(candidateHash(PROMPT_CANDIDATES.v2)).toBe(candidateHash(PROMPT_CANDIDATES.v2));
  });
});

describe('lib/eval/replay cases', () => {
  const matches = new Map([['b1', { batchId: 'b1', studyKey: 'A', score: 1, runnerUp: 0 }]]);

  it('builds one matched case per batch, split at 2026-10-01', () => {
    const cases = matchedCases(
      [gen(1, 'b1', '2026-09-30T10:00:00+09:00'), gen(2, 'b1', '2026-09-30T10:00:00+09:00'), gen(3, 'b2', '2026-10-02T10:00:00+09:00')],
      [report({ study_key: 'A' })],
      matches
    );
    expect(cases.map((c) => [c.id, c.split, c.reference])).toEqual([['b1', 'dev', '1. Probably HCC in S7.']]);
  });

  it('keeps unassisted PACS reports with real findings only', () => {
    const cases = pacsCases(
      [
        report({ study_key: 'A' }),                                         // matched to a batch: v2-seeded
        report({ study_key: 'B', report_dttm: '2026-10-05T09:00:00' }),
        report({ study_key: 'C', findings: 'GB sludge.' }),                 // too short
        report({ study_key: 'D', conclusion: '  ' }),
      ],
      matches
    );
    expect(cases.map((c) => [c.id, c.split])).toEqual([['B', 'test']]);
  });

  it('selects a split and spreads a limited subset over time', () => {
    const cases: ReplayCase[] = Array.from({ length: 10 }, (_, i) => ({
      id: `c${i}`, findings: '', reference: '', date: new Date(2026, 8, i + 1), split: i < 8 ? 'dev' : 'test',
    }));
    expect(selectCases(cases, 'test').map((c) => c.id)).toEqual(['c8', 'c9']);
    expect(selectCases(cases, 'dev', 4).map((c) => c.id)).toEqual(['c0', 'c2', 'c4', 'c6']);
    expect(selectCases(cases, 'all')).toHaveLength(10);
  });
});

describe('lib/eval/replay scoring', () => {
  const cases: ReplayCase[] = [
    { id: 'a', findings: FINDINGS, reference: '1. Probably HCC in S7.', date: new Date(), split: 'dev' },
    { id: 'b', findings: FINDINGS, reference: '1. Probably HCC in S7.', date: new Date(), split: 'dev' },
  ];

  it('scores similarity, verbatim share, rule flags and style markers', () => {
    const s = scoreCandidate('r2', cases, new Map([
      ['a', out('1. Probably HCC in S7.')],
      ['b', out('1. 0.9 cm S7 lesion, unchanged; consistent with HCC — MRI recommended.')],
    ]));
    expect(s.n).toBe(2);
    expect(s.verbatimRate).toBe(0.5);
    expect(s.suspectRate).toBe(0.5);                 // "unchanged" without a stated prior
    expect(s.markers.recommendation).toBe(0.5);
    expect(s.markers['probably / suspicion']).toBe(0.5);
    expect(s.meanLatencyMs).toBe(1000);
  });

  it('compares candidates on shared cases only', () => {
    const better = new Map([['a', out('1. Probably HCC in S7.')], ['b', out('1. Probably HCC in S7.')]]);
    const worse = new Map([['a', out('1. Hepatic cyst.')]]);
    const p = comparePaired('r2', 'v2', cases, better, worse);
    expect(p.n).toBe(1);
    expect(p.meanDelta).toBeGreaterThan(0.5);
    expect([p.wins, p.ties, p.losses]).toEqual([1, 0, 0]);
    expect(p.ci95[0]).toBeLessThanOrEqual(p.meanDelta);
  });
});

describe('lib/eval/store replays', () => {
  it('returns only successful outputs of the same prompt text', () => {
    const db = openEvalDb(mkdtempSync(path.join(tmpdir(), 'replay-')));
    const key = { candidate: 'r2', promptHash: 'h1', model: 'm', caseSet: 'matched' };
    saveReplay(db, key, 'a', { output: '1. X.', latencyMs: 5 });
    saveReplay(db, key, 'b', { error: 'timeout' });
    saveReplay(db, { ...key, promptHash: 'h2' }, 'c', { output: '1. Y.', latencyMs: 5 });
    const got = loadReplays(db, key);
    expect([...got.keys()]).toEqual(['a']);
    expect(got.get('a')).toEqual({ output: '1. X.', latencyMs: 5 });
  });
});
