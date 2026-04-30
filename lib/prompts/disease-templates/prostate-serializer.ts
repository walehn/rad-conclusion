/**
 * Prostate Cancer (PI-RADS v2.1) Structured Input — serialization helpers.
 *
 * SPEC-PROSTATE-001 (Phase 2). Pure functions only (no I/O, no side effects).
 *
 * This module mirrors `rcc-serializer.ts` in shape and behavior:
 *  - Skips `undefined` / `null` / `""` fields (RCC parity, requirement N-4).
 *  - Plain-text output with section headers in CAPS and `- <Field>: <Value>`
 *    bullet lines.
 *  - Section 4 free-text (incidental findings, bony abnormalities,
 *    recommendations) is round-tripped verbatim under "Other findings:" —
 *    multi-line preserved (RCC parity).
 *
 * Six derivation helpers encode PI-RADS v2.1 / AJCC 8th / EAU 2025 rules:
 *  - derivePiradsCategory:   PI-RADS v2.1 PZ/CZ + TZ/AFMS decision tables.
 *  - deriveClinicalT:        AJCC 8th palpation rule (MRI alone → cT1c).
 *  - deriveClinicalN:        regional ≥ 8 mm OR suspicious features → N1.
 *  - deriveClinicalM:        bone definite → M1b; non-regional nodes → M1a.
 *  - derivePsaDensity:       psa / volume rounded to 1 decimal place.
 *  - deriveEauRiskGroup:     Cornford 2025 EAU low/intermediate/high.
 */

import type {
  ClinicalIndication,
  ClinicalM,
  ClinicalN,
  ClinicalT,
  CraniocaudalLevel,
  DceResult,
  EauRiskGroup,
  EpeRisk,
  Laterality,
  LocalInvolvement,
  NvbInvolvement,
  OtherDistantMets,
  PiQualDceSubscore,
  PiQualOverall,
  PiQualT2WDwiSubscore,
  PiradsScore,
  PriorBiopsyStatus,
  PriorMriComparison,
  SviWholeGland,
  BoneInvolvement,
  Zone,
} from "./prostate-fields";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface ProstateLymphNode {
  /** Free-text station label, e.g., "obturator", "internal_iliac". */
  station?: string;
  /** Free-text location label for non-regional nodes, e.g., "retroperitoneal". */
  location?: string;
  shortAxisMm: number;
  morphology?: "round" | "oval" | "lobulated";
  /** Free-text descriptors, e.g., ["necrosis", "irregular_border"]. */
  suspiciousFeatures?: string[];
}

export interface ProstateLesion {
  /** 1..4. */
  lesionIndex: number;
  zone: Zone;
  /** ≥1 PI-RADS sector code (simplified or full map). */
  sectorMapLocation: string[];
  craniocaudalLevel: CraniocaudalLevel;
  laterality: Laterality;
  sizeMaxAxialMm: number;
  sizeOrthogonalAxialMm?: number;
  sizeCraniocaudalMm?: number;
  t2wScore: PiradsScore;
  dwiScore: PiradsScore;
  /** Defaults to "not_performed_bpMRI" in UI when absent. */
  dceResult?: DceResult;
  /** Auto-derived from t2w/dwi/dce + zone; user may override. */
  overallPiradsCategory: PiradsScore;
  isPiradsOverridden: boolean;
  overallPiradsOverrideJustification?: string;
  /** ADC mean value in 10⁻⁶ mm²/s. */
  adcMeanValue?: number;
  epeRiskMehralivand: EpeRisk;
  neurovascularBundleInvolvement?: NvbInvolvement;
  priorMRIComparison?: PriorMriComparison;
  targetForBiopsy: boolean;
}

