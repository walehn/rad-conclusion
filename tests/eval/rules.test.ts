import { describe, it, expect } from 'vitest';
import { runRules, type RuleFlagKind } from '@/lib/eval/rules';

const kinds = (findings: string, conclusion: string, lang = 'en') =>
  runRules({ findings, conclusion, style: 'numbered', lang }).flags.map((f) => f.kind);

const has = (k: RuleFlagKind, findings: string, conclusion: string) =>
  kinds(findings, conclusion).includes(k);

describe('lib/eval/rules', () => {
  describe('input_without_findings', () => {
    // Real case: a pasted registration number produced a full brain CT report.
    it('flags a conclusion written from a bare number', () => {
      expect(has('input_without_findings', '42238042', '1. No acute intracranial hemorrhage.')).toBe(true);
    });

    it('accepts short but real findings', () => {
      expect(has('input_without_findings', 'Left hydrohematosalpinx 있음', '1. Left hydrohematosalpinx.')).toBe(false);
    });
  });

  describe('laterality_introduced', () => {
    it('flags a side the findings never mention', () => {
      expect(has('laterality_introduced', 'Pleural effusion 있음.', '1. Bilateral pleural effusions.')).toBe(true);
    });

    it('accepts Lt/Rt abbreviations for left/right', () => {
      expect(has('laterality_introduced', 'Lt kidney에 cyst 있음.', '1. Left renal cyst.')).toBe(false);
    });

    it('accepts vessel abbreviations such as LPV', () => {
      expect(has('laterality_introduced', 'LPV umbilical segment를 따라 nodule', '1. Nodules along the left portal vein.')).toBe(false);
    });

    it('does not read all-caps LT (liver transplantation) as a side', () => {
      expect(has('laterality_introduced', 's/p LT, anastomosis 협착 없음', '1. Left hepatic duct stricture.')).toBe(true);
    });

    it('accepts "both <structure>" in the findings as bilateral', () => {
      expect(has('laterality_introduced', 'BBoth kidneys에 cyst 있음.', '1. Bilateral renal cysts.')).toBe(false);
    });

    it('does not read "both lesions" in the conclusion as bilateral', () => {
      expect(has('laterality_introduced', 'Uterus에 myoma 두 개.', '1. Two myomas; both show restriction.')).toBe(false);
    });
  });

  describe('number_not_in_findings', () => {
    it('flags a measurement absent from the findings', () => {
      expect(has('number_not_in_findings', 'Liver에 mass 있음.', '1. 2.3 cm hepatic mass.')).toBe(true);
    });

    it('accepts cm <-> mm conversion', () => {
      expect(has('number_not_in_findings', 'LK mass 19 mm', '1. 1.9 cm left renal mass.')).toBe(false);
    });

    it('accepts "S7" written as "segment 7"', () => {
      expect(has('number_not_in_findings', 'Liver S7에 small cyst', '1. Small cyst in hepatic segment 7.')).toBe(false);
    });

    it('ignores list markers', () => {
      expect(has('number_not_in_findings', 'GB sludge 있음.', '1. GB sludge.\n2. Nothing else.')).toBe(false);
    });
  });

  describe('date_not_in_findings', () => {
    it('matches a date rewritten with a month name', () => {
      expect(
        has('date_not_in_findings', '2025-09-16 CT와 비교', '1. No progression compared with September 16, 2025.')
      ).toBe(false);
    });

    it('flags a date the findings do not contain', () => {
      expect(has('date_not_in_findings', '2025-09-16 CT와 비교', '1. Stable since 2024-01-02.')).toBe(true);
    });
  });

  describe('interval_change_introduced', () => {
    // Real case: "unchanged" added to an initial CT.
    it('flags change wording with no comparison in the findings', () => {
      expect(
        has('interval_change_introduced', 'Initial abdomen CT.\nLiver에 tiny cyst들 있음.', '1. Tiny hepatic cysts, unchanged.')
      ).toBe(true);
    });

    it('accepts change wording backed by Korean comparison terms', () => {
      expect(
        has('interval_change_introduced', 'Bland thrombus가 생겼음.', '1. New bland thrombus.')
      ).toBe(false);
    });

    it('does not treat "prior" treatment as interval change', () => {
      expect(has('interval_change_introduced', 'LDLT 받은 환자. B8에 stone.', '1. B8 stones, related to prior LDLT.')).toBe(false);
    });
  });

  describe('format and language', () => {
    it('flags Korean in an English conclusion', () => {
      expect(kinds('aneurysm 있음', '1. 복부 대동맥류.', 'en')).toContain('lang_hangul_in_english');
    });

    it('flags broken numbering and bullet markers', () => {
      expect(has('format_not_numbered', 'x y', '1. A.\n3. B.')).toBe(true);
      expect(has('format_not_numbered', 'x y', '- A.\n- B.')).toBe(true);
      expect(has('format_not_numbered', 'x y', '1. A.\n2. B.')).toBe(false);
    });

    it('flags a title line and a filler opener', () => {
      expect(has('format_title_line', 'x y', 'Impression:\n1. A.')).toBe(true);
      expect(has('format_filler_opener', 'x y', '1. Overall, normal study.')).toBe(true);
    });
  });

  it('reports size metrics', () => {
    const { metrics } = runRules({
      findings: 'Liver S7에 cyst 있음.',
      conclusion: '1. Hepatic cyst.\n2. Nothing else.',
      style: 'numbered',
      lang: 'en',
    });
    expect(metrics.items).toBe(2);
    expect(metrics.compression).toBeCloseTo(metrics.conclusionChars / metrics.findingsChars, 2);
  });
});
