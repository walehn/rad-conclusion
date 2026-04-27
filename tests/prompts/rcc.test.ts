import { describe, it, expect } from 'vitest';
import {
  RCC_SECTION_ORDER,
  buildRccReportSystemPrompt,
  buildRccReportUserPrompt,
} from '@/lib/prompts/disease-templates/rcc';

describe('lib/prompts/disease-templates/rcc', () => {
  describe('RCC_SECTION_ORDER', () => {
    it('has exactly six sections in the fixed canonical order', () => {
      expect(RCC_SECTION_ORDER).toHaveLength(6);
      expect([...RCC_SECTION_ORDER]).toEqual([
        'CLINICAL INFORMATION',
        'TECHNIQUE',
        'COMPARISON',
        'FINDINGS',
        'STAGING',
        'IMPRESSION',
      ]);
    });
  });

  describe('buildRccReportSystemPrompt', () => {
    it('includes all six section header names in the output', () => {
      const prompt = buildRccReportSystemPrompt({ lang: 'en' });
      for (const header of RCC_SECTION_ORDER) {
        expect(prompt).toContain(header);
      }
    });

    it('contains the HARD-rule keywords enforced by templates-spec §8', () => {
      const prompt = buildRccReportSystemPrompt({ lang: 'en' });
      // Rule 1: no fabrication
      expect(prompt).toMatch(/Do NOT fabricate/);
      // Rule 2: no inferred stability / interval change
      expect(prompt.toLowerCase()).toMatch(/stability|interval change/);
      // Rule 3: unspecified -> explicit marker, not silent omission
      expect(prompt).toMatch(/Not specified|unremarkable/i);
      // Rule 8: no treatment recommendations
      expect(prompt.toLowerCase()).toMatch(/treatment|recommendations/);
    });

    it('embeds AJCC 8th staging codes', () => {
      const prompt = buildRccReportSystemPrompt({ lang: 'en' });
      expect(prompt).toContain('T1a');
      expect(prompt).toContain('T3b');
      expect(prompt).toContain('N0');
      expect(prompt).toContain('M0');
    });

    it('emits a Korean-language directive when lang=ko', () => {
      const prompt = buildRccReportSystemPrompt({ lang: 'ko' });
      // Either the Korean word "한국어" or the English word "Korean" must appear
      expect(prompt).toMatch(/한국어|Korean/);
    });

    it('switches the modality hint block for concrete modalities', () => {
      const ctPrompt = buildRccReportSystemPrompt({ lang: 'en', modality: 'CT' });
      const autoPrompt = buildRccReportSystemPrompt({ lang: 'en', modality: 'Auto' });
      expect(ctPrompt).toContain('Modality hint: CT');
      expect(autoPrompt).toContain('Modality hint: Auto');
    });
  });

  describe('buildRccReportUserPrompt', () => {
    it('forwards the findings text verbatim into the prompt body', () => {
      const findings = 'Left 3cm renal mass with heterogeneous enhancement.';
      const prompt = buildRccReportUserPrompt({ lang: 'en', findings });
      expect(prompt).toContain(findings);
      expect(prompt).toContain('DiseaseCategory: RCC');
    });
  });
});