export interface ProstateStructuredInput {
  // Section 1 — Clinical context
  /** ISO date YYYY-MM-DD. */
  studyDate: string;
  patientAgeYears?: number;
  /** ISO date YYYY-MM-DD. */
  priorMRIDate?: string;
  clinicalIndication: ClinicalIndication;
  psaNgPerMl: number;
  psaDateOffsetDays?: number;
  priorBiopsyStatus: PriorBiopsyStatus;
  /** ISO date YYYY-MM-DD. */
  priorBiopsyDate?: string;
  additionalClinicalNotes?: string;
  /**
   * Negative-MRI shortcut. When true, the form hides Section 2 (lesion list)
   * and the serializer omits the LESION blocks entirely. Staging defaults to
   * cT1c/N0/M0 unless explicitly overridden, and the IMPRESSION section is
   * fixed to a "no PI-RADS ≥3 lesion" surveillance message.
   */
  noSuspiciousLesion: boolean;
  // Section 2 — Lesion-level
  lesions: ProstateLesion[];
  // Section 3 — Whole-gland & staging
  /**
   * Transverse (left-right) prostate dimension in mm. When all three
   * dimensions (W, H, AP) are present and positive, `prostateVolumeMl` is
   * auto-derived via the ellipsoid formula in the form layer.
   */
  prostateWidthMm?: number;
  /** Cranio-caudal (longitudinal) prostate dimension in mm. */
  prostateHeightMm?: number;
  /** Antero-posterior prostate dimension in mm. */
  prostateAPMm?: number;
  /**
   * Prostate volume in mL. Populated automatically by the form when all
   * three dimensions are present (V = W × H × AP × 0.52 / 1000); kept as a
   * top-level field so PSA density and the serializer continue to consume
   * a single canonical value regardless of how it was obtained.
   */
  prostateVolumeMl: number;
  seminalVesicleInvasionWholeGland: SviWholeGland;
  bladderNeckInvolvement: LocalInvolvement;
  externalSphincterInvolvement: LocalInvolvement;
  rectalInvolvement: LocalInvolvement;
  pelvicSidewallInvolvement: LocalInvolvement;
  regionalLymphNodes?: ProstateLymphNode[];
  nonRegionalLymphNodes?: ProstateLymphNode[];
  boneInvolvement: BoneInvolvement;
  boneLesionLocations?: string[];
  otherDistantMetastasis: OtherDistantMets;
  /** Auto-derivable; presence + isStagingOverridden=true → use this value. */
  clinicalT?: ClinicalT;
  clinicalN?: ClinicalN;
  clinicalM?: ClinicalM;
  isStagingOverridden?: boolean;
  // PI-QUAL
  piQualOverall: PiQualOverall;
  piQualT2WSubscore: PiQualT2WDwiSubscore;
  piQualDWISubscore: PiQualT2WDwiSubscore;
  piQualDCESubscore?: PiQualDceSubscore;
  // Section 4 — verbatim free-text round-trip (RCC parity)
  incidentalFindings?: string;
  bonyAbnormalities?: string;
  recommendations?: string;
}

// ---------------------------------------------------------------------------
// Internal helpers — value formatting
// ---------------------------------------------------------------------------

/**
 * Returns true when a value should be skipped (undefined, null, or empty
 * string after trim). Numeric `NaN` is also treated as missing because no
 * meaningful prompt content can be derived from it.
 */
function isAbsent(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === "string" && value.trim() === "") return true;
  if (typeof value === "number" && Number.isNaN(value)) return true;
  return false;
}

/**
 * Push a `- <label>: <value>` bullet line to `lines` only when the value is
 * present (per `isAbsent`). Numbers are stringified with no unit; callers
 * provide formatted strings when units are required.
 */
function pushBullet(
  lines: string[],
  label: string,
  value: string | number | undefined | null
): void {
  if (isAbsent(value)) return;
  lines.push(`- ${label}: ${String(value)}`);
}

function formatMm(value: number | undefined): string | undefined {
  if (isAbsent(value)) return undefined;
  return `${value} mm`;
}

function formatMl(value: number | undefined): string | undefined {
  if (isAbsent(value)) return undefined;
  return `${value} mL`;
}

function formatNgPerMl(value: number | undefined): string | undefined {
  if (isAbsent(value)) return undefined;
  return `${value} ng/mL`;
}

// ---------------------------------------------------------------------------
// Derivation: PI-RADS v2.1 overall category
// ---------------------------------------------------------------------------

/**
 * PI-RADS v2.1 overall assessment category.
 *
 * - PZ (peripheral zone) and CZ (central zone, treated as PZ-like per v2.1):
 *   DWI is dominant. DCE upgrades dwi=3 → 4 only when dce='positive'. When
 *   dce='not_performed_bpMRI', the 3→4 upgrade is suppressed (return 3);
 *   non-3 DWI scores are returned unchanged.
 *
 * - TZ (transition zone) and AFMS (anterior fibromuscular stroma, treated as
 *   TZ-like per v2.1): T2W is dominant. DWI upgrades t2w=3 → 4 only when
 *   dwi >= 5 (per v2.1 TZ table). All other t2w scores are returned unchanged.
 */
