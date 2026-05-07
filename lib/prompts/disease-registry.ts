/**
 * Disease Category Registry for Structured Report Generator
 * (SPEC-DASHBOARD-001, extended by SPEC-PROSTATE-001).
 *
 * Designed as a union type so future categories (HCC, etc.) can be added by
 *   (1) extending the union,
 *   (2) adding an entry to DISEASE_REGISTRY, and
 *   (3) creating a matching template module under
 *       lib/prompts/disease-templates/<category>.ts.
 */

/**
 * Supported disease categories for structured reports.
 *
 * Registered categories:
 *   - "RCC"            — Renal Cell Carcinoma (SPEC-DASHBOARD-001)
 *   - "ProstateCancer" — Prostate Cancer / PI-RADS v2.1 (SPEC-PROSTATE-001)
 *
 * Future extension example:
 *   type DiseaseCategory = "RCC" | "ProstateCancer" | "HCC" | "PulmonaryNodule";
 */
export type DiseaseCategory = "RCC" | "ProstateCancer";

/**
 * Imaging modalities supported per disease category.
 */
export type DiseaseModality = "CT" | "MRI" | "US";

/**
 * Authoritative external standard cited by a disease template.
 *
 * Surfaced in the structured-report UI (Sources dialog) and mirrored
 * verbatim in .moai/specs/SPEC-DASHBOARD-001/templates-spec.md for
 * audit traceability. Treat the registry entry as the single source of
 * truth — when a citation changes, update both this file AND the SPEC
 * markdown table in the same commit.
 */
export interface Citation {
  /** Stable internal id (kebab-case). */
  id: string;
  /** Short label for chip/badge display. */
  shortLabel: string;
  /** Full citation title (paper title or book chapter title). */
  fullTitle: string;
  /** Author list, abbreviated with "et al." for >6 authors. */
  authors?: string;
  /** Venue (journal name + volume/page, or publisher). */
  venue?: string;
  /** Publication year. */
  year: number;
  /** Verified DOI URL (preferred) or canonical publisher URL. Omit if not applicable (e.g., printed book without DOI). */
  url?: string;
  /** Brief description of how this standard is applied in the template. */
  scope: string;
  /** Copyright/paraphrasing notice shown alongside the citation. */
  notice?: string;
}

/**
 * Metadata describing a single disease category.
 */
export interface DiseaseCategoryMetadata {
  /** Stable machine identifier (also the discriminator). */
  id: DiseaseCategory;
  /** Human-readable English display name. */
  displayName: string;
  /** Human-readable Korean display name. */
  displayNameKo: string;
  /** Short English description of the report scope. */
  description: string;
  /** Modalities for which the template has authored guidance. */
  supportedModalities: readonly DiseaseModality[];
  /** Authoritative external standards referenced by the template. */
  standardReferences: readonly Citation[];
}

/**
 * Registry of all supported disease categories.
 *
 * Add new entries here as new disease-template modules land. Keep the
 * fields factually accurate per the corresponding spec/plan documents.
 */
