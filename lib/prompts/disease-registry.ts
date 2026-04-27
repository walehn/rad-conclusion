/**
 * Disease Category Registry for Structured Report Generator (SPEC-DASHBOARD-001).
 *
 * v0.1.0 scope: RCC (Renal Cell Carcinoma) only.
 *
 * Designed as a union type so future categories (HCC, Prostate Cancer, etc.)
 * can be added by (1) extending the union, (2) adding an entry to
 * DISEASE_REGISTRY, and (3) creating a matching template module under
 * lib/prompts/disease-templates/<category>.ts.
 */

/**
 * Supported disease categories for structured reports.
 *
 * v0.1.0: 'RCC' only. Future union extension example:
 *   type DiseaseCategory = 'RCC' | 'HCC' | 'ProstateCancer' | 'PulmonaryNodule';
 */
export type DiseaseCategory = "RCC";

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