export function derivePiradsCategory(
  zone: Zone,
  t2w: PiradsScore,
  dwi: PiradsScore,
  dce: DceResult | undefined
): PiradsScore {
  const usesPzRubric =
    zone === "peripheral_zone_PZ" || zone === "central_zone_CZ";

  if (usesPzRubric) {
    // PZ / CZ rubric — DWI dominant.
    if (dwi === "1") return "1";
    if (dwi === "2") return "2";
    if (dwi === "3") {
      // DCE upgrade: 3 → 4 when DCE positive AND DCE was performed.
      if (dce === "positive") return "4";
      // dce === 'negative' or 'not_performed_bpMRI' or undefined → stay at 3.
      return "3";
    }
    // dwi === '4' or '5' → unchanged regardless of DCE.
    return dwi;
  }

  // TZ / AFMS rubric — T2W dominant.
  if (t2w === "1") return "1";
  if (t2w === "2") return "2";
  if (t2w === "3") {
    // DWI upgrade: t2w=3 → 4 when dwi >= 5.
    if (dwi === "5") return "4";
    return "3";
  }
  // t2w === '4' or '5' → unchanged.
  return t2w;
}

// ---------------------------------------------------------------------------
// Derivation: AJCC 8th clinical T/N/M staging
// ---------------------------------------------------------------------------

/**
 * AJCC 8th clinical T-stage — MRI-based heuristic (Korean clinical workflow).
 *
 * NOTE: This implementation deviates from AJCC 8th's strict requirement that
 * cT2 sub-staging requires palpation evidence. In Korean practice DRE results
 * are rarely communicated to the radiology service, so the form intentionally
 * derives cT2a/b/c from MRI lesion laterality and size. Clinicians who hold
 * authoritative palpation/biopsy data can correct the value via the
 * `isStagingOverridden` + `clinicalT` override path.
 *
 * Priority order (highest cT wins):
 *  1. noSuspiciousLesion === true                               → cT1c
 *  2. structural invasion (bladder neck / ext. sphincter /
 *     rectum / pelvic sidewall === 'invasion')                  → cT4
 *  3. seminalVesicleInvasionWholeGland !== 'none'                → cT3b
 *  4. any lesion's epeRiskMehralivand ∈ {1, 2, 3}                → cT3a
 *  5. lesion-side cT2 heuristic:
 *     - any lesion laterality 'midline_bilateral' OR
 *       lesions span both 'right' AND 'left'                     → cT2c
 *     - single unilateral lesion with sizeMaxAxialMm >=
 *       prostateWidthMm / 2 (or >= 20 mm fallback when width
 *       missing)                                                 → cT2b
 *     - any other unilateral lesion present                      → cT2a
 *  6. lesion 0개 + noSuspiciousLesion=false                      → cT1c
 */
export function deriveClinicalT(input: ProstateStructuredInput): ClinicalT {
  // Step 1: explicit no-lesion shortcut.
  if (input.noSuspiciousLesion) {
    return "cT1c";
  }

  // Step 2: cT4 — structural invasion.
  if (
    input.bladderNeckInvolvement === "invasion" ||
    input.externalSphincterInvolvement === "invasion" ||
    input.rectalInvolvement === "invasion" ||
    input.pelvicSidewallInvolvement === "invasion"
  ) {
    return "cT4";
  }

  // Step 3: cT3b — seminal vesicle invasion (whole-gland field is the single
  // source of truth after the lesion-level SVI suspicion field was retired).
  if (input.seminalVesicleInvasionWholeGland !== "none") {
    return "cT3b";
  }

  // Step 4: cT3a — extraprostatic extension per Mehralivand grade.
  if (
    input.lesions.some(
      (l) =>
        l.epeRiskMehralivand === "1_curvilinear_or_bulge" ||
        l.epeRiskMehralivand === "2_both_features" ||
        l.epeRiskMehralivand === "3_frank_breach"
    )
  ) {
    return "cT3a";
  }

  // Step 5: cT2 sub-stage from MRI lesion geometry.
  if (input.lesions.length === 0) {
    return "cT1c";
  }

  const hasMidlineBilateral = input.lesions.some(
    (l) => l.laterality === "midline_bilateral"
  );
  const hasRight = input.lesions.some((l) => l.laterality === "right");
  const hasLeft = input.lesions.some((l) => l.laterality === "left");
  if (hasMidlineBilateral || (hasRight && hasLeft)) {
    return "cT2c";
  }

  // Single-side lesion(s). Use the largest axial dimension across all lesions
  // versus the half-width threshold to discriminate cT2a vs cT2b.
  const halfWidth =
    typeof input.prostateWidthMm === "number" &&
    !Number.isNaN(input.prostateWidthMm) &&
    input.prostateWidthMm > 0
      ? input.prostateWidthMm / 2
      : 20; // 20 mm fallback when width is missing.
  const largestAxial = Math.max(
    ...input.lesions.map((l) =>
      typeof l.sizeMaxAxialMm === "number" && !Number.isNaN(l.sizeMaxAxialMm)
        ? l.sizeMaxAxialMm
        : 0
    )
  );
  if (largestAxial >= halfWidth) {
    return "cT2b";
  }
  return "cT2a";
}

