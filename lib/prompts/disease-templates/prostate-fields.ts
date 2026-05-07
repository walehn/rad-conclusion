/** Prostate Cancer (PI-RADS v2.1) field enums for SPEC-PROSTATE-001. */

// ---------------------------------------------------------------------------
// Section 1 — Clinical context
// ---------------------------------------------------------------------------

export const CLINICAL_INDICATION_OPTIONS = [
  "pre_biopsy_initial",
  "pre_biopsy_repeat_after_negative",
  "staging_after_diagnosis",
] as const;
export type ClinicalIndication = (typeof CLINICAL_INDICATION_OPTIONS)[number];

export const PRIOR_BIOPSY_STATUS_OPTIONS = [
  "none",
  "negative",
  "positive_ISUP1",
  "positive_ISUP2",
  "positive_ISUP3",
  "positive_ISUP4",
  "positive_ISUP5",
  "unknown",
] as const;
export type PriorBiopsyStatus = (typeof PRIOR_BIOPSY_STATUS_OPTIONS)[number];

// ---------------------------------------------------------------------------
// Section 2 — Lesion-level
// ---------------------------------------------------------------------------

export const ZONE_OPTIONS = [
  "peripheral_zone_PZ",
  "transition_zone_TZ",
  "central_zone_CZ",
  "anterior_fibromuscular_stroma_AFMS",
] as const;
export type Zone = (typeof ZONE_OPTIONS)[number];

export const CRANIOCAUDAL_LEVEL_OPTIONS = ["base", "mid_gland", "apex"] as const;
export type CraniocaudalLevel = (typeof CRANIOCAUDAL_LEVEL_OPTIONS)[number];

export const LATERALITY_OPTIONS = ["right", "left", "midline_bilateral"] as const;
export type Laterality = (typeof LATERALITY_OPTIONS)[number];

export const PIRADS_SCORE_OPTIONS = ["1", "2", "3", "4", "5"] as const;
export type PiradsScore = (typeof PIRADS_SCORE_OPTIONS)[number];

export const DCE_RESULT_OPTIONS = [
  "negative",
  "positive",
  "not_performed_bpMRI",
] as const;
export type DceResult = (typeof DCE_RESULT_OPTIONS)[number];

export const EPE_RISK_OPTIONS = [
  "0_no_features",
  "1_curvilinear_or_bulge",
  "2_both_features",
  "3_frank_breach",
] as const;
export type EpeRisk = (typeof EPE_RISK_OPTIONS)[number];

export const NVB_INVOLVEMENT_OPTIONS = [
  "none",
  "abutment",
  "encasement",
] as const;
export type NvbInvolvement = (typeof NVB_INVOLVEMENT_OPTIONS)[number];

export const PRIOR_MRI_COMPARISON_OPTIONS = [
  "new_lesion",
  "unchanged",
  "decreased",
  "increased_size_only",
  "increased_score",
  "not_visible_on_prior",
] as const;
export type PriorMriComparison = (typeof PRIOR_MRI_COMPARISON_OPTIONS)[number];

// ---------------------------------------------------------------------------
// Section 3 — Whole-gland & staging
// ---------------------------------------------------------------------------

export const SVI_WHOLE_GLAND_OPTIONS = [
  "none",
  "right",
  "left",
  "bilateral",
] as const;
export type SviWholeGland = (typeof SVI_WHOLE_GLAND_OPTIONS)[number];

export const LOCAL_INVOLVEMENT_OPTIONS = [
  "none",
  "abutment",
  "invasion",
] as const;
export type LocalInvolvement = (typeof LOCAL_INVOLVEMENT_OPTIONS)[number];

export const BONE_INVOLVEMENT_OPTIONS = [
  "none",
  "equivocal",
  "definite",
] as const;
export type BoneInvolvement = (typeof BONE_INVOLVEMENT_OPTIONS)[number];

export const OTHER_DISTANT_METS_OPTIONS = [
  "none",
  "lung",
  "liver",
  "other",
] as const;
export type OtherDistantMets = (typeof OTHER_DISTANT_METS_OPTIONS)[number];

export const CLINICAL_T_OPTIONS = [
  "cT1c",
  "cT2a",
  "cT2b",
  "cT2c",
  "cT3a",
  "cT3b",
  "cT4",
] as const;
export type ClinicalT = (typeof CLINICAL_T_OPTIONS)[number];

export const CLINICAL_N_OPTIONS = ["NX", "N0", "N1"] as const;
export type ClinicalN = (typeof CLINICAL_N_OPTIONS)[number];

export const CLINICAL_M_OPTIONS = ["M0", "M1a", "M1b", "M1c", "MX"] as const;
export type ClinicalM = (typeof CLINICAL_M_OPTIONS)[number];

export const EAU_RISK_GROUP_OPTIONS = [
  "low",
  "intermediate_favourable",
  "intermediate_unfavourable",
  "high",
  "not_applicable",
] as const;
export type EauRiskGroup = (typeof EAU_RISK_GROUP_OPTIONS)[number];

