import { describe, it, expect } from 'vitest';
import {
  buildReportSystemPrompt,
  buildReportUserPrompt,
} from '@/lib/prompts/structured-report-prompt';
import {
  buildRccReportSystemPrompt,
} from '@/lib/prompts/disease-templates/rcc';
import {
  buildMyomaReportSystemPrompt,
  buildMyomaReportUserPrompt,
} from '@/lib/prompts/disease-templates/myoma';

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

  describe('UterineMyoma dispatch', () => {
    it('delegates to the myoma template and returns its exact output', () => {
      expect(
        buildReportSystemPrompt({ diseaseCategory: 'UterineMyoma', lang: 'ko' })
      ).toBe(buildMyomaReportSystemPrompt({ lang: 'ko', modality: 'Auto' }));
    });

    it('forwards the findings through the myoma user prompt', () => {
      const findings = 'Uterus:\n- Total myoma count: 5';
      expect(
        buildReportUserPrompt({
          diseaseCategory: 'UterineMyoma',
          lang: 'ko',
          findings,
        })
      ).toBe(buildMyomaReportUserPrompt({ lang: 'ko', findings }));
    });

    it.each(['MRI', 'US'] as const)(
      'passes %s through as an authored modality',
      (modality) => {
        expect(
          buildReportSystemPrompt({
            diseaseCategory: 'UterineMyoma',
            lang: 'ko',
            modality,
          })
        ).toContain(`Modality hint: ${modality}`);
      }
    );

    // The myoma template has no authored CT guidance, so a CT hint must fall
    // back to Auto rather than making the model describe a CT protocol.
    it.each(['CT', 'PET', '', undefined])(
      'collapses the unsupported modality hint %s to Auto',
      (modality) => {
        expect(
          buildReportSystemPrompt({
            diseaseCategory: 'UterineMyoma',
            lang: 'ko',
            modality,
          })
        ).toContain('Modality hint: Auto');
      }
    );

    it('routes each disease to a distinct prompt', () => {
      const prompts = (
        ['RCC', 'ProstateCancer', 'UterineMyoma'] as const
      ).map((diseaseCategory) =>
        buildReportSystemPrompt({ diseaseCategory, lang: 'ko' })
      );
      expect(new Set(prompts).size).toBe(3);
    });

    // Leiomyoma is benign; leaking a TNM section into its prompt would be a
    // dispatch bug that the section-header assertions alone would not catch.
    it('does not leak cancer staging vocabulary into the myoma prompt', () => {
      const prompt = buildReportSystemPrompt({
        diseaseCategory: 'UterineMyoma',
        lang: 'ko',
      });
      expect(prompt).toContain('CLASSIFICATION:');
      expect(prompt).not.toContain('STAGING:');
      expect(prompt).not.toContain('AJCC');
      expect(prompt).not.toContain('PI-RADS');
    });
  });
});