/**
 * AJCC 8th clinical N-stage.
 *  - NX: no nodes assessed (both regional and non-regional arrays empty/absent).
 *  - N1: regional node with shortAxisMm >= 8 OR any suspiciousFeatures present.
 *  - N0: regional nodes assessed with no suspicious features.
 */
export function deriveClinicalN(input: ProstateStructuredInput): ClinicalN {
  const regional = input.regionalLymphNodes ?? [];
  const nonRegional = input.nonRegionalLymphNodes ?? [];

  if (regional.length === 0 && nonRegional.length === 0) {
    return "NX";
  }

  const hasSuspiciousRegional = regional.some(
    (n) =>
      n.shortAxisMm >= 8 ||
      (n.suspiciousFeatures !== undefined && n.suspiciousFeatures.length > 0)
  );
  if (hasSuspiciousRegional) return "N1";

  // Regional nodes assessed but none meet suspicious criteria.
  return "N0";
}

/**
 * AJCC 8th clinical M-stage.
 *  - M1c: visceral metastasis (lung / liver / other).
 *  - M1b: bone involvement === 'definite'.
 *  - M1a: any non-regional lymph nodes present.
 *  - MX:  bone involvement === 'equivocal' (and no other M1 evidence).
 *  - M0:  none of the above.
 */
export function deriveClinicalM(input: ProstateStructuredInput): ClinicalM {
  if (
    input.otherDistantMetastasis === "lung" ||
    input.otherDistantMetastasis === "liver" ||
    input.otherDistantMetastasis === "other"
  ) {
    return "M1c";
  }
  if (input.boneInvolvement === "definite") {
    return "M1b";
  }
  if (
    input.nonRegionalLymphNodes !== undefined &&
    input.nonRegionalLymphNodes.length > 0
  ) {
    return "M1a";
  }
  if (input.boneInvolvement === "equivocal") {
    return "MX";
  }
  return "M0";
}

// ---------------------------------------------------------------------------
// Derivation: PSA density and EAU risk group
// ---------------------------------------------------------------------------

/**
 * Compute prostate volume (mL) from three orthogonal dimensions via the
 * ellipsoid approximation:
 *
 *   V (mL) = W (mm) × H (mm) × AP (mm) × 0.52 / 1000
 *
 * The 0.52 constant approximates π/6 (≈ 0.5236), the standard ellipsoid
 * volume coefficient used in clinical prostate volumetry. Dividing by 1000
 * converts mm³ to cm³ (= mL).
 *
 * Returns `undefined` when any dimension is missing, NaN, or non-positive
 * so callers can fall back to a placeholder display rather than `NaN`.
 */
export function deriveProstateVolume(
  widthMm: number | undefined,
  heightMm: number | undefined,
  apMm: number | undefined
): number | undefined {
  if (
    typeof widthMm !== "number" ||
    Number.isNaN(widthMm) ||
    widthMm <= 0 ||
    typeof heightMm !== "number" ||
    Number.isNaN(heightMm) ||
    heightMm <= 0 ||
    typeof apMm !== "number" ||
    Number.isNaN(apMm) ||
    apMm <= 0
  ) {
    return undefined;
  }
  return Math.round(((widthMm * heightMm * apMm * 0.52) / 1000) * 10) / 10;
}

/**
 * PSA density = PSA (ng/mL) / prostate volume (mL), rounded to 1 decimal.
 * Returns `undefined` when either input is missing, NaN, or volume <= 0.
 */
