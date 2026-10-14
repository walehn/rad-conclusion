import { describe, it, expect } from 'vitest';
import { parseJudgment, type Judgment } from '@/lib/eval/judge-prompt';
import { cohenKappa, judgeAgreement } from '@/lib/eval/report';

const judgment = (over: Partial<Judgment> = {}): Judgment => ({
  key_findings: [{ finding: 'hepatic cyst', importance: 'low', covered: 'yes' }],
  errors: [],
  priority_order: 5,
  conciseness: 5,
  acceptability: 'accept',
  comment: '',
  ...over,
});

describe('lib/eval/judge-prompt parseJudgment', () => {
  it('accepts JSON wrapped in fences and stray text', () => {
    const raw = 'Here:\n```json\n' + JSON.stringify(judgment()) + '\n```';
    expect(parseJudgment(raw).acceptability).toBe('accept');
  });

  it('coerces numeric strings for scores', () => {
    const raw = JSON.stringify({ ...judgment(), priority_order: '4' });
    expect(parseJudgment(raw).priority_order).toBe(4);
  });

  it('rejects unknown error categories', () => {
    const raw = JSON.stringify(
      judgment({
        errors: [
          { category: 'typo' as never, significance: 'minor', excerpt: '', explanation: 'x' },
        ],
      })
    );
    expect(() => parseJudgment(raw)).toThrow();
  });

  it('rejects a reply without JSON', () => {
    expect(() => parseJudgment('I cannot grade this.')).toThrow(/no JSON/);
  });
});

describe('lib/eval/report', () => {
  it('computes Cohen kappa: perfect, chance and weighted cases', () => {
    expect(cohenKappa([0, 1, 0, 1], [0, 1, 0, 1], 2)).toBeCloseTo(1);
    // Textbook example: 2x2 table [[20,5],[10,15]] -> kappa 0.4
    const a = [...Array(25).fill(0), ...Array(25).fill(1)];
    const b = [...Array(20).fill(0), ...Array(5).fill(1), ...Array(10).fill(0), ...Array(15).fill(1)];
    expect(cohenKappa(a, b, 2)).toBeCloseTo(0.4);
    // Off-by-one disagreements cost less than off-by-three under quadratic weights.
    const near = cohenKappa([0, 1, 2, 3], [1, 1, 2, 3], 4, 'quadratic');
    const far = cohenKappa([0, 1, 2, 3], [3, 1, 2, 3], 4, 'quadratic');
    expect(near).toBeGreaterThan(far);
  });

  it('compares judges only on generations both have graded', () => {
    const sig = judgment({
      acceptability: 'major_edit',
      errors: [{ category: 'omission', significance: 'significant', excerpt: '', explanation: 'x' }],
    });
    const a = new Map([[1, judgment()], [2, sig], [3, judgment()]]);
    const b = new Map([[1, judgment()], [2, sig]]);
    const result = judgeAgreement('a', a, 'b', b);
    expect(result.n).toBe(2);
    expect(result.significantAgreement).toBe(1);
    expect(result.significantRateA).toBe(0.5);
  });
});
