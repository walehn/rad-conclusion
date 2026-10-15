import { describe, it, expect } from 'vitest';
import {
  containment,
  editSimilarity,
  matchBatches,
  parseFinalReportsJsonl,
  repairMojibake,
  type FinalReport,
} from '@/lib/eval/finals';
import { summarizeAdoption, summarizeFinals } from '@/lib/eval/report';
import type { SourceGeneration } from '@/lib/eval/store';

const FINDINGS_A =
  'Liver S7에 0.9cm 크기의 arterial enhancing lesion 있고, washout보여 HCC 가능성 있음.';
const FINDINGS_B = 'Lt kidney lower pole에 0.9 cm hemorrhagic cyst 있고 mid pole에는 1.1 cm simple cyst가 보임.';

const report = (over: Partial<FinalReport>): FinalReport => ({
  study_key: 'S1',
  accession_num: '',
  modality: 'CT',
  description: '',
  section: '',
  study_date: '',
  match_date: '',
  report_state: 'F',
  report_dttm: '2026-09-10T15:00:00',
  findings: '',
  conclusion: '',
  recommend: '',
  reader_role: 'approver',
  ...over,
});

describe('lib/eval/finals matching', () => {
  it('scores app findings contained in longer PACS findings near 1', () => {
    const pacs = `Technique: dynamic CT.\n${FINDINGS_A}\nOther organs unremarkable.`;
    expect(containment(FINDINGS_A, pacs)).toBeGreaterThan(0.95);
    expect(containment(FINDINGS_A, FINDINGS_B)).toBeLessThan(0.3);
  });

  it('tolerates re-wrapping and spacing changes', () => {
    expect(containment(FINDINGS_A, FINDINGS_A.replace(/ /g, '  ').replace(', ', ',\n'))).toBe(1);
  });

  it('matches each batch to its own report inside the time window', () => {
    const finals = [
      report({ study_key: 'A', findings: FINDINGS_A, report_dttm: '2026-09-10T15:00:00' }),
      report({ study_key: 'B', findings: FINDINGS_B, report_dttm: '2026-09-10T16:00:00' }),
    ];
    const matches = matchBatches(
      [
        { batchId: 'b1', findings: FINDINGS_A, createdAt: new Date('2026-09-10T14:30:00') },
        { batchId: 'b2', findings: FINDINGS_B, createdAt: new Date('2026-09-10T15:50:00') },
        // signed more than 14 days later: out of window
        { batchId: 'b3', findings: FINDINGS_A, createdAt: new Date('2026-08-01T09:00:00') },
      ],
      finals
    );
    expect(matches.map((m) => [m.batchId, m.studyKey])).toEqual([
      ['b1', 'A'],
      ['b2', 'B'],
    ]);
  });

  it('refuses ambiguous and too-short findings', () => {
    const finals = [
      report({ study_key: 'A', findings: FINDINGS_A }),
      report({ study_key: 'A2', findings: FINDINGS_A }),
      report({ study_key: 'C', findings: 'GB sludge 있음.' }),
    ];
    const at = new Date('2026-09-10T14:00:00');
    expect(matchBatches([{ batchId: 'b', findings: FINDINGS_A, createdAt: at }], finals)).toEqual([]);
    expect(matchBatches([{ batchId: 'c', findings: 'GB sludge 있음.', createdAt: at }], finals)).toEqual([]);
  });

  it('parses JSONL and counts invalid lines', () => {
    const line = JSON.stringify(report({ findings: 'x', conclusion: 'y' }));
    const { reports, invalid } = parseFinalReportsJsonl(`${line}\n{"broken": true}\nnot json\n\n`);
    expect(reports).toHaveLength(1);
    expect(invalid).toBe(2);
  });
});

describe('lib/eval/finals editSimilarity', () => {
  it('ignores list markers, case and punctuation', () => {
    expect(editSimilarity('1. Hepatic cyst.\n2. GB sludge.', '1) hepatic cyst\n2) GB sludge')).toBe(1);
  });

  it('counts a changed side as an edit and a rewrite as near zero', () => {
    const one = editSimilarity('1. Left renal cyst, 1.1 cm.', '1. Right renal cyst, 1.1 cm.');
    expect(one).toBeCloseTo(1 - 1 / 5);
    expect(editSimilarity('1. Hepatic cyst.', '1. No acute abnormality in the abdomen.')).toBeLessThan(0.3);
  });
});