export function derivePsaDensity(
  psaNgPerMl: number,
  prostateVolumeMl: number
): number | undefined {
  if (
    typeof psaNgPerMl !== "number" ||
    Number.isNaN(psaNgPerMl) ||
    typeof prostateVolumeMl !== "number" ||
    Number.isNaN(prostateVolumeMl) ||
    prostateVolumeMl <= 0
  ) {
    return undefined;
  }
  return Math.round((psaNgPerMl / prostateVolumeMl) * 10) / 10;
}

/**
 * Extract the ISUP grade encoded in `priorBiopsyStatus`. Returns 0 when no
 * positive biopsy is on record (none / negative / unknown).
 */
function extractIsupGrade(status: PriorBiopsyStatus): number {
  switch (status) {
    case "positive_ISUP1":
      return 1;
    case "positive_ISUP2":
      return 2;
    case "positive_ISUP3":
      return 3;
    case "positive_ISUP4":
      return 4;
    case "positive_ISUP5":
      return 5;
    case "none":
    case "negative":
    case "unknown":
      return 0;
  }
}

/**
 * EAU 2025/2026 risk group (Cornford 2025 Table 4.3, simplified).
 *
 * Only computed when `clinicalIndication === 'staging_after_diagnosis'`. For
 * pre-biopsy indications, returns 'not_applicable'.
 *
 * Rules:
 *  - low: PSA < 10 AND ISUP === 1 AND clinicalT in {cT1c, cT2a}.
 *  - high: PSA > 20 OR ISUP >= 4 OR clinicalT in {cT3a, cT3b, cT4}.
 *  - intermediate factors: PSA 10–20, ISUP 2 or 3, clinicalT in {cT2b, cT2c}.
 *      • 2+ factors → intermediate_unfavourable.
 *      • exactly 1 factor → intermediate_favourable.
 *  - Fallback (ISUP 0 with no positive biopsy on record): 'not_applicable',
 *    since EAU risk requires biopsy-confirmed disease.
 */
export function deriveEauRiskGroup(
  input: ProstateStructuredInput
): EauRiskGroup {
  if (input.clinicalIndication !== "staging_after_diagnosis") {
    return "not_applicable";
  }

  if (input.noSuspiciousLesion) {
    // Negative MRI: even with biopsy-confirmed prior disease, this scan
    // contributes no measurable T-stage evidence so EAU stratification
    // is left to the clinician via the staging override path.
    return "not_applicable";
  }

  const isup = extractIsupGrade(input.priorBiopsyStatus);
  if (isup === 0) {
    // EAU risk stratification requires biopsy-confirmed disease.
    return "not_applicable";
  }

  const cT = deriveClinicalT(input);
  const psa = input.psaNgPerMl;

  // High-risk gates (any ONE triggers high).
  if (psa > 20) return "high";
  if (isup >= 4) return "high";
  if (cT === "cT3a" || cT === "cT3b" || cT === "cT4") return "high";

  // Low-risk gates (ALL must hold).
  if (psa < 10 && isup === 1 && (cT === "cT1c" || cT === "cT2a")) {
    return "low";
  }

  // Intermediate factor count.
  let factors = 0;
  if (psa >= 10 && psa <= 20) factors += 1;
  if (isup === 2 || isup === 3) factors += 1;
  if (cT === "cT2b" || cT === "cT2c") factors += 1;

  if (factors >= 2) return "intermediate_unfavourable";
  if (factors === 1) return "intermediate_favourable";

  // No high-risk trigger, doesn't satisfy low-risk all-of, and no intermediate
  // factor (e.g., ISUP 1, PSA < 10, but cT is non-T2a like cT1c with no
  // additional risk drivers — already handled by low-risk path). Fall back.
  return "not_applicable";
}

// ---------------------------------------------------------------------------
// Internal helpers — block builders
// ---------------------------------------------------------------------------