export const DISEASE_REGISTRY: Record<DiseaseCategory, DiseaseCategoryMetadata> = {
  RCC: {
    id: "RCC",
    displayName: "Renal Cell Carcinoma",
    displayNameKo: "신세포암",
    description:
      "Renal cell carcinoma structured reporting per SAR Disease-Focused Panel (2018) with AJCC 8th edition staging",
    supportedModalities: ["CT", "MRI", "US"] as const,
    standardReferences: [
      {
        id: "sar-2019",
        shortLabel: "SAR DFP 2019",
        fullTitle:
          "Standardized report template for indeterminate renal masses at CT and MRI: a collaborative product of the SAR Disease-Focused Panel on Renal Cell Carcinoma",
        authors:
          "Davenport MS, Hu EM, Zhang A, Shinagare AB, Smith AD, Pedrosa I, et al.",
        venue: "Abdominal Radiology (NY)",
        year: 2019,
        url: "https://doi.org/10.1007/s00261-018-1851-2",
        scope:
          "FINDINGS section — 13 Core + 10 Optional reporting features (Delphi-derived)",
        notice: "Criteria paraphrased; original tables/figures not reproduced.",
      },
      {
        id: "ajcc-8th-kidney",
        shortLabel: "AJCC 8th",
        fullTitle: "AJCC Cancer Staging Manual, 8th Edition — Kidney chapter",
        authors: "Amin MB, Edge SB, Greene FL, et al. (eds.)",
        venue: "Springer",
        year: 2017,
        scope: "STAGING section — TNM categories and Stage Grouping",
        notice: "T/N/M codes are public nomenclature; manual paraphrased.",
      },
      {
        id: "bosniak-2019",
        shortLabel: "Bosniak v2019",
        fullTitle:
          "Bosniak Classification of Cystic Renal Masses, Version 2019: An Update Proposal and Needs Assessment",
        authors: "Silverman SG, Pedrosa I, Ellis JH, et al.",
        venue: "Radiology 292(2):475–488",
        year: 2019,
        url: "https://doi.org/10.1148/radiol.2019182646",
        scope: "Cystic mass classification (Class I, II, IIF, III, IV)",
        notice:
          "Criteria paraphrased; class codes are public nomenclature.",
      },
      {
        id: "neves-mayo-1987",
        shortLabel: "Neves-Mayo",
        fullTitle:
          "Surgical Treatment of Renal Cancer with Vena Cava Extension",
        authors: "Neves RJ, Zincke H",
        venue: "British Journal of Urology 59:390–395",
        year: 1987,
        url: "https://doi.org/10.1111/j.1464-410X.1987.tb04832.x",
        scope: "IVC tumor thrombus level reporting (Levels 0–IV)",
        notice: "Level 0–IV designation is public nomenclature.",
      },
    ] as const,
  },
  ProstateCancer: {
    id: "ProstateCancer",
    displayName: "Prostate Cancer",
    displayNameKo: "전립선암",
    description:
      "Prostate cancer structured reporting per PI-RADS v2.1 (treatment-naïve), with AJCC 8th edition staging and EAU 2025/2026 risk stratification",
    supportedModalities: ["MRI"] as const,
    standardReferences: [
      {
        id: "pi-rads-v2-1",
        shortLabel: "PI-RADS v2.1",
        fullTitle:
          "Prostate Imaging Reporting and Data System Version 2.1: 2019 Update of Prostate Imaging Reporting and Data System Version 2",
        authors: "Turkbey B, Rosenkrantz AB, Haider MA, et al.",
        venue: "European Urology / ACR / ESUR / AdMeTech",
        year: 2019,
        url: "https://www.europeanurology.com/article/S0302-2838(19)30180-0/fulltext",
        scope:
          "DWI/T2W/DCE per-sequence scores; per-zone overall PI-RADS 1–5; 41-sector map; lesion measurement",
        notice:
          "This template paraphrases the published recommendations; refer to the original publication for verbatim wording.",
      },
      {
        id: "ajcc-8th-prostate",
        shortLabel: "AJCC 8th",
        fullTitle: "AJCC Cancer Staging Manual, 8th Edition – Prostate chapter",
        authors: "Buyyounouski MK, Choyke PL, McKenney JK, et al.",
        venue: "American Joint Committee on Cancer / Springer",
        year: 2017,
        url: "https://acsjournals.onlinelibrary.wiley.com/doi/full/10.3322/caac.21391",
        scope: "cT/cN/cM, ISUP Grade Group, Prognostic Stage Groups",
        notice:
          "This template paraphrases the published recommendations; refer to the original publication for verbatim wording.",
      },
      {
        id: "eau-2025-2026",
        shortLabel: "EAU 2025/2026",
        fullTitle:
          "EAU-EANM-ESTRO-ESUR-ISUP-SIOG Guidelines on Prostate Cancer",
        authors: "Cornford P, van den Bergh RCN, Briers E, et al.",
        venue: "EAU / Uroweb",
        year: 2025,
        url: "https://uroweb.org/guidelines/prostate-cancer",
        scope: "Risk stratification, mpMRI role",
        notice:
          "This template paraphrases the published recommendations; refer to the original publication for verbatim wording.",
      },
      {
        id: "pi-qual-v2",
        shortLabel: "PI-QUAL v2",
        fullTitle:
          "PI-QUAL version 2: an update of a standardised scoring system for the assessment of image quality of prostate MRI",
        authors: "de Rooij M, Allen C, Twilt JJ, et al.",
        venue: "European Radiology 34:7068–7079",
        year: 2024,
        url: "https://link.springer.com/article/10.1007/s00330-024-10795-4",
        scope: "Image-quality (T2W, DWI, ±DCE); 3-point overall scale",
        notice:
          "This template paraphrases the published recommendations; refer to the original publication for verbatim wording.",
      },
      {
        id: "mehralivand-epe-2019",
        shortLabel: "Mehralivand EPE",
        fullTitle:
          "A Grading System for the Assessment of Risk of Extraprostatic Extension of Prostate Cancer at Multiparametric MRI",
        authors: "Mehralivand S, Shih JH, Harmon S, et al.",
        venue: "Radiology",
        year: 2019,
        url: "https://pubmed.ncbi.nlm.nih.gov/30667329/",
        scope: "Per-lesion EPE grade 0–3",
        notice:
          "This template paraphrases the published recommendations; refer to the original publication for verbatim wording.",
      },
    ] as const,
  },
};

/**
 * Type guard: returns true if value is a supported DiseaseCategory literal.
 */
export function isDiseaseCategory(value: unknown): value is DiseaseCategory {
  return typeof value === "string" && value in DISEASE_REGISTRY;
}

/**
 * Strict lookup: returns metadata for a known category.
 *
 * Throws if the category is unknown. Callers should either validate with
 * isDiseaseCategory() first or rely on TypeScript's union-narrowing.
 */
export function getDiseaseCategoryMetadata(
  id: DiseaseCategory
): DiseaseCategoryMetadata {
  const metadata = DISEASE_REGISTRY[id];
  if (!metadata) {
    throw new Error(`Unknown disease category: ${String(id)}`);
  }
  return metadata;
}

/**
 * Convert a DiseaseCategory PascalCase identifier to a kebab-case URL slug.
 *
 * Examples:
 *   - "RCC"            → "rcc"
 *   - "ProstateCancer" → "prostate-cancer"
 *
 * Used for routing under `/structured-report/<slug>` (SPEC-DISEASE-SELECTOR-001).
 */
export function diseaseCategoryToSlug(category: DiseaseCategory): string {
  return category.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
}

/**
 * Parse a kebab-case URL slug back into a DiseaseCategory.
 *
 * Iterates DISEASE_REGISTRY keys and returns the first whose
 * diseaseCategoryToSlug() matches the input exactly (case-strict).
 * Returns null for unregistered or malformed slugs.
 *
 * Round-trip guarantee:
 *   parseDiseaseCategorySlug(diseaseCategoryToSlug(c)) === c
 *   for every c ∈ DiseaseCategory.
 */
export function parseDiseaseCategorySlug(slug: string): DiseaseCategory | null {
  for (const key of Object.keys(DISEASE_REGISTRY) as DiseaseCategory[]) {
    if (diseaseCategoryToSlug(key) === slug) return key;
  }
  return null;
}