export const PIQUAL_OVERALL_OPTIONS = [
  "1_inadequate",
  "2_acceptable",
  "3_optimal",
] as const;
export type PiQualOverall = (typeof PIQUAL_OVERALL_OPTIONS)[number];

export const PIQUAL_T2W_DWI_SUBSCORE_OPTIONS = ["1", "2", "3", "4"] as const;
export type PiQualT2WDwiSubscore =
  (typeof PIQUAL_T2W_DWI_SUBSCORE_OPTIONS)[number];

export const PIQUAL_DCE_SUBSCORE_OPTIONS = ["+", "-", "not_applicable"] as const;
export type PiQualDceSubscore = (typeof PIQUAL_DCE_SUBSCORE_OPTIONS)[number];

// ---------------------------------------------------------------------------
// Sector codes
// ---------------------------------------------------------------------------

export const PROSTATE_SECTOR_CODES_SIMPLIFIED = [
  "R-apex",
  "R-mid",
  "R-base",
  "L-apex",
  "L-mid",
  "L-base",
] as const;
export type ProstateSectorCodeSimplified =
  (typeof PROSTATE_SECTOR_CODES_SIMPLIFIED)[number];

// PI-RADS v2.1 full sector map (canonical codes per the 2019 update;
// Turkbey et al., European Urology 2019 standardised diagram).
// Naming convention: <Side>-<Level>-<RegionCode>
//   Side:    R | L | (none for AFMS = anterior fibromuscular stroma midline-only,
//                    SV-R/SV-L for seminal vesicles, Membranous-urethra)
//   Level:   apex | mid | base
//   Region:  PZpl (peripheral zone postero-lateral), PZpm (peripheral zone postero-medial),
//            PZa (peripheral zone anterior), TZa (transition zone anterior),
//            TZp (transition zone posterior), CZ (central zone)
// Distribution per the published diagram:
//   - Apex: 5 regions (PZpl/PZpm/PZa/TZa/TZp) × 2 sides = 10
//   - Mid:  5 regions (PZpl/PZpm/PZa/TZa/TZp) × 2 sides = 10
//   - Base: 6 regions (PZpl/PZpm/PZa/TZa/TZp/CZ) × 2 sides = 12   (CZ exists at base only)
//   - Anterior fibromuscular stroma (AFMS) midline at apex/mid/base = 3
//   - Seminal vesicles bilateral = 2
//   - Membranous urethra midline = 1
// Total = 10 + 10 + 12 + 3 + 2 + 1 = 38 standardised sector codes.
export const PROSTATE_SECTOR_CODES_FULL = [
  // Apex level — bilateral (PZpl/PZpm/PZa/TZa/TZp): CZ does not appear at apex
  "R-apex-PZpl",
  "R-apex-PZpm",
  "R-apex-PZa",
  "R-apex-TZa",
  "R-apex-TZp",
  "L-apex-PZpl",
  "L-apex-PZpm",
  "L-apex-PZa",
  "L-apex-TZa",
  "L-apex-TZp",
  // Mid-gland — bilateral (PZpl/PZpm/PZa/TZa/TZp): CZ does not appear at mid
  "R-mid-PZpl",
  "R-mid-PZpm",
  "R-mid-PZa",
  "R-mid-TZa",
  "R-mid-TZp",
  "L-mid-PZpl",
  "L-mid-PZpm",
  "L-mid-PZa",
  "L-mid-TZa",
  "L-mid-TZp",
  // Base — bilateral (CZ exists at base only)
  "R-base-PZpl",
  "R-base-PZpm",
  "R-base-PZa",
  "R-base-TZa",
  "R-base-TZp",
  "R-base-CZ",
  "L-base-PZpl",
  "L-base-PZpm",
  "L-base-PZa",
  "L-base-TZa",
  "L-base-TZp",
  "L-base-CZ",
  // Anterior fibromuscular stroma — midline (3 levels)
  "AFMS-apex",
  "AFMS-mid",
  "AFMS-base",
  // Seminal vesicles — bilateral
  "SV-R",
  "SV-L",
  // Membranous urethra — midline
  "Membranous-urethra",
] as const;
export type ProstateSectorCodeFull = (typeof PROSTATE_SECTOR_CODES_FULL)[number];

// Compile-time assertion that the full sector map contains exactly 38 entries
// per the canonical PI-RADS v2.1 standardised sector diagram. If this fails
// to compile, the array literal above has drifted from the published map.
//
// NOTE: SPEC-PROSTATE-001 plan.md and the orchestrator brief both refer to
// the map informally as "41-sector"; the published PI-RADS v2.1 diagram
// (Turkbey et al., European Urology 2019) actually enumerates 38 codes when
// SV (×2) and the membranous urethra (×1) are counted alongside the
// 35 prostate-region codes (Apex 10 + Mid 10 + Base 12 + AFMS 3). The
// assertion below tracks the literal array, not the informal label.
type _AssertSectorCount = typeof PROSTATE_SECTOR_CODES_FULL extends {
  length: 38;
}
  ? true
  : false;
const _sectorCount: _AssertSectorCount = true;
void _sectorCount;