function clinicalContextBlock(input: ProstateStructuredInput): string[] {
  const lines: string[] = ["CLINICAL CONTEXT"];
  pushBullet(lines, "Study date", input.studyDate);
  pushBullet(lines, "Patient age", input.patientAgeYears);
  pushBullet(lines, "Prior MRI date", input.priorMRIDate);
  pushBullet(lines, "Clinical indication", input.clinicalIndication);
  pushBullet(lines, "PSA", formatNgPerMl(input.psaNgPerMl));
  pushBullet(
    lines,
    "PSA date offset (days from study)",
    input.psaDateOffsetDays
  );
  pushBullet(lines, "Prior biopsy status", input.priorBiopsyStatus);
  pushBullet(lines, "Prior biopsy date", input.priorBiopsyDate);
  if (input.noSuspiciousLesion) {
    lines.push("- No suspicious lesion: yes (PI-RADS ≤ 2 negative MRI)");
  }

  const psaDensity = derivePsaDensity(
    input.psaNgPerMl,
    input.prostateVolumeMl
  );
  if (psaDensity !== undefined) {
    lines.push(`- PSA density: ${psaDensity} ng/mL/cc`);
  }

  const notes = input.additionalClinicalNotes?.trim();
  if (notes) {
    lines.push(`- Additional clinical notes: ${notes}`);
  }

  return lines;
}

function lesionBlock(lesion: ProstateLesion, index: number): string[] {
  const header = `LESION ${index + 1}`;
  const lines: string[] = [header];
  pushBullet(lines, "Zone", lesion.zone);
  pushBullet(
    lines,
    "Sector map location",
    lesion.sectorMapLocation.length > 0
      ? lesion.sectorMapLocation.join(", ")
      : undefined
  );
  pushBullet(lines, "Craniocaudal level", lesion.craniocaudalLevel);
  pushBullet(lines, "Laterality", lesion.laterality);
  pushBullet(lines, "Size (max axial)", formatMm(lesion.sizeMaxAxialMm));
  pushBullet(
    lines,
    "Size (orthogonal axial)",
    formatMm(lesion.sizeOrthogonalAxialMm)
  );
  pushBullet(
    lines,
    "Size (craniocaudal)",
    formatMm(lesion.sizeCraniocaudalMm)
  );
  pushBullet(lines, "T2W score", lesion.t2wScore);
  pushBullet(lines, "DWI score", lesion.dwiScore);
  pushBullet(lines, "DCE result", lesion.dceResult);
  pushBullet(lines, "Overall PI-RADS category", lesion.overallPiradsCategory);
  if (lesion.isPiradsOverridden) {
    lines.push("- Overall PI-RADS overridden: yes");
    const just = lesion.overallPiradsOverrideJustification?.trim();
    if (just) {
      lines.push(`- Override justification: ${just}`);
    }
  }
  if (lesion.adcMeanValue !== undefined && !Number.isNaN(lesion.adcMeanValue)) {
    lines.push(`- ADC mean value: ${lesion.adcMeanValue} ×10⁻⁶ mm²/s`);
  }
  pushBullet(lines, "EPE risk (Mehralivand)", lesion.epeRiskMehralivand);
  pushBullet(
    lines,
    "Neurovascular bundle involvement",
    lesion.neurovascularBundleInvolvement
  );
  pushBullet(lines, "Prior MRI comparison", lesion.priorMRIComparison);
  lines.push(
    `- Target for biopsy: ${lesion.targetForBiopsy ? "yes" : "no"}`
  );

  return lines;
}

function lymphNodeLines(
  label: string,
  nodes: ProstateLymphNode[] | undefined
): string[] {
  if (nodes === undefined || nodes.length === 0) return [];
  const lines: string[] = [`- ${label}:`];
  nodes.forEach((node, idx) => {
    const parts: string[] = [];
    if (!isAbsent(node.station)) parts.push(`station ${node.station}`);
    if (!isAbsent(node.location)) parts.push(`location ${node.location}`);
    parts.push(`short axis ${node.shortAxisMm} mm`);
    if (!isAbsent(node.morphology)) parts.push(`morphology ${node.morphology}`);
    if (
      node.suspiciousFeatures !== undefined &&
      node.suspiciousFeatures.length > 0
    ) {
      parts.push(`features: ${node.suspiciousFeatures.join(", ")}`);
    }
    lines.push(`  - Node ${idx + 1}: ${parts.join("; ")}`);
  });
  return lines;
}

