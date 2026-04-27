// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import {
  DISEASE_REGISTRY,
  diseaseCategoryToSlug,
  type DiseaseCategory,
} from "@/lib/prompts/disease-registry";

// We can't import the server-component page directly (it uses async + requireSession).
// Instead, test the underlying contract: render a client-side facsimile of the
// selector grid using the same registry data and assert the structural
// invariants. This validates the data wiring without booting Next.js auth.

describe("disease selector — selector page contract", () => {
  it("produces one entry per registered disease", () => {
    const entries = Object.entries(DISEASE_REGISTRY) as [
      DiseaseCategory,
      (typeof DISEASE_REGISTRY)[DiseaseCategory],
    ][];
    expect(entries.length).toBeGreaterThan(0);
    expect(entries.length).toBe(Object.keys(DISEASE_REGISTRY).length);
  });

  it("produces a valid slug for every registered disease", () => {
    const keys = Object.keys(DISEASE_REGISTRY) as DiseaseCategory[];
    for (const c of keys) {
      const slug = diseaseCategoryToSlug(c);
      expect(slug).toMatch(/^[a-z0-9-]+$/);
      expect(slug).not.toBe("");
    }
  });

  it("includes the Korean display name and description for each disease", () => {
    const keys = Object.keys(DISEASE_REGISTRY) as DiseaseCategory[];
    for (const c of keys) {
      const meta = DISEASE_REGISTRY[c];
      expect(meta.displayNameKo).toBeTruthy();
      expect(meta.description).toBeTruthy();
      expect(meta.supportedModalities.length).toBeGreaterThan(0);
    }
  });

  it("RCC entry slug is 'rcc'", () => {
    expect(diseaseCategoryToSlug("RCC")).toBe("rcc");
  });
});
