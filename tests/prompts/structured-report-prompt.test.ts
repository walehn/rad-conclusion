import { describe, it, expect } from 'vitest';
import {
  buildReportSystemPrompt,
  buildReportUserPrompt,
} from '@/lib/prompts/structured-report-prompt';
import {
  buildRccReportSystemPrompt,
} from '@/lib/prompts/disease-templates/rcc';

describe('lib/prompts/structured-report-prompt', () => {
  describe('buildReportSystemPrompt', () => {
    it('delegates to the RCC template and returns its exact output for RCC/en/Auto', () => {
      const out = buildReportSystemPrompt({
        diseaseCategory: 'RCC',
        lang: 'en',
      });
      const expected = buildRccReportSystemPrompt({ lang: 'en', modality: 'Auto' });
      expect(typeof out).toBe('string');
      expect(out.length).toBeGreaterThan(0);
      expect(out).toBe(expected);
    });

    it('honors the optional modality hint when provided', () => {
      const ctPrompt = buildReportSystemPrompt({
        diseaseCategory: 'RCC',
        lang: 'ko',
        modality: 'CT',
      });
      expect(ctPrompt).toContain('Modality hint: CT');
      // Unknown modality values should collapse to Auto per toRccModality()
      const oddPrompt = buildReportSystemPrompt({
        diseaseCategory: 'RCC',
        lang: 'en',
        modality: 'PET',
      });
      expect(oddPrompt).toContain('Modality hint: Auto');
    });
  });

  describe('buildReportUserPrompt', () => {
    it('includes the findings and RCC disease-category label', () => {
      const prompt = buildReportUserPrompt({
        diseaseCategory: 'RCC',
        lang: 'en',
        findings: 'test findings body',
      });
      expect(prompt).toContain('test findings body');
      expect(prompt).toContain('DiseaseCategory: RCC');
    });
  });
});