function wholeGlandStagingBlock(input: ProstateStructuredInput): string[] {
  const lines: string[] = ["WHOLE-GLAND & STAGING"];
  if (
    input.prostateWidthMm !== undefined &&
    input.prostateHeightMm !== undefined &&
    input.prostateAPMm !== undefined
  ) {
    pushBullet(
      lines,
      "Prostate dimensions (W × H × AP)",
      `${input.prostateWidthMm} × ${input.prostateHeightMm} × ${input.prostateAPMm} mm`
    );
  }
  pushBullet(lines, "Prostate volume", formatMl(input.prostateVolumeMl));
  pushBullet(
    lines,
    "Seminal vesicle invasion (whole gland)",
    input.seminalVesicleInvasionWholeGland
  );
  pushBullet(lines, "Bladder neck involvement", input.bladderNeckInvolvement);
  pushBullet(
    lines,
    "External sphincter involvement",
    input.externalSphincterInvolvement
  );
  pushBullet(lines, "Rectal involvement", input.rectalInvolvement);
  pushBullet(
    lines,
    "Pelvic sidewall involvement",
    input.pelvicSidewallInvolvement
  );

  lines.push(...lymphNodeLines("Regional lymph nodes", input.regionalLymphNodes));
  lines.push(
    ...lymphNodeLines("Non-regional lymph nodes", input.nonRegionalLymphNodes)
  );

  pushBullet(lines, "Bone involvement", input.boneInvolvement);
  if (
    input.boneLesionLocations !== undefined &&
    input.boneLesionLocations.length > 0
  ) {
    lines.push(
      `- Bone lesion locations: ${input.boneLesionLocations.join(", ")}`
    );
  }
  pushBullet(
    lines,
    "Other distant metastasis",
    input.otherDistantMetastasis
  );

  // Auto-derived staging — emit override values when isStagingOverridden=true,
  // otherwise emit the canonical derived value.
  //
  // Negative-MRI shortcut: when noSuspiciousLesion=true AND no manual override
  // is supplied, AJCC TNM categorization is not meaningful (TNM presupposes
  // confirmed disease whose extent can be measured). The block omits the
  // Clinical T/N/M and EAU lines so the downstream prompt can render the
  // STAGING section as "Not applicable — negative MRI." A user-driven
  // isStagingOverridden=true is honoured even on a negative MRI, since it
  // signals authoritative clinical knowledge (e.g. staging_after_diagnosis
  // patients with a prior biopsy whose disease is invisible on the current
  // MRI but whose cT was set by the referring clinician).
  const overridden = input.isStagingOverridden === true;
  const stagingSuppressed = input.noSuspiciousLesion && !overridden;

  if (!stagingSuppressed) {
    const cT =
      overridden && input.clinicalT !== undefined
        ? input.clinicalT
        : deriveClinicalT(input);
    const cN =
      overridden && input.clinicalN !== undefined
        ? input.clinicalN
        : deriveClinicalN(input);
    const cM =
      overridden && input.clinicalM !== undefined
        ? input.clinicalM
        : deriveClinicalM(input);
    lines.push(`- Clinical T: ${cT}`);
    lines.push(`- Clinical N: ${cN}`);
    lines.push(`- Clinical M: ${cM}`);
    if (overridden) {
      lines.push("- Staging overridden: yes");
    }

    const eau = deriveEauRiskGroup(input);
    lines.push(`- EAU risk group: ${eau}`);
  }

  // PI-QUAL
  pushBullet(lines, "PI-QUAL overall", input.piQualOverall);
  pushBullet(lines, "PI-QUAL T2W subscore", input.piQualT2WSubscore);
  pushBullet(lines, "PI-QUAL DWI subscore", input.piQualDWISubscore);
  pushBullet(lines, "PI-QUAL DCE subscore", input.piQualDCESubscore);

  return lines;
}

/**
 * Section 4 free-text round-trip — multi-line preserved verbatim (RCC parity).
 * Returns [] when all three fields are absent / empty.
 */
