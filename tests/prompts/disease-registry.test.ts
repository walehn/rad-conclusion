import { describe, it, expect } from 'vitest';
import {
  DISEASE_REGISTRY,
  isDiseaseCategory,
  getDiseaseCategoryMetadata,
  diseaseCategoryToSlug,
  parseDiseaseCategorySlug,
  type DiseaseCategory,
} from '@/lib/prompts/disease-registry';

describe('lib/prompts/disease-registry', () => {
  describe('DISEASE_REGISTRY', () => {
    it('contains an RCC entry', () => {
      expect(DISEASE_REGISTRY).toHaveProperty('RCC');
      expect(DISEASE_REGISTRY.RCC).toBeDefined();
      expect(DISEASE_REGISTRY.RCC.id).toBe('RCC');
    });

    it('exposes the correct English and Korean display names for RCC', () => {
      expect(DISEASE_REGISTRY.RCC.displayName).toBe('Renal Cell Carcinoma');
      expect(DISEASE_REGISTRY.RCC.displayNameKo).toBe('신세포암');
    });

    it('lists CT, MRI, and US as supported modalities for RCC', () => {
      const modalities = DISEASE_REGISTRY.RCC.supportedModalities;
      expect(modalities).toContain('CT');
      expect(modalities).toContain('MRI');
      expect(modalities).toContain('US');
      expect(modalities).toHaveLength(3);
    });

    it('references the core RCC standards', () => {
      const refs = DISEASE_REGISTRY.RCC.standardReferences;
      expect(refs).toContain('SAR 2018');
      expect(refs).toContain('AJCC 8th');
      expect(refs).toContain('Bosniak 2019');
      expect(refs).toContain('Neves-Mayo');
    });
  });

  describe('isDiseaseCategory', () => {
    it('returns true for the RCC literal', () => {
      expect(isDiseaseCategory('RCC')).toBe(true);
    });

    it('returns false for a non-registered category like HCC', () => {
      expect(isDiseaseCategory('HCC')).toBe(false);
    });

    it('returns false for null, undefined, and non-string values', () => {
      expect(isDiseaseCategory(null)).toBe(false);
      expect(isDiseaseCategory(undefined)).toBe(false);
      expect(isDiseaseCategory(42)).toBe(false);
      expect(isDiseaseCategory({})).toBe(false);
    });
  });

  describe('getDiseaseCategoryMetadata', () => {
    it('returns the full metadata object for RCC', () => {
      const meta = getDiseaseCategoryMetadata('RCC');
      expect(meta).toMatchObject({
        id: 'RCC',
        displayName: 'Renal Cell Carcinoma',
        displayNameKo: '신세포암',
      });
      expect(meta.description.toLowerCase()).toContain('renal cell carcinoma');
      expect(meta.supportedModalities.length).toBeGreaterThan(0);
      expect(meta.standardReferences.length).toBeGreaterThan(0);
    });
  });

  describe('diseaseCategoryToSlug / parseDiseaseCategorySlug', () => {
    it('converts RCC to "rcc"', () => {
      expect(diseaseCategoryToSlug('RCC')).toBe('rcc');
    });

    it('round-trips every registered DiseaseCategory', () => {
      const keys = Object.keys(DISEASE_REGISTRY) as DiseaseCategory[];
      for (const c of keys) {
        expect(parseDiseaseCategorySlug(diseaseCategoryToSlug(c))).toBe(c);
      }
    });

    it('returns null for unknown slugs', () => {
      expect(parseDiseaseCategorySlug('foo')).toBe(null);
      expect(parseDiseaseCategorySlug('prostate-cancer')).toBe(null); // not registered yet
      expect(parseDiseaseCategorySlug('')).toBe(null);
    });

    it('is case-strict — rejects "Rcc" and "RCC"', () => {
      expect(parseDiseaseCategorySlug('Rcc')).toBe(null);
      expect(parseDiseaseCategorySlug('RCC')).toBe(null);
    });

    it('produces unique slugs across the entire registry', () => {
      const keys = Object.keys(DISEASE_REGISTRY) as DiseaseCategory[];
      const slugs = keys.map(diseaseCategoryToSlug);
      const unique = new Set(slugs);
      expect(unique.size).toBe(slugs.length);
    });
  });
});