describe('lib/eval/report against signed reports', () => {
  const gen = (id: number, batchId: string, promptVersion: string, conclusion: string): SourceGeneration => ({
    id,
    batchId,
    userId: 1,
    findings: FINDINGS_A,
    rawConclusion: conclusion,
    conclusion,
    promptVersion,
    promptRevision: 'r1',
    style: 'numbered',
    lang: 'en',
    provider: 'local',
    model: 'm',
    createdAt: new Date('2026-09-10T14:00:00'),
  });
  const gens = [
    gen(1, 'b1', 'v1', '1. 0.9 cm arterial-enhancing lesion in segment 7 with washout, compatible with HCC.'),
    gen(2, 'b1', 'v2', '1. 0.9 cm S7 lesion with washout; possible HCC.'),
    gen(3, 'b2', 'v1', '1. Hepatic cyst.'),
    gen(4, 'b2', 'v2', '1. Hepatic cyst.'),
    gen(5, 'b3', 'v1', '1. Something.'),
  ];
  const finals = [
    report({ study_key: 'A', conclusion: '1. 0.9 cm S7 lesion with washout; possible HCC.' }),
    report({ study_key: 'B', conclusion: '1. Large ascites with peritoneal seeding.' }),
  ];
  const matches = new Map([
    ['b1', { batchId: 'b1', studyKey: 'A', score: 1, runnerUp: 0 }],
    ['b2', { batchId: 'b2', studyKey: 'B', score: 1, runnerUp: 0 }],
  ]);

  it('reports similarity and verbatim share per version over matched generations only', () => {
    const [v1, v2] = summarizeFinals(gens, finals, matches, 'version');
    expect(v1.group).toBe('v1');
    expect(v1.n).toBe(2);
    expect(v1.total).toBe(3);
    expect(v2.verbatimRate).toBe(0.5);
  });

  it('attributes each A/B batch to the version the radiologist used', () => {
    const [all] = summarizeAdoption(gens, finals, matches, 'version');
    expect(all.group).toBe('all');
    expect(all.batches).toBe(2);
    expect(all.v2).toBe(0.5);
    expect(all.neither).toBe(0.5);
  });
});

describe('repairMojibake', () => {
  it('restores Korean whose UTF-8 bytes were read as PT154', () => {
    expect(repairMojibake('Pancreas tailм—җ м—¬лҹ¬ к°ңмқҳ cyst')).toBe('Pancreas tail에 여러 개의 cyst');
  });

  it('keeps punctuation PT154 shares with normal text', () => {
    expect(repairMojibake('Liver — 2 cm, 30° “м—җ”')).toBe('Liver — 2 cm, 30° “에”');
  });

  it('leaves text without Cyrillic untouched', () => {
    const text = 'Rt kidney에 1.2 cm cyst — little change “stable”';
    expect(repairMojibake(text)).toBe(text);
  });

  it('is applied to every text field on import', () => {
    const line = JSON.stringify({
      study_key: 'K1',
      report_dttm: '2026-10-01T09:00:00',
      description: 'CT м—җ',
      findings: 'tailм—җ',
      conclusion: 'к°ңмқҳ',
      recommend: 'м—¬лҹ¬',
    });
    const [r] = parseFinalReportsJsonl(line).reports;
    expect([r.description, r.findings, r.conclusion, r.recommend]).toEqual(['CT 에', 'tail에', '개의', '여러']);
  });
});

describe('repairMojibake, Mac Cyrillic', () => {
  it('restores Korean read as Mac Cyrillic', () => {
    // "에" is EC 97 90, which Mac Cyrillic reads as "мЧР"
    expect(repairMojibake('Liver S6мЧР 2 cm')).toBe('Liver S6에 2 cm');
  });
});