function otherFindingsBlock(input: ProstateStructuredInput): string[] {
  const incidental = input.incidentalFindings?.trim();
  const bony = input.bonyAbnormalities?.trim();
  const recs = input.recommendations?.trim();

  if (!incidental && !bony && !recs) return [];

  const lines: string[] = ["OTHER FINDINGS"];
  if (incidental) {
    lines.push("Incidental findings:");
    lines.push(input.incidentalFindings as string);
  }
  if (bony) {
    lines.push("Bony abnormalities:");
    lines.push(input.bonyAbnormalities as string);
  }
  if (recs) {
    lines.push("Recommendations:");
    lines.push(input.recommendations as string);
  }
  return lines;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Serialize a ProstateStructuredInput into a plain-text representation
 * suitable for inclusion in LLM prompts. Sections are separated by blank
 * lines. Section 4 free-text fields are emitted verbatim, preserving any
 * multi-line input.
 *
 * Section order:
 *   CLINICAL CONTEXT
 *   LESION 1
 *   LESION 2
 *   ...
 *   WHOLE-GLAND & STAGING
 *   OTHER FINDINGS
 */
export function serializeProstateStructuredInput(
  input: ProstateStructuredInput
): string {
  const blocks: string[] = [];

  blocks.push(clinicalContextBlock(input).join("\n"));

  input.lesions.forEach((lesion, idx) => {
    blocks.push(lesionBlock(lesion, idx).join("\n"));
  });

  blocks.push(wholeGlandStagingBlock(input).join("\n"));

  const other = otherFindingsBlock(input);
  if (other.length > 0) {
    blocks.push(other.join("\n"));
  }

  return blocks.join("\n\n");
}

// ---------------------------------------------------------------------------
// Initial-state factories (Phase 5 UI seed)
// ---------------------------------------------------------------------------

/**
 * Build a minimum-viable empty `ProstateStructuredInput` with all required
 * fields populated using the safest non-destructive defaults. Numeric required
 * fields default to 0 so `hasMinimumProstateFields` stays false until the user
 * provides real values; enum fields default to the most conservative "none" /
 * intact / pre-biopsy options.
 */
export function createEmptyProstateInput(): ProstateStructuredInput {
  return {
    studyDate: "",
    clinicalIndication: "pre_biopsy_initial",
    psaNgPerMl: 0,
    priorBiopsyStatus: "none",
    noSuspiciousLesion: false,
    lesions: [],
    prostateVolumeMl: 0,
    seminalVesicleInvasionWholeGland: "none",
    bladderNeckInvolvement: "none",
    externalSphincterInvolvement: "none",
    rectalInvolvement: "none",
    pelvicSidewallInvolvement: "none",
    boneInvolvement: "none",
    otherDistantMetastasis: "none",
    piQualOverall: "2_acceptable",
    piQualT2WSubscore: "3",
    piQualDWISubscore: "3",
  };
}

/**
 * Build an empty `ProstateLesion` seeded with the Phase-5 UI defaults.
 *  - Zone defaults to peripheral_zone_PZ (most common PI-RADS index lesion).
 *  - Scores default to "3" (equivocal) so the user has to actively grade.
 *  - DCE defaults to "not_performed_bpMRI" so the PZ 3→4 upgrade is suppressed
 *    until the user confirms DCE was acquired.
 *  - Override flags default to false so the auto-derived overall PI-RADS
 *    category drives the UI until the user opts in to manual override.
 */
export function createEmptyProstateLesion(lesionIndex: number): ProstateLesion {
  return {
    lesionIndex,
    zone: "peripheral_zone_PZ",
    sectorMapLocation: [],
    craniocaudalLevel: "mid_gland",
    laterality: "right",
    sizeMaxAxialMm: 0,
    t2wScore: "3",
    dwiScore: "3",
    dceResult: "not_performed_bpMRI",
    overallPiradsCategory: "3",
    isPiradsOverridden: false,
    epeRiskMehralivand: "0_no_features",
    targetForBiopsy: false,
  };
}

/**
 * Returns true when the input contains the minimum fields required for a
 * meaningful prostate prompt. Form-layer enforces stricter requirements
 * (e.g., PI-QUAL T2W/DWI subscores); this gate is the serializer minimum.
 *
 * When `noSuspiciousLesion` is true the function only validates the
 * study-level fields (date, indication, PSA, volume, PI-QUAL) and skips the
 * lesion-list checks — Section 2 of the form is hidden in that mode.
 */
export function hasMinimumProstateFields(
  input: ProstateStructuredInput
): boolean {
  if (isAbsent(input.studyDate)) return false;
  if (isAbsent(input.clinicalIndication)) return false;
  if (typeof input.psaNgPerMl !== "number" || input.psaNgPerMl <= 0) {
    return false;
  }
  if (
    typeof input.prostateVolumeMl !== "number" ||
    input.prostateVolumeMl <= 0
  ) {
    return false;
  }
  if (isAbsent(input.piQualOverall)) return false;

  if (input.noSuspiciousLesion) {
    return true;
  }

  if (!Array.isArray(input.lesions) || input.lesions.length < 1) return false;

  const first = input.lesions[0];
  if (isAbsent(first.t2wScore)) return false;
  if (isAbsent(first.dwiScore)) return false;
  if (
    !Array.isArray(first.sectorMapLocation) ||
    first.sectorMapLocation.length < 1
  ) {
    return false;
  }

  return true;
}
