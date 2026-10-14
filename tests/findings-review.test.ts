import { describe, it, expect } from 'vitest';
import { parseFindingsReview } from '@/lib/findings-review';
import { renderReviewSheet, tallyVerdicts } from '@/lib/eval/findings-review-run';
import type { FinalReport } from '@/lib/eval/finals';

// Synthetic text only: this repository is public.
const FINDINGS = `Clinical info: s/p right nephrectomy.
A 2.1 cm arterial enhancing nodule in segment 6 of the left lobe.
Right kidney: normal size without hydronephrosis.
No ascites.`;

const issue = (o: Record<string, unknown>) => JSON.stringify({ issues: [o] });

describe('lib/findings-review parseFindingsReview', () => {
  it('keeps an issue whose quotes are in the Findings, ignoring case and spacing', () => {
    const out = issue({
      type: 'history',
      quote: 'S/P RIGHT  nephrectomy',
      other_quote: 'Right kidney: normal size',
      explanation: 'The resected kidney is described as normal.',
    });
    const r = parseFindingsReview(out, FINDINGS);
    expect(r.dropped).toBe(0);
    expect(r.issues).toEqual([
      {
        type: 'history',
        quote: 'S/P RIGHT  nephrectomy',
        otherQuote: 'Right kidney: normal size',
        explanation: 'The resected kidney is described as normal.',
      },
    ]);
  });

  it('drops an issue whose quote is not in the Findings', () => {
    const out = issue({ type: 'location', quote: 'segment 6 of the right lobe', other_quote: '', explanation: 'x' });
    expect(parseFindingsReview(out, FINDINGS)).toEqual({ issues: [], dropped: 1 });
  });

  it('drops an unknown type and a missing second quote', () => {
    const out = JSON.stringify({
      issues: [
        { type: 'style', quote: 'No ascites', explanation: 'x' },
        { type: 'laterality', quote: 'left lobe', other_quote: 'left kidney', explanation: 'x' },
      ],
    });
    expect(parseFindingsReview(out, FINDINGS)).toEqual({ issues: [], dropped: 2 });
  });

  it('reads JSON inside a code fence and treats an empty list as clean', () => {
    const r = parseFindingsReview('```json\n{"issues": []}\n```', FINDINGS);
    expect(r).toEqual({ issues: [], dropped: 0 });
  });

  it('reports output that is not the requested JSON', () => {
    expect(parseFindingsReview('No inconsistencies found.', FINDINGS).parseError).toMatch(/no JSON/);
    expect(parseFindingsReview('{"issues": [', FINDINGS).parseError).toBeDefined();
    expect(parseFindingsReview('{"result": []}', FINDINGS).parseError).toMatch(/no issues array/);
  });
});

describe('lib/eval/findings-review-run review sheet', () => {
  const final = {
    study_key: 'S1',
    accession_num: 'ACC1',
    modality: 'CT',
    description: 'Abdomen CT',
    study_date: '2026-10-01T09:00:00',
    findings: FINDINGS,
    conclusion: '',
  } as FinalReport;

  it('round-trips verdicts marked in the sheet', () => {
    const review = parseFindingsReview(
      JSON.stringify({
        issues: [
          { type: 'location', quote: 'segment 6 of the left lobe', other_quote: '', explanation: 'S6 is in the right lobe.' },
          { type: 'history', quote: 's/p right nephrectomy', other_quote: 'Right kidney: normal size', explanation: 'x' },
        ],
      }),
      FINDINGS
    );
    const sheet = renderReviewSheet('findings-review', 'abc', new Map([['S1', final]]), new Map([['S1', review]]));
    expect(sheet).toContain('**segment 6 of the left lobe**');
    expect(sheet).toContain('ACC1');

    const verdictLines = [...sheet.matchAll(/판정:.*$/gm)].map((m) => m[0]);
    expect(verdictLines).toHaveLength(2);
    const marked = sheet
      .replace(verdictLines[0], verdictLines[0].replace('[ ] 오류', '[x] 오류'))
      .replace(verdictLines[1], verdictLines[1].replace('[ ] 거짓', '[x] 거짓'));
    const tally = tallyVerdicts(marked);
    expect(tally.location).toEqual({ real: 1, false_alarm: 0, unsure: 0, unmarked: 0 });
    expect(tally.history).toEqual({ real: 0, false_alarm: 1, unsure: 0, unmarked: 0 });
  });

  it('counts an unmarked or doubly marked verdict as unmarked', () => {
    const sheet = '### 1-1 laterality\n- 판정: [ ] 오류 맞음  [ ] 거짓 경보  [ ] 애매\n### 2-1 laterality\n- 판정: [x] 오류 맞음  [x] 거짓 경보  [ ] 애매\n';
    expect(tallyVerdicts(sheet).laterality.unmarked).toBe(2);
  });
});
