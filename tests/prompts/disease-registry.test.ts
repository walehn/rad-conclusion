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

    it('references the core RCC standards by id', () => {
      const ids = DISEASE_REGISTRY.RCC.standardReferences.map((r) => r.id);
      expect(ids).toContain('sar-2019');
      expect(ids).toContain('ajcc-8th-kidney');
      expect(ids).toContain('bosniak-2019');
      expect(ids).toContain('neves-mayo-1987');
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
      expect(parseDiseaseCategorySlug('breast-cancer')).toBe(null); // not registered
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

  describe('DISEASE_REGISTRY — ProstateCancer entry', () => {
    it('contains a ProstateCancer entry', () => {
      expect(DISEASE_REGISTRY).toHaveProperty('ProstateCancer');
      expect(DISEASE_REGISTRY.ProstateCancer).toBeDefined();
      expect(DISEASE_REGISTRY.ProstateCancer.id).toBe('ProstateCancer');
    });

    it('exposes the correct English and Korean display names for ProstateCancer', () => {
      expect(DISEASE_REGISTRY.ProstateCancer.displayName).toBe('Prostate Cancer');
      expect(DISEASE_REGISTRY.ProstateCancer.displayNameKo).toBe('전립선암');
    });

    it('lists MRI as the only supported modality for ProstateCancer', () => {
      const modalities = DISEASE_REGISTRY.ProstateCancer.supportedModalities;
      expect(modalities).toEqual(['MRI']);
      expect(modalities).toHaveLength(1);
    });

    it('registers exactly 5 standard references for ProstateCancer', () => {
      const refs = DISEASE_REGISTRY.ProstateCancer.standardReferences;
      expect(refs).toHaveLength(5);
    });

    it('references the canonical prostate cancer standards by id', () => {
      const refs = DISEASE_REGISTRY.ProstateCancer.standardReferences;
      const ids = refs.map((r) => r.id);
      expect(ids).toContain('pi-rads-v2-1');
      expect(ids).toContain('ajcc-8th-prostate');
      expect(ids).toContain('eau-2025-2026');
      expect(ids).toContain('pi-qual-v2');
      expect(ids).toContain('mehralivand-epe-2019');
    });

    it('populates every required Citation field for each reference', () => {
      const refs = DISEASE_REGISTRY.ProstateCancer.standardReferences;
      for (const ref of refs) {
        expect(typeof ref.id).toBe('string');
        expect(ref.id.length).toBeGreaterThan(0);

        expect(typeof ref.shortLabel).toBe('string');
        expect(ref.shortLabel.length).toBeGreaterThan(0);

        expect(typeof ref.fullTitle).toBe('string');
        expect(ref.fullTitle.length).toBeGreaterThan(0);

        expect(typeof ref.year).toBe('number');
        expect(ref.year).toBeGreaterThan(1900);

        expect(typeof ref.scope).toBe('string');
        expect(ref.scope.length).toBeGreaterThan(0);

        expect(typeof ref.notice).toBe('string');
        expect(ref.notice && ref.notice.length).toBeGreaterThan(0);
      }
    });

    it('round-trips ProstateCancer through diseaseCategoryToSlug / parseDiseaseCategorySlug', () => {
      const slug = diseaseCategoryToSlug('ProstateCancer');
      expect(parseDiseaseCategorySlug(slug)).toBe('ProstateCancer');
    });

    it('produces "prostate-cancer" as the canonical slug for ProstateCancer', () => {
      expect(diseaseCategoryToSlug('ProstateCancer')).toBe('prostate-cancer');
    });

    it('treats "ProstateCancer" as a valid DiseaseCategory via isDiseaseCategory', () => {
      expect(isDiseaseCategory('ProstateCancer')).toBe(true);
    });

    it('returns ProstateCancer metadata via getDiseaseCategoryMetadata', () => {
      const meta = getDiseaseCategoryMetadata('ProstateCancer');
      expect(meta.id).toBe('ProstateCancer');
      expect(meta.displayName).toBe('Prostate Cancer');
      expect(meta.displayNameKo).toBe('전립선암');
      expect(meta.supportedModalities).toEqual(['MRI']);
      expect(meta.standardReferences).toHaveLength(5);
    });
  });

  describe('DISEASE_REGISTRY — UterineMyoma entry', () => {
    it('contains a UterineMyoma entry', () => {
      expect(DISEASE_REGISTRY).toHaveProperty('UterineMyoma');
      expect(DISEASE_REGISTRY.UterineMyoma.id).toBe('UterineMyoma');
    });

    it('exposes the correct English and Korean display names', () => {
      expect(DISEASE_REGISTRY.UterineMyoma.displayName).toBe('Uterine Myoma');
      expect(DISEASE_REGISTRY.UterineMyoma.displayNameKo).toBe('자궁근종');
    });

    // CT is deliberately absent: the template has no authored CT guidance, and
    // the prompt dispatcher collapses a CT hint to 'Auto' rather than inventing
    // a CT protocol description.
    it('supports MRI and US but not CT', () => {
      const modalities = DISEASE_REGISTRY.UterineMyoma.supportedModalities;
      expect(modalities).toEqual(['MRI', 'US']);
      expect(modalities).not.toContain('CT');
    });

    it('references the canonical myoma standards by id', () => {
      const ids = DISEASE_REGISTRY.UterineMyoma.standardReferences.map(
        (r) => r.id
      );
      expect(ids).toContain('figo-palm-coein-2011');
      expect(ids).toContain('esur-leiomyoma-2018');
      expect(ids).toContain('funaki-2007');
    });

    it('records the verified DOI for each reference', () => {
      const byId = new Map(
        DISEASE_REGISTRY.UterineMyoma.standardReferences.map((r) => [r.id, r])
      );
      expect(byId.get('figo-palm-coein-2011')?.url).toBe(
        'https://doi.org/10.1016/j.ijgo.2010.11.011'
      );
      expect(byId.get('esur-leiomyoma-2018')?.url).toBe(
        'https://doi.org/10.1007/s00330-017-5157-5'
      );
      expect(byId.get('funaki-2007')?.url).toBe(
        'https://doi.org/10.1016/j.ajog.2006.08.030'
      );
    });

    it('round-trips through diseaseCategoryToSlug / parseDiseaseCategorySlug', () => {
      expect(diseaseCategoryToSlug('UterineMyoma')).toBe('uterine-myoma');
      expect(parseDiseaseCategorySlug('uterine-myoma')).toBe('UterineMyoma');
    });

    it('is recognised by isDiseaseCategory and getDiseaseCategoryMetadata', () => {
      expect(isDiseaseCategory('UterineMyoma')).toBe(true);
      const meta = getDiseaseCategoryMetadata('UterineMyoma');
      expect(meta.id).toBe('UterineMyoma');
      expect(meta.standardReferences).toHaveLength(3);
    });
  });

  // Registry-wide invariants. These apply to every category, so a future
  // template inherits the same citation hygiene without a bespoke test.
  describe('citation integrity across the whole registry', () => {
    const categories = Object.keys(DISEASE_REGISTRY) as DiseaseCategory[];

    it.each(categories)('%s: citation ids are unique', (category) => {
      const ids = DISEASE_REGISTRY[category].standardReferences.map((r) => r.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it.each(categories)(
      '%s: every reference carries title, year, scope and notice',
      (category) => {
        for (const ref of DISEASE_REGISTRY[category].standardReferences) {
          expect(ref.fullTitle.length, `${ref.id} fullTitle`).toBeGreaterThan(0);
          expect(ref.shortLabel.length, `${ref.id} shortLabel`).toBeGreaterThan(
            0
          );
          expect(ref.year, `${ref.id} year`).toBeGreaterThan(1900);
          expect(ref.scope.length, `${ref.id} scope`).toBeGreaterThan(0);
          expect(ref.notice?.length ?? 0, `${ref.id} notice`).toBeGreaterThan(0);
        }
      }
    );

    // A citation URL is shown to the reader as the source of a clinical
    // criterion, so a malformed or non-HTTPS one is worse than none at all.
    it.each(categories)('%s: any citation URL is https', (category) => {
      for (const ref of DISEASE_REGISTRY[category].standardReferences) {
        if (ref.url === undefined) continue;
        expect(ref.url, `${ref.id} url`).toMatch(/^https:\/\//);
      }
    });
  });
});
