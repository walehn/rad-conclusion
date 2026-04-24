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
  standardReferences: readonly string[];
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
      "SAR 2018",
      "AJCC 8th",
      "Bosniak 2019",
      "Neves-Mayo",
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
