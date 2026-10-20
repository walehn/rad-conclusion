/**
 * Prostate Cancer (PI-RADS v2.1) serializer + derivation helper unit tests.
 *
 * SPEC-PROSTATE-001 Phase 2. Targets:
 *  - hasMinimumProstateFields gating logic
 *  - derivePiradsCategory (PZ + TZ + AFMS rubrics)
 *  - deriveClinicalT (AJCC 8th, palpation rule N-1)
 *  - deriveClinicalN / deriveClinicalM
 *  - derivePsaDensity (NaN-safe)
 *  - deriveEauRiskGroup (Cornford 2025)
 *  - deriveMriProtocol (DCE evidence → mpMRI, else bpMRI)
 *  - resolveStaging (override values win only when isStagingOverridden)
 *  - serializeProstateStructuredInput (skip-empty + verbatim Section-4 RCC parity)
 */

import { describe, it, expect } from "vitest";
import {
  derivePiradsCategory,
  deriveClinicalT,
  deriveClinicalN,
  deriveClinicalM,
  deriveProstateVolume,
  derivePsaDensity,
  deriveEauRiskGroup,
  deriveMriProtocol,
  hasMinimumProstateFields,
  resolveStaging,
  serializeProstateStructuredInput,
  type ProstateStructuredInput,
  type ProstateLesion,
} from "@/lib/prompts/disease-templates/prostate-serializer";

// ---------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------

/**
 * Build a minimum-valid ProstateLesion for tests. Override individual fields
 * via the spread argument.
 */
function makeLesion(overrides: Partial<ProstateLesion> = {}): ProstateLesion {
  return {
    lesionIndex: 1,
    zone: "peripheral_zone_PZ",
    sectorMapLocation: ["R-mid-PZpl"],
    craniocaudalLevel: "mid_gland",
    laterality: "right",
    sizeMaxAxialMm: 12,
    t2wScore: "4",
    dwiScore: "4",
    overallPiradsCategory: "4",
    isPiradsOverridden: false,
    epeRiskMehralivand: "0_no_features",
    targetForBiopsy: true,
    ...overrides,
  };
}

/**
 * Build a minimum-valid ProstateStructuredInput. Use `overrides` to mutate
 * individual fields per test.
 */
function makeInput(
  overrides: Partial<ProstateStructuredInput> = {}
): ProstateStructuredInput {
  return {
    studyDate: "2026-04-27",
    clinicalIndication: "pre_biopsy_initial",
    psaNgPerMl: 6.5,
    priorBiopsyStatus: "none",
    noSuspiciousLesion: false,
    lesions: [makeLesion()],
    prostateVolumeMl: 40,
    prostateWidthMm: 40,
    seminalVesicleInvasionWholeGland: "none",
    bladderNeckInvolvement: "none",
    externalSphincterInvolvement: "none",
    rectalInvolvement: "none",
    pelvicSidewallInvolvement: "none",
    boneInvolvement: "none",
    otherDistantMetastasis: "none",
    piQualOverall: "3_optimal",
    piQualT2WSubscore: "4",
    piQualDWISubscore: "4",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// hasMinimumProstateFields
// ---------------------------------------------------------------------------

describe("hasMinimumProstateFields", () => {
  it("returns true for a minimal valid input", () => {
    expect(hasMinimumProstateFields(makeInput())).toBe(true);
  });

  it("returns false for empty/sparse input", () => {
    // Cast required because the type contract is fully populated.
    const empty = {} as unknown as ProstateStructuredInput;
    expect(hasMinimumProstateFields(empty)).toBe(false);
  });

  it("returns false when studyDate is empty string", () => {
    expect(hasMinimumProstateFields(makeInput({ studyDate: "" }))).toBe(false);
  });

  it("returns false when psaNgPerMl is missing/zero", () => {
    expect(hasMinimumProstateFields(makeInput({ psaNgPerMl: 0 }))).toBe(false);
    expect(
      hasMinimumProstateFields(
        makeInput({ psaNgPerMl: undefined as unknown as number })
      )
    ).toBe(false);
  });

  it("returns false when prostateVolumeMl is missing/zero", () => {
    expect(hasMinimumProstateFields(makeInput({ prostateVolumeMl: 0 }))).toBe(
      false
    );
  });

  it("returns false when piQualOverall is missing", () => {
    expect(
      hasMinimumProstateFields(
        makeInput({ piQualOverall: undefined as never })
      )
    ).toBe(false);
  });

  it("returns false when lesions array is empty (and noSuspiciousLesion=false)", () => {
    expect(hasMinimumProstateFields(makeInput({ lesions: [] }))).toBe(false);
  });

  it("returns true when noSuspiciousLesion=true and lesions array is empty", () => {
    expect(
      hasMinimumProstateFields(
        makeInput({ noSuspiciousLesion: true, lesions: [] })
      )
    ).toBe(true);
  });

  it("noSuspiciousLesion=true skips first-lesion sector/score validation", () => {
    expect(
      hasMinimumProstateFields(
        makeInput({
          noSuspiciousLesion: true,
          lesions: [],
        })
      )
    ).toBe(true);
  });

  it("returns false when first lesion is missing t2w or dwi score", () => {
    expect(
      hasMinimumProstateFields(
        makeInput({
          lesions: [makeLesion({ t2wScore: undefined as never })],
        })
      )
    ).toBe(false);
    expect(
      hasMinimumProstateFields(
        makeInput({
          lesions: [makeLesion({ dwiScore: undefined as never })],
        })
      )
    ).toBe(false);
  });

  it("returns false when first lesion has no sectorMapLocation", () => {
    expect(
      hasMinimumProstateFields(
        makeInput({
          lesions: [makeLesion({ sectorMapLocation: [] })],
        })
      )
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// derivePiradsCategory — PZ rubric (PZ + CZ)
// ---------------------------------------------------------------------------

describe("derivePiradsCategory — PZ rubric", () => {
  it("dwi=1 → 1 regardless of t2w/dce", () => {
    expect(derivePiradsCategory("peripheral_zone_PZ", "5", "1", "positive")).toBe("1");
    expect(derivePiradsCategory("peripheral_zone_PZ", "1", "1", "negative")).toBe("1");
    expect(
      derivePiradsCategory("peripheral_zone_PZ", "3", "1", "not_performed_bpMRI")
    ).toBe("1");
  });

  it("dwi=2 → 2 regardless of t2w/dce", () => {
    expect(derivePiradsCategory("peripheral_zone_PZ", "1", "2", "positive")).toBe("2");
    expect(derivePiradsCategory("peripheral_zone_PZ", "5", "2", "negative")).toBe("2");
    expect(
      derivePiradsCategory("peripheral_zone_PZ", "5", "2", "not_performed_bpMRI")
    ).toBe("2");
  });

  it("dwi=3 + dce=positive → 4 (DCE upgrade)", () => {
    expect(derivePiradsCategory("peripheral_zone_PZ", "1", "3", "positive")).toBe("4");
    expect(derivePiradsCategory("peripheral_zone_PZ", "5", "3", "positive")).toBe("4");
  });

  it("dwi=3 + dce=negative → 3 (no upgrade)", () => {
    expect(derivePiradsCategory("peripheral_zone_PZ", "5", "3", "negative")).toBe("3");
  });

  it("dwi=3 + dce=not_performed_bpMRI → 3 (suppression, E-3 / N-5)", () => {
    expect(
      derivePiradsCategory("peripheral_zone_PZ", "5", "3", "not_performed_bpMRI")
    ).toBe("3");
  });

  it("dwi=3 + dce=undefined → 3 (no upgrade)", () => {
    expect(derivePiradsCategory("peripheral_zone_PZ", "5", "3", undefined)).toBe("3");
  });

  it("dwi=4 → 4 regardless of t2w/dce (no suppression for non-3 cases)", () => {
    expect(derivePiradsCategory("peripheral_zone_PZ", "1", "4", "positive")).toBe("4");
    expect(derivePiradsCategory("peripheral_zone_PZ", "5", "4", "negative")).toBe("4");
    expect(
      derivePiradsCategory("peripheral_zone_PZ", "5", "4", "not_performed_bpMRI")
    ).toBe("4");
  });

  it("dwi=5 → 5 regardless of t2w/dce", () => {
    expect(derivePiradsCategory("peripheral_zone_PZ", "1", "5", "positive")).toBe("5");
    expect(
      derivePiradsCategory("peripheral_zone_PZ", "5", "5", "not_performed_bpMRI")
    ).toBe("5");
  });

  it("CZ uses PZ rubric (CZ tumors aggressive per v2.1)", () => {
    expect(derivePiradsCategory("central_zone_CZ", "1", "3", "positive")).toBe("4");
    expect(
      derivePiradsCategory("central_zone_CZ", "5", "3", "not_performed_bpMRI")
    ).toBe("3");
    expect(derivePiradsCategory("central_zone_CZ", "1", "5", undefined)).toBe("5");
  });
});

// ---------------------------------------------------------------------------
// derivePiradsCategory — TZ rubric (TZ + AFMS)
// ---------------------------------------------------------------------------

describe("derivePiradsCategory — TZ rubric", () => {
  it("t2w=1 → 1 regardless of dwi/dce", () => {
    expect(derivePiradsCategory("transition_zone_TZ", "1", "5", "positive")).toBe("1");
    expect(derivePiradsCategory("transition_zone_TZ", "1", "1", undefined)).toBe("1");
  });

  it("t2w=2 → 2 regardless of dwi/dce", () => {
    expect(derivePiradsCategory("transition_zone_TZ", "2", "5", "positive")).toBe("2");
    expect(derivePiradsCategory("transition_zone_TZ", "2", "1", "negative")).toBe("2");
  });

  it("t2w=3 + dwi<5 → 3 (no upgrade)", () => {
    expect(derivePiradsCategory("transition_zone_TZ", "3", "1", "positive")).toBe("3");
    expect(derivePiradsCategory("transition_zone_TZ", "3", "2", "positive")).toBe("3");
    expect(derivePiradsCategory("transition_zone_TZ", "3", "3", "positive")).toBe("3");
    expect(derivePiradsCategory("transition_zone_TZ", "3", "4", "positive")).toBe("3");
  });

  it("t2w=3 + dwi=5 → 4 (DWI upgrade)", () => {
    expect(derivePiradsCategory("transition_zone_TZ", "3", "5", "positive")).toBe("4");
    expect(derivePiradsCategory("transition_zone_TZ", "3", "5", "negative")).toBe("4");
    expect(
      derivePiradsCategory("transition_zone_TZ", "3", "5", "not_performed_bpMRI")
    ).toBe("4");
  });

  it("t2w=4 → 4 regardless of dwi/dce", () => {
    expect(derivePiradsCategory("transition_zone_TZ", "4", "1", "positive")).toBe("4");
    expect(derivePiradsCategory("transition_zone_TZ", "4", "5", undefined)).toBe("4");
  });

  it("t2w=5 → 5 regardless of dwi/dce", () => {
    expect(derivePiradsCategory("transition_zone_TZ", "5", "1", "positive")).toBe("5");
    expect(derivePiradsCategory("transition_zone_TZ", "5", "5", undefined)).toBe("5");
  });

  it("AFMS uses TZ rubric — t2w=3 + dwi=5 → 4", () => {
    expect(
      derivePiradsCategory("anterior_fibromuscular_stroma_AFMS", "3", "5", "positive")
    ).toBe("4");
  });

  it("AFMS uses TZ rubric — t2w=3 + dwi=4 → 3", () => {
    expect(
      derivePiradsCategory("anterior_fibromuscular_stroma_AFMS", "3", "4", "positive")
    ).toBe("3");
  });
});

// ---------------------------------------------------------------------------
// deriveClinicalT
// ---------------------------------------------------------------------------

describe("deriveClinicalT", () => {
  // ----- Step 1: noSuspiciousLesion shortcut --------------------------------
  it("cT1c: noSuspiciousLesion=true short-circuits to cT1c", () => {
    expect(
      deriveClinicalT(
        makeInput({ noSuspiciousLesion: true, lesions: [] })
      )
    ).toBe("cT1c");
  });

  // ----- Step 4: cT3a from per-lesion EPE (grade 3 only) ----------------------
  // Grades 1–2 are risk features, not EPE; they fall through to the cT2
  // heuristic (12 mm unilateral lesion in a 40 mm gland → cT2b).
  it("not cT3a: EPE grade 1 (curvilinear contact or bulge) stays in cT2", () => {
    expect(
      deriveClinicalT(
        makeInput({
          lesions: [
            makeLesion({ epeRiskMehralivand: "1_curvilinear_or_bulge" }),
          ],
        })
      )
    ).toBe("cT2b");
  });

  it("not cT3a: EPE grade 2 (both features) stays in cT2", () => {
    expect(
      deriveClinicalT(
        makeInput({
          lesions: [makeLesion({ epeRiskMehralivand: "2_both_features" })],
        })
      )
    ).toBe("cT2b");
  });

  it("cT3a: any lesion EPE = 3_frank_breach → cT3a", () => {
    expect(
      deriveClinicalT(
        makeInput({
          lesions: [makeLesion({ epeRiskMehralivand: "3_frank_breach" })],
        })
      )
    ).toBe("cT3a");
  });

  // ----- Step 3: cT3b from whole-gland SVI ----------------------------------
  it("cT3b: seminalVesicleInvasionWholeGland !== none → cT3b", () => {
    expect(
      deriveClinicalT(
        makeInput({ seminalVesicleInvasionWholeGland: "right" })
      )
    ).toBe("cT3b");
    expect(
      deriveClinicalT(
        makeInput({ seminalVesicleInvasionWholeGland: "left" })
      )
    ).toBe("cT3b");
    expect(
      deriveClinicalT(
        makeInput({ seminalVesicleInvasionWholeGland: "bilateral" })
      )
    ).toBe("cT3b");
  });

  // ----- Step 2: cT4 from structural invasion -------------------------------
  it("cT4: bladderNeckInvolvement=invasion → cT4", () => {
    expect(
      deriveClinicalT(makeInput({ bladderNeckInvolvement: "invasion" }))
    ).toBe("cT4");
  });

  it("cT4: rectalInvolvement=invasion → cT4", () => {
    expect(
      deriveClinicalT(makeInput({ rectalInvolvement: "invasion" }))
    ).toBe("cT4");
  });

  it("cT4: externalSphincterInvolvement=invasion → cT4", () => {
    expect(
      deriveClinicalT(makeInput({ externalSphincterInvolvement: "invasion" }))
    ).toBe("cT4");
  });

  it("cT4: pelvicSidewallInvolvement=invasion → cT4", () => {
    expect(
      deriveClinicalT(makeInput({ pelvicSidewallInvolvement: "invasion" }))
    ).toBe("cT4");
  });

  // ----- Step 5: MRI cT2 heuristic — cT2c (bilateral) -----------------------
  it("cT2c: any lesion laterality midline_bilateral → cT2c", () => {
    expect(
      deriveClinicalT(
        makeInput({
          lesions: [
            makeLesion({
              laterality: "midline_bilateral",
              sizeMaxAxialMm: 8,
            }),
          ],
        })
      )
    ).toBe("cT2c");
  });

  it("cT2c: lesions span both right and left → cT2c", () => {
    expect(
      deriveClinicalT(
        makeInput({
          lesions: [
            makeLesion({ laterality: "right", sizeMaxAxialMm: 8 }),
            makeLesion({
              lesionIndex: 2,
              laterality: "left",
              sizeMaxAxialMm: 8,
            }),
          ],
        })
      )
    ).toBe("cT2c");
  });

  // ----- Step 5: MRI cT2 heuristic — cT2b (size >= half of one lobe) ---------
  // AJCC cT2a is "one-half of one side or less": half of one lobe is a
  // quarter of the transverse gland width.
  it("cT2b: single unilateral lesion with size = width / 4 (boundary) → cT2b", () => {
    // prostateWidthMm=40 → halfLobeWidth=10; sizeMaxAxialMm=10 hits >= threshold.
    expect(
      deriveClinicalT(
        makeInput({
          prostateWidthMm: 40,
          lesions: [
            makeLesion({ laterality: "right", sizeMaxAxialMm: 10 }),
          ],
        })
      )
    ).toBe("cT2b");
  });

  it("cT2a: single unilateral lesion just under width / 4 → cT2a", () => {
    expect(
      deriveClinicalT(
        makeInput({
          prostateWidthMm: 40,
          lesions: [
            makeLesion({ laterality: "right", sizeMaxAxialMm: 9 }),
          ],
        })
      )
    ).toBe("cT2a");
  });

  it("cT2b: a lesion under half the gland width but over half a lobe → cT2b", () => {
    // 15 mm in a 40 mm gland: cT2a under the old width / 2 rule.
    expect(
      deriveClinicalT(
        makeInput({
          prostateWidthMm: 40,
          lesions: [
            makeLesion({ laterality: "right", sizeMaxAxialMm: 15 }),
          ],
        })
      )
    ).toBe("cT2b");
  });

  it("cT2b: missing prostateWidthMm uses 10 mm fallback threshold", () => {
    expect(
      deriveClinicalT(
        makeInput({
          prostateWidthMm: undefined,
          lesions: [
            makeLesion({ laterality: "right", sizeMaxAxialMm: 10 }),
          ],
        })
      )
    ).toBe("cT2b");
  });

  it("cT2a: missing prostateWidthMm and a lesion under 10 mm → cT2a", () => {
    expect(
      deriveClinicalT(
        makeInput({
          prostateWidthMm: undefined,
          lesions: [
            makeLesion({ laterality: "right", sizeMaxAxialMm: 9 }),
          ],
        })
      )
    ).toBe("cT2a");
  });

  // ----- Step 5: MRI cT2 heuristic — cT2a (default unilateral small) -------
  it("cT2a: single unilateral lesion with size < width / 4 → cT2a", () => {
    expect(
      deriveClinicalT(
        makeInput({
          prostateWidthMm: 40,
          lesions: [
            makeLesion({ laterality: "right", sizeMaxAxialMm: 8 }),
          ],
        })
      )
    ).toBe("cT2a");
  });

  it("cT2a: small left-side lesion → cT2a", () => {
    expect(
      deriveClinicalT(
        makeInput({
          prostateWidthMm: 50,
          lesions: [
            makeLesion({ laterality: "left", sizeMaxAxialMm: 12 }),
          ],
        })
      )
    ).toBe("cT2a");
  });

  // ----- Step 6: cT1c default for empty lesion list (toggle off) ------------
  it("cT1c: lesions empty + noSuspiciousLesion=false (no T3+ evidence) → cT1c", () => {
    expect(deriveClinicalT(makeInput({ lesions: [] }))).toBe("cT1c");
  });

  // ----- Priority cascade ---------------------------------------------------
  it("priority: cT4 dominates cT3b (invasion + SVI both present)", () => {
    expect(
      deriveClinicalT(
        makeInput({
          bladderNeckInvolvement: "invasion",
          seminalVesicleInvasionWholeGland: "bilateral",
        })
      )
    ).toBe("cT4");
  });

  it("priority: cT3b dominates cT3a (SVI + EPE both present)", () => {
    expect(
      deriveClinicalT(
        makeInput({
          seminalVesicleInvasionWholeGland: "right",
          lesions: [
            makeLesion({ epeRiskMehralivand: "3_frank_breach" }),
          ],
        })
      )
    ).toBe("cT3b");
  });

  it("priority: cT3a dominates cT2 heuristic (EPE grade 3 + bilateral lesion)", () => {
    expect(
      deriveClinicalT(
        makeInput({
          lesions: [
            makeLesion({
              laterality: "midline_bilateral",
              epeRiskMehralivand: "3_frank_breach",
              sizeMaxAxialMm: 30,
            }),
          ],
        })
      )
    ).toBe("cT3a");
  });

  it("priority: noSuspiciousLesion=true overrides other lesion-derived evidence", () => {
    // Even if a lesion with EPE positive is somehow present, the toggle pins cT1c.
    expect(
      deriveClinicalT(
        makeInput({
          noSuspiciousLesion: true,
          lesions: [
            makeLesion({ epeRiskMehralivand: "3_frank_breach" }),
          ],
        })
      )
    ).toBe("cT1c");
  });
});

// ---------------------------------------------------------------------------
// deriveClinicalN
// ---------------------------------------------------------------------------

describe("deriveClinicalN", () => {
  it("N0 (default-negative): no nodes entered → N0", () => {
    // Korean clinical workflow convention: prostate MRI always covers the
    // regional nodal stations, so "no node entered" means "no suspicious
    // node found" rather than "indeterminate." NX is reserved for the
    // explicit-override path.
    expect(deriveClinicalN(makeInput())).toBe("N0");
  });

  it("N0 (default-negative): explicit empty arrays for both", () => {
    expect(
      deriveClinicalN(
        makeInput({ regionalLymphNodes: [], nonRegionalLymphNodes: [] })
      )
    ).toBe("N0");
  });

  it("N1: regional with shortAxisMm=10 (≥8 mm criterion)", () => {
    expect(
      deriveClinicalN(
        makeInput({
          regionalLymphNodes: [{ shortAxisMm: 10 }],
        })
      )
    ).toBe("N1");
  });

  it("N1: regional with shortAxisMm exactly 8 → N1", () => {
    expect(
      deriveClinicalN(
        makeInput({
          regionalLymphNodes: [{ shortAxisMm: 8 }],
        })
      )
    ).toBe("N1");
  });

  it("N1: regional with shortAxisMm=5 + suspiciousFeatures=['necrosis']", () => {
    expect(
      deriveClinicalN(
        makeInput({
          regionalLymphNodes: [
            { shortAxisMm: 5, suspiciousFeatures: ["necrosis"] },
          ],
        })
      )
    ).toBe("N1");
  });

  it("N0: regional with shortAxisMm=5 and no suspicious features", () => {
    expect(
      deriveClinicalN(
        makeInput({
          regionalLymphNodes: [{ shortAxisMm: 5 }],
        })
      )
    ).toBe("N0");
  });

  it("N0: regional with empty suspiciousFeatures array", () => {
    expect(
      deriveClinicalN(
        makeInput({
          regionalLymphNodes: [{ shortAxisMm: 5, suspiciousFeatures: [] }],
        })
      )
    ).toBe("N0");
  });
});

// ---------------------------------------------------------------------------
// deriveClinicalM
// ---------------------------------------------------------------------------

describe("deriveClinicalM", () => {
  it("not_assessed: no M1 evidence is not M0 on a pelvic MRI", () => {
    expect(deriveClinicalM(makeInput())).toBe("not_assessed");
  });

  it("M1c: otherDistantMetastasis=lung", () => {
    expect(
      deriveClinicalM(makeInput({ otherDistantMetastasis: "lung" }))
    ).toBe("M1c");
  });

  it("M1c: otherDistantMetastasis=liver", () => {
    expect(
      deriveClinicalM(makeInput({ otherDistantMetastasis: "liver" }))
    ).toBe("M1c");
  });

  it("M1c: otherDistantMetastasis=other", () => {
    expect(
      deriveClinicalM(makeInput({ otherDistantMetastasis: "other" }))
    ).toBe("M1c");
  });

  it("M1b: boneInvolvement=definite", () => {
    expect(
      deriveClinicalM(makeInput({ boneInvolvement: "definite" }))
    ).toBe("M1b");
  });

  it("M1a: nonRegionalLymphNodes has entry", () => {
    expect(
      deriveClinicalM(
        makeInput({ nonRegionalLymphNodes: [{ shortAxisMm: 10 }] })
      )
    ).toBe("M1a");
  });

  it("not_assessed: equivocal bone is described in FINDINGS, not staged", () => {
    expect(
      deriveClinicalM(makeInput({ boneInvolvement: "equivocal" }))
    ).toBe("not_assessed");
  });

  it("priority: visceral metastasis dominates bone definite (M1c)", () => {
    expect(
      deriveClinicalM(
        makeInput({
          otherDistantMetastasis: "lung",
          boneInvolvement: "definite",
        })
      )
    ).toBe("M1c");
  });

  it("priority: bone definite dominates non-regional nodes (M1b)", () => {
    expect(
      deriveClinicalM(
        makeInput({
          boneInvolvement: "definite",
          nonRegionalLymphNodes: [{ shortAxisMm: 10 }],
        })
      )
    ).toBe("M1b");
  });
});

// ---------------------------------------------------------------------------
// deriveProstateVolume — ellipsoid approximation V = W × H × AP × 0.52 / 1000
// ---------------------------------------------------------------------------

describe("deriveProstateVolume", () => {
  it("W=40, H=30, AP=30 → 18.7 mL (40 × 30 × 30 × 0.52 / 1000 = 18.72 → 1 dp)", () => {
    expect(deriveProstateVolume(40, 30, 30)).toBe(18.7);
  });

  it("W=50, H=40, AP=40 → 41.6 mL (typical enlarged prostate)", () => {
    // 50 × 40 × 40 × 0.52 / 1000 = 41.6 exactly
    expect(deriveProstateVolume(50, 40, 40)).toBe(41.6);
  });

  it("W=30, H=25, AP=25 → 9.8 mL (small prostate, 1 dp rounding)", () => {
    // 30 × 25 × 25 × 0.52 / 1000 = 9.75 → 9.8 (Math.round rounds .5 up)
    expect(deriveProstateVolume(30, 25, 25)).toBe(9.8);
  });

  it("returns undefined when any dimension is missing", () => {
    expect(deriveProstateVolume(undefined, 30, 30)).toBeUndefined();
    expect(deriveProstateVolume(40, undefined, 30)).toBeUndefined();
    expect(deriveProstateVolume(40, 30, undefined)).toBeUndefined();
  });

  it("returns undefined when any dimension is zero or negative", () => {
    expect(deriveProstateVolume(0, 30, 30)).toBeUndefined();
    expect(deriveProstateVolume(40, 0, 30)).toBeUndefined();
    expect(deriveProstateVolume(40, 30, 0)).toBeUndefined();
    expect(deriveProstateVolume(-40, 30, 30)).toBeUndefined();
  });

  it("returns undefined when any dimension is NaN", () => {
    expect(deriveProstateVolume(Number.NaN, 30, 30)).toBeUndefined();
    expect(deriveProstateVolume(40, Number.NaN, 30)).toBeUndefined();
    expect(deriveProstateVolume(40, 30, Number.NaN)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// derivePsaDensity
// ---------------------------------------------------------------------------

describe("derivePsaDensity", () => {
  it("psa=8, vol=40 → 0.2", () => {
    expect(derivePsaDensity(8, 40)).toBe(0.2);
  });

  it("psa=10, vol=50 → 0.2", () => {
    expect(derivePsaDensity(10, 50)).toBe(0.2);
  });

  it("rounds to 2 decimal places", () => {
    // 7 / 30 = 0.2333... → 0.23
    expect(derivePsaDensity(7, 30)).toBe(0.23);
    // 7.5 / 30 = 0.25 → 0.25
    expect(derivePsaDensity(7.5, 30)).toBe(0.25);
  });

  it("psa=8, vol=0 → undefined", () => {
    expect(derivePsaDensity(8, 0)).toBeUndefined();
  });

  it("psa=8, vol=-5 → undefined", () => {
    expect(derivePsaDensity(8, -5)).toBeUndefined();
  });

  it("psa=NaN, vol=40 → undefined", () => {
    expect(derivePsaDensity(Number.NaN, 40)).toBeUndefined();
  });

  it("psa=8, vol=NaN → undefined", () => {
    expect(derivePsaDensity(8, Number.NaN)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// deriveEauRiskGroup
// ---------------------------------------------------------------------------

describe("deriveEauRiskGroup", () => {
  it("not_applicable: clinicalIndication=pre_biopsy_initial", () => {
    expect(
      deriveEauRiskGroup(
        makeInput({ clinicalIndication: "pre_biopsy_initial" })
      )
    ).toBe("not_applicable");
  });

  it("not_applicable: clinicalIndication=pre_biopsy_repeat_after_negative", () => {
    expect(
      deriveEauRiskGroup(
        makeInput({
          clinicalIndication: "pre_biopsy_repeat_after_negative",
        })
      )
    ).toBe("not_applicable");
  });

  it("not_applicable: staging indication but ISUP=0 (no positive biopsy)", () => {
    expect(
      deriveEauRiskGroup(
        makeInput({
          clinicalIndication: "staging_after_diagnosis",
          priorBiopsyStatus: "negative",
        })
      )
    ).toBe("not_applicable");
  });

  it("low: PSA=8, ISUP1, empty lesions → cT1c → low", () => {
    // lesions=[] with noSuspiciousLesion=false drives deriveClinicalT to
    // cT1c via the lesion-empty fallback path; deriveEauRiskGroup applies
    // its low-risk gate. (noSuspiciousLesion=true would short-circuit EAU
    // to not_applicable — that path is exercised separately below.)
    expect(
      deriveEauRiskGroup(
        makeInput({
          clinicalIndication: "staging_after_diagnosis",
          psaNgPerMl: 8,
          priorBiopsyStatus: "positive_ISUP1",
          lesions: [],
        })
      )
    ).toBe("low");
  });

  it("not_applicable: noSuspiciousLesion=true overrides EAU stratification", () => {
    expect(
      deriveEauRiskGroup(
        makeInput({
          clinicalIndication: "staging_after_diagnosis",
          psaNgPerMl: 8,
          priorBiopsyStatus: "positive_ISUP1",
          noSuspiciousLesion: true,
          lesions: [],
        })
      )
    ).toBe("not_applicable");
  });

  it("low: PSA=8, ISUP1, single small unilateral lesion → cT2a (MRI heuristic) → low", () => {
    expect(
      deriveEauRiskGroup(
        makeInput({
          clinicalIndication: "staging_after_diagnosis",
          psaNgPerMl: 8,
          priorBiopsyStatus: "positive_ISUP1",
          prostateWidthMm: 40,
          lesions: [
            makeLesion({ laterality: "right", sizeMaxAxialMm: 8 }),
          ],
        })
      )
    ).toBe("low");
  });

  it("high: PSA=25, ISUP1, cT1c → high (PSA>20)", () => {
    expect(
      deriveEauRiskGroup(
        makeInput({
          clinicalIndication: "staging_after_diagnosis",
          psaNgPerMl: 25,
          priorBiopsyStatus: "positive_ISUP1",
        })
      )
    ).toBe("high");
  });

  it("high: PSA=8, ISUP4, cT1c → high (ISUP)", () => {
    expect(
      deriveEauRiskGroup(
        makeInput({
          clinicalIndication: "staging_after_diagnosis",
          psaNgPerMl: 8,
          priorBiopsyStatus: "positive_ISUP4",
        })
      )
    ).toBe("high");
  });

  it("high: PSA=8, ISUP1, cT3a (lesion EPE positive) → high (T-stage)", () => {
    expect(
      deriveEauRiskGroup(
        makeInput({
          clinicalIndication: "staging_after_diagnosis",
          psaNgPerMl: 8,
          priorBiopsyStatus: "positive_ISUP1",
          lesions: [
            makeLesion({ epeRiskMehralivand: "3_frank_breach" }),
          ],
        })
      )
    ).toBe("high");
  });

  it("high: PSA=8, ISUP1, cT2a but cN1 → high (locally advanced)", () => {
    expect(
      deriveEauRiskGroup(
        makeInput({
          clinicalIndication: "staging_after_diagnosis",
          psaNgPerMl: 8,
          priorBiopsyStatus: "positive_ISUP1",
          lesions: [makeLesion({ sizeMaxAxialMm: 8 })],
          regionalLymphNodes: [{ shortAxisMm: 10 }],
        })
      )
    ).toBe("high");
  });

  it("low: the same case with no suspicious node stays low", () => {
    expect(
      deriveEauRiskGroup(
        makeInput({
          clinicalIndication: "staging_after_diagnosis",
          psaNgPerMl: 8,
          priorBiopsyStatus: "positive_ISUP1",
          lesions: [makeLesion({ sizeMaxAxialMm: 8 })],
        })
      )
    ).toBe("low");
  });

  it("high: ISUP5 always high regardless of other factors", () => {
    expect(
      deriveEauRiskGroup(
        makeInput({
          clinicalIndication: "staging_after_diagnosis",
          psaNgPerMl: 5,
          priorBiopsyStatus: "positive_ISUP5",
        })
      )
    ).toBe("high");
  });

  it("intermediate_favourable: PSA=15, ISUP1, cT1c → 1 factor only", () => {
    expect(
      deriveEauRiskGroup(
        makeInput({
          clinicalIndication: "staging_after_diagnosis",
          psaNgPerMl: 15,
          priorBiopsyStatus: "positive_ISUP1",
          lesions: [],
        })
      )
    ).toBe("intermediate_favourable");
  });

  it("intermediate_unfavourable: PSA=15, ISUP3, cT1c → 2 factors", () => {
    expect(
      deriveEauRiskGroup(
        makeInput({
          clinicalIndication: "staging_after_diagnosis",
          psaNgPerMl: 15,
          priorBiopsyStatus: "positive_ISUP3",
          lesions: [],
        })
      )
    ).toBe("intermediate_unfavourable");
  });

  it("intermediate_unfavourable: PSA=8, ISUP2, cT2c (bilateral lesions) → 2 factors", () => {
    expect(
      deriveEauRiskGroup(
        makeInput({
          clinicalIndication: "staging_after_diagnosis",
          psaNgPerMl: 8,
          priorBiopsyStatus: "positive_ISUP2",
          lesions: [
            makeLesion({ laterality: "right", sizeMaxAxialMm: 8 }),
            makeLesion({
              lesionIndex: 2,
              laterality: "left",
              sizeMaxAxialMm: 8,
            }),
          ],
        })
      )
    ).toBe("intermediate_unfavourable");
  });

  it("intermediate_favourable: PSA=8, ISUP2, cT1c → 1 factor (ISUP only)", () => {
    expect(
      deriveEauRiskGroup(
        makeInput({
          clinicalIndication: "staging_after_diagnosis",
          psaNgPerMl: 8,
          priorBiopsyStatus: "positive_ISUP2",
          lesions: [],
        })
      )
    ).toBe("intermediate_favourable");
  });
});

// ---------------------------------------------------------------------------
// serializeProstateStructuredInput
// ---------------------------------------------------------------------------

describe("serializeProstateStructuredInput — skip-empty (RCC parity, N-4)", () => {
  it("skips fields with undefined values", () => {
    const result = serializeProstateStructuredInput(makeInput());
    // patientAgeYears is undefined in makeInput → must NOT appear.
    expect(result).not.toContain("Patient age");
    expect(result).not.toContain("Prior MRI date");
    expect(result).not.toContain("PSA date offset");
    expect(result).not.toContain("Prior biopsy date");
  });

  it("skips empty-string fields", () => {
    const result = serializeProstateStructuredInput(
      makeInput({ additionalClinicalNotes: "   " })
    );
    expect(result).not.toContain("Additional clinical notes");
  });

  it("emits values when present", () => {
    const result = serializeProstateStructuredInput(
      makeInput({
        patientAgeYears: 67,
        priorMRIDate: "2024-01-15",
        psaDateOffsetDays: -7,
        priorBiopsyDate: "2024-03-01",
        additionalClinicalNotes: "Anti-androgen therapy started 2024-02",
      })
    );
    expect(result).toContain("- Patient age: 67");
    expect(result).toContain("- Prior MRI date: 2024-01-15");
    expect(result).toContain("- PSA date offset (days from study): -7");
    expect(result).toContain("- Prior biopsy date: 2024-03-01");
    expect(result).toContain(
      "- Additional clinical notes: Anti-androgen therapy started 2024-02"
    );
  });
});

describe("serializeProstateStructuredInput — required fields verbatim", () => {
  it("emits all section headers in canonical order", () => {
    const result = serializeProstateStructuredInput(makeInput());
    const idxClinical = result.indexOf("CLINICAL CONTEXT");
    const idxLesion = result.indexOf("LESION 1");
    const idxStaging = result.indexOf("WHOLE-GLAND & STAGING");
    expect(idxClinical).toBeGreaterThanOrEqual(0);
    expect(idxLesion).toBeGreaterThan(idxClinical);
    expect(idxStaging).toBeGreaterThan(idxLesion);
  });

  it("emits LESION N headers for each lesion in order", () => {
    const result = serializeProstateStructuredInput(
      makeInput({
        lesions: [
          makeLesion({ lesionIndex: 1 }),
          makeLesion({ lesionIndex: 2, sectorMapLocation: ["L-base-PZpl"] }),
          makeLesion({ lesionIndex: 3, sectorMapLocation: ["AFMS-mid"] }),
        ],
      })
    );
    expect(result).toContain("LESION 1");
    expect(result).toContain("LESION 2");
    expect(result).toContain("LESION 3");
    const i1 = result.indexOf("LESION 1");
    const i2 = result.indexOf("LESION 2");
    const i3 = result.indexOf("LESION 3");
    expect(i2).toBeGreaterThan(i1);
    expect(i3).toBeGreaterThan(i2);
  });

  it("emits PSA with ng/mL unit", () => {
    expect(serializeProstateStructuredInput(makeInput({ psaNgPerMl: 6.5 }))).toContain(
      "- PSA: 6.5 ng/mL"
    );
  });

  it("emits prostate volume with mL unit", () => {
    expect(
      serializeProstateStructuredInput(makeInput({ prostateVolumeMl: 55 }))
    ).toContain("- Prostate volume: 55 mL");
  });

  it("emits PSA density when both PSA and volume present", () => {
    expect(
      serializeProstateStructuredInput(
        makeInput({ psaNgPerMl: 8, prostateVolumeMl: 40 })
      )
    ).toContain("- PSA density: 0.20 ng/mL/cc");
  });

  it("emits sector map location as comma-separated list", () => {
    const result = serializeProstateStructuredInput(
      makeInput({
        lesions: [
          makeLesion({
            sectorMapLocation: ["R-mid-PZpl", "R-mid-PZpm"],
          }),
        ],
      })
    );
    expect(result).toContain("- Sector map location: R-mid-PZpl, R-mid-PZpm");
  });

  it("emits derived clinical T/N/M when not overridden", () => {
    // makeInput() seeds a single right-side lesion of 12 mm against a 40 mm
    // prostate width — the MRI-based heuristic discriminates this as cT2b
    // (unilateral, size >= halfLobeWidth=10). N defaults to N0: empty
    // lymph node arrays are treated as a deliberate negative assessment
    // (Korean clinical-workflow convention), and no metastasis declared.
    const result = serializeProstateStructuredInput(makeInput());
    expect(result).toContain("- Clinical T: cT2b");
    expect(result).toContain("- Clinical N: N0");
    expect(result).toContain("- Clinical M: not assessed on pelvic MRI");
    expect(result).not.toContain("- Staging overridden:");
  });

  it("suppresses Clinical T/N/M and emits explicit not-applicable marker when noSuspiciousLesion=true and no override", () => {
    // AJCC TNM presupposes confirmed disease. A negative MRI without an
    // explicit clinician override yields no measurable disease, so the
    // serializer omits the cT/cN/cM lines and instead emits an explicit
    // "AJCC TNM staging: not applicable on negative MRI" marker plus an
    // "EAU risk group: not_applicable" line. The downstream prompt uses
    // these markers to render "Not applicable — negative MRI." in STAGING
    // and to suppress any cT1c/N0/M0 fabrication in IMPRESSION.
    const result = serializeProstateStructuredInput(
      makeInput({ noSuspiciousLesion: true, lesions: [] })
    );
    expect(result).toContain(
      "- No suspicious lesion: yes (PI-RADS ≤ 2 negative MRI)"
    );
    expect(result).not.toContain("LESION 1");
    expect(result).not.toContain("- Clinical T:");
    expect(result).not.toContain("- Clinical N:");
    expect(result).not.toContain("- Clinical M:");
    expect(result).toContain(
      "- AJCC TNM staging: not applicable on negative MRI (no measurable disease)"
    );
    expect(result).toContain("- EAU risk group: not applicable");
  });

  it("honours isStagingOverridden=true even on a negative MRI", () => {
    // Use case: staging_after_diagnosis patient with biopsy-proven ISUP 2
    // disease that is invisible on the current MRI; the radiologist supplies
    // cT2a manually. The override path always wins.
    const result = serializeProstateStructuredInput(
      makeInput({
        noSuspiciousLesion: true,
        lesions: [],
        isStagingOverridden: true,
        clinicalT: "cT2a",
        clinicalN: "N0",
        clinicalM: "M0",
        clinicalIndication: "staging_after_diagnosis",
        priorBiopsyStatus: "positive_ISUP2",
      })
    );
    expect(result).toContain("- Clinical T: cT2a");
    expect(result).toContain("- Clinical N: N0");
    expect(result).toContain("- Clinical M: M0");
    expect(result).toContain("- Staging overridden: yes");
    // EAU is still emitted because the override path is active.
    expect(result).toContain("- EAU risk group:");
  });

  it("emits override clinical T/N/M when isStagingOverridden=true", () => {
    const result = serializeProstateStructuredInput(
      makeInput({
        isStagingOverridden: true,
        clinicalT: "cT3a",
        clinicalN: "N1",
        clinicalM: "M1b",
      })
    );
    expect(result).toContain("- Clinical T: cT3a");
    expect(result).toContain("- Clinical N: N1");
    expect(result).toContain("- Clinical M: M1b");
    expect(result).toContain("- Staging overridden: yes");
  });

  it("emits regional and non-regional lymph nodes as nested lists", () => {
    const result = serializeProstateStructuredInput(
      makeInput({
        regionalLymphNodes: [
          {
            station: "obturator",
            shortAxisMm: 10,
            morphology: "round",
            suspiciousFeatures: ["necrosis"],
          },
          { station: "internal_iliac", shortAxisMm: 6 },
        ],
        nonRegionalLymphNodes: [
          { location: "retroperitoneal", shortAxisMm: 15 },
        ],
      })
    );
    expect(result).toContain("- Regional lymph nodes:");
    expect(result).toContain("  - Node 1: obturator");
    expect(result).toContain("short axis 10 mm");
    expect(result).toContain("morphology round");
    expect(result).toContain("features: necrosis");
    expect(result).toContain("  - Node 2: internal iliac");
    expect(result).toContain("- Non-regional lymph nodes:");
    expect(result).toContain("  - Node 1: retroperitoneal");
  });

  it("emits PI-QUAL subscores", () => {
    const result = serializeProstateStructuredInput(
      makeInput({
        piQualOverall: "2_acceptable",
        piQualT2WSubscore: "3",
        piQualDWISubscore: "4",
        piQualDCESubscore: "+",
      })
    );
    expect(result).toContain("- PI-QUAL overall: PI-QUAL 2 — acceptable");
    expect(result).toContain("- PI-QUAL T2W subscore: 3");
    expect(result).toContain("- PI-QUAL DWI subscore: 4");
    expect(result).toContain("- PI-QUAL DCE subscore: +");
  });

  it("emits target for biopsy as yes/no", () => {
    const yesResult = serializeProstateStructuredInput(
      makeInput({ lesions: [makeLesion({ targetForBiopsy: true })] })
    );
    expect(yesResult).toContain("- Target for biopsy: yes");

    const noResult = serializeProstateStructuredInput(
      makeInput({ lesions: [makeLesion({ targetForBiopsy: false })] })
    );
    expect(noResult).toContain("- Target for biopsy: no");
  });

  // -------------------------------------------------------------------------
  // Negative-MRI sweep consolidation (regression guard for the
  // "report is too long on negative MRI" fix). When noSuspiciousLesion=true
  // and every whole-gland / nodal / distant category is "none"/empty, the
  // eight per-category bullets are collapsed into a single sweep line so
  // the downstream LLM cannot inflate the FINDINGS section with one
  // unremarkable paragraph per structure.
  // -------------------------------------------------------------------------
  describe("negative-MRI whole-gland sweep consolidation", () => {
    it("collapses every all-none category into a single sweep bullet", () => {
      const result = serializeProstateStructuredInput(
        makeInput({
          noSuspiciousLesion: true,
          lesions: [],
          // all defaults below are "none" via createEmptyProstateInput()
        })
      );
      expect(result).toContain(
        "- Whole-gland and nodal sweep: no abnormality in seminal vesicles, bladder neck, external sphincter, rectum, pelvic sidewall, lymph nodes, bones within the imaged field."
      );
      // Each per-category bullet that the positive-MRI path emits MUST be
      // absent — that is the whole point of consolidation.
      expect(result).not.toContain("- Seminal vesicle invasion (whole gland):");
      expect(result).not.toContain("- Bladder neck involvement:");
      expect(result).not.toContain("- External sphincter involvement:");
      expect(result).not.toContain("- Rectal involvement:");
      expect(result).not.toContain("- Pelvic sidewall involvement:");
      expect(result).not.toContain("- Lymph nodes: no suspicious lymph node");
      expect(result).not.toContain("- Bone involvement:");
      expect(result).not.toContain("- Other distant metastasis:");
    });

    it("keeps a non-'none' SVI as its own bullet and drops it from the sweep", () => {
      const result = serializeProstateStructuredInput(
        makeInput({
          noSuspiciousLesion: true,
          lesions: [],
          seminalVesicleInvasionWholeGland: "right",
        })
      );
      // Abnormal category survives as its own bullet…
      expect(result).toContain(
        "- Seminal vesicle invasion (whole gland): right"
      );
      // …and the sweep no longer mentions seminal vesicles.
      expect(result).toMatch(/- Whole-gland and nodal sweep: no abnormality in /);
      expect(result).not.toMatch(
        /- Whole-gland and nodal sweep: no abnormality in[^\n]*seminal vesicles/
      );
    });

    it("keeps incidental regional lymph nodes as discrete bullets on a negative MRI", () => {
      const result = serializeProstateStructuredInput(
        makeInput({
          noSuspiciousLesion: true,
          lesions: [],
          regionalLymphNodes: [
            { station: "obturator", shortAxisMm: 12, morphology: "round" },
          ],
        })
      );
      expect(result).toContain("- Regional lymph nodes:");
      expect(result).toContain("  - Node 1: obturator");
      // Sweep no longer mentions lymph nodes when one is present.
      expect(result).not.toMatch(
        /- Whole-gland and nodal sweep: no abnormality in[^\n]*lymph nodes/
      );
    });

    it("does NOT emit the sweep bullet on a positive MRI", () => {
      // makeInput() defaults to noSuspiciousLesion=false with one lesion.
      const result = serializeProstateStructuredInput(makeInput());
      expect(result).not.toContain("- Whole-gland and nodal sweep:");
      // Positive-MRI path keeps every per-category bullet.
      expect(result).toContain("- Seminal vesicle invasion (whole gland):");
      expect(result).toContain("- Bladder neck involvement:");
      expect(result).toContain(
        "- Bone: no suspicious bone lesion within the imaged field"
      );
    });
  });

  describe("negatives limited to the imaged field", () => {
    it("limits node and bone negatives to the imaged field", () => {
      const result = serializeProstateStructuredInput(makeInput());
      expect(result).toContain(
        "- Lymph nodes: no suspicious lymph node within the imaged field (clinical N0)"
      );
      expect(result).toContain(
        "- Bone: no suspicious bone lesion within the imaged field"
      );
    });

    it("says nothing about organs outside the pelvis when none is recorded", () => {
      expect(serializeProstateStructuredInput(makeInput())).not.toContain(
        "Other distant metastasis"
      );
      expect(
        serializeProstateStructuredInput(
          makeInput({ noSuspiciousLesion: true, lesions: [] })
        )
      ).not.toMatch(/distant/);
    });

    it("still reports a recorded distant finding", () => {
      expect(
        serializeProstateStructuredInput(
          makeInput({ otherDistantMetastasis: "liver" })
        )
      ).toContain("- Other distant metastasis: liver");
      expect(
        serializeProstateStructuredInput(
          makeInput({
            noSuspiciousLesion: true,
            lesions: [],
            otherDistantMetastasis: "liver",
          })
        )
      ).toContain("- Other distant metastasis: liver");
    });

    it("keeps an equivocal bone finding as its own bullet", () => {
      expect(
        serializeProstateStructuredInput(makeInput({ boneInvolvement: "equivocal" }))
      ).toContain("- Bone involvement: equivocal");
    });
  });

  it("emits override justification when isPiradsOverridden=true", () => {
    const result = serializeProstateStructuredInput(
      makeInput({
        lesions: [
          makeLesion({
            overallPiradsCategory: "5",
            isPiradsOverridden: true,
            overallPiradsOverrideJustification:
              "Frank ECE on T2W warrants upgrade",
          }),
        ],
      })
    );
    expect(result).toContain("- Overall PI-RADS overridden: yes");
    expect(result).toContain(
      "- Override justification: Frank ECE on T2W warrants upgrade"
    );
  });
});

describe("serializeProstateStructuredInput — Section 4 verbatim round-trip", () => {
  it("omits OTHER FINDINGS block when all three free-text fields are absent", () => {
    expect(serializeProstateStructuredInput(makeInput())).not.toContain(
      "OTHER FINDINGS"
    );
  });

  it("emits incidentalFindings verbatim under OTHER FINDINGS", () => {
    const text = "Adrenal incidentaloma, 1.2 cm right";
    const result = serializeProstateStructuredInput(
      makeInput({ incidentalFindings: text })
    );
    expect(result).toContain("OTHER FINDINGS");
    expect(result).toContain("Incidental findings:");
    expect(result).toContain(text);
  });

  it("preserves multi-line incidentalFindings verbatim (RCC parity)", () => {
    const text = "Line one observation.\nLine two observation.\nLine three.";
    const result = serializeProstateStructuredInput(
      makeInput({ incidentalFindings: text })
    );
    // The exact multi-line block (with newlines preserved) must appear.
    expect(result).toContain(text);
  });

  it("emits all three free-text blocks when all populated", () => {
    const result = serializeProstateStructuredInput(
      makeInput({
        incidentalFindings: "Adrenal nodule.",
        bonyAbnormalities: "Vertebral degeneration L4-L5.",
        recommendations: "Targeted biopsy of PI-RADS 4 lesion.",
      })
    );
    expect(result).toContain("Incidental findings:");
    expect(result).toContain("Adrenal nodule.");
    expect(result).toContain("Bony abnormalities:");
    expect(result).toContain("Vertebral degeneration L4-L5.");
    expect(result).toContain("Recommendations:");
    expect(result).toContain("Targeted biopsy of PI-RADS 4 lesion.");
  });

  it("skips a free-text field when only it is absent (others emit)", () => {
    const result = serializeProstateStructuredInput(
      makeInput({
        incidentalFindings: "Adrenal nodule.",
        bonyAbnormalities: "",
        recommendations: undefined,
      })
    );
    expect(result).toContain("Incidental findings:");
    expect(result).not.toContain("Bony abnormalities:");
    expect(result).not.toContain("Recommendations:");
  });
});

describe("serializeProstateStructuredInput — determinism and snapshot", () => {
  it("output is deterministic for the same input", () => {
    const a = serializeProstateStructuredInput(makeInput());
    const b = serializeProstateStructuredInput(makeInput());
    expect(a).toBe(b);
  });

  it("matches a representative full-input snapshot", () => {
    const input: ProstateStructuredInput = makeInput({
      studyDate: "2026-04-27",
      patientAgeYears: 67,
      clinicalIndication: "staging_after_diagnosis",
      psaNgPerMl: 12.5,
      psaDateOffsetDays: -3,
      priorBiopsyStatus: "positive_ISUP2",
      priorBiopsyDate: "2026-04-10",
      additionalClinicalNotes: "On 5-ARI for 6 months.",
      lesions: [
        makeLesion({
          lesionIndex: 1,
          zone: "peripheral_zone_PZ",
          sectorMapLocation: ["R-mid-PZpl", "R-mid-PZpm"],
          craniocaudalLevel: "mid_gland",
          laterality: "right",
          sizeMaxAxialMm: 14,
          sizeOrthogonalAxialMm: 12,
          sizeCraniocaudalMm: 13,
          t2wScore: "4",
          dwiScore: "4",
          dceResult: "positive",
          overallPiradsCategory: "4",
          isPiradsOverridden: false,
          adcMeanValue: 750,
          epeRiskMehralivand: "1_curvilinear_or_bulge",
          neurovascularBundleInvolvement: "abutment",
          targetForBiopsy: true,
        }),
      ],
      prostateVolumeMl: 50,
      seminalVesicleInvasionWholeGland: "none",
      bladderNeckInvolvement: "none",
      externalSphincterInvolvement: "none",
      rectalInvolvement: "none",
      pelvicSidewallInvolvement: "none",
      regionalLymphNodes: [
        {
          station: "obturator",
          shortAxisMm: 9,
          morphology: "round",
          suspiciousFeatures: ["necrosis"],
        },
      ],
      boneInvolvement: "none",
      otherDistantMetastasis: "none",
      piQualOverall: "3_optimal",
      piQualT2WSubscore: "4",
      piQualDWISubscore: "4",
      piQualDCESubscore: "+",
      incidentalFindings: "Right inguinal hernia.",
      recommendations: "Targeted biopsy of right mid PZ lesion.",
    });

    const result = serializeProstateStructuredInput(input);

    // Top-level structure
    expect(result).toContain("CLINICAL CONTEXT");
    expect(result).toContain("LESION 1");
    expect(result).toContain("WHOLE-GLAND & STAGING");
    expect(result).toContain("OTHER FINDINGS");

    // Clinical context selected fields
    expect(result).toContain("- Study date: 2026-04-27");
    expect(result).toContain("- Patient age: 67");
    expect(result).toContain(
      "- Clinical indication: staging MRI after biopsy-confirmed diagnosis"
    );
    expect(result).toContain("- PSA: 12.5 ng/mL");
    expect(result).toContain("- PSA density: 0.25 ng/mL/cc");

    // Lesion content
    expect(result).toContain("- Zone: peripheral zone (PZ)");
    expect(result).toContain("- Sector map location: R-mid-PZpl, R-mid-PZpm");
    expect(result).toContain("- Size (max axial): 14 mm");
    expect(result).toContain("- Size (orthogonal axial): 12 mm");
    expect(result).toContain("- T2W score: 4");
    expect(result).toContain("- DWI score: 4");
    expect(result).toContain("- DCE result: positive");
    expect(result).toContain("- Overall PI-RADS category: 4");
    expect(result).toContain("- ADC mean value: 750 ×10⁻⁶ mm²/s");
    expect(result).toContain(
      "- EPE risk (Mehralivand): Mehralivand grade 1 (curvilinear contact or capsular bulge)"
    );

    // Staging — derived. EPE grade 1 is not cT3a; the 14 mm unilateral
    // lesion exceeds half a lobe (40 / 4 = 10 mm) → cT2b. The suspicious
    // obturator node makes it cN1, which EAU groups as high risk.
    expect(result).toContain("- Clinical T: cT2b");
    expect(result).toContain("- Clinical N: N1");
    expect(result).toContain("- EAU risk group: high");

    // Section 4 verbatim
    expect(result).toContain("Right inguinal hernia.");
    expect(result).toContain("Targeted biopsy of right mid PZ lesion.");
    expect(result).not.toContain("Bony abnormalities:");
  });
});

describe("deriveMriProtocol", () => {
  it("bpMRI when no lesion has a DCE result and PI-QUAL DCE is unrated", () => {
    expect(deriveMriProtocol(makeInput())).toBe("bpMRI");
  });

  it("bpMRI when every lesion is not_performed_bpMRI", () => {
    expect(
      deriveMriProtocol(
        makeInput({ lesions: [makeLesion({ dceResult: "not_performed_bpMRI" })] })
      )
    ).toBe("bpMRI");
  });

  it("bpMRI when PI-QUAL DCE is not_applicable", () => {
    expect(
      deriveMriProtocol(makeInput({ piQualDCESubscore: "not_applicable" }))
    ).toBe("bpMRI");
  });

  it.each(["positive", "negative"] as const)(
    "mpMRI when a lesion DCE result is %s",
    (dceResult) => {
      expect(
        deriveMriProtocol(makeInput({ lesions: [makeLesion({ dceResult })] }))
      ).toBe("mpMRI");
    }
  );

  it.each(["+", "-"] as const)(
    "mpMRI on a negative MRI when PI-QUAL DCE is rated %s",
    (piQualDCESubscore) => {
      expect(
        deriveMriProtocol(
          makeInput({ noSuspiciousLesion: true, lesions: [], piQualDCESubscore })
        )
      ).toBe("mpMRI");
    }
  );

  it("mpMRI when any one lesion has DCE, even if another says not performed", () => {
    expect(
      deriveMriProtocol(
        makeInput({
          lesions: [
            makeLesion({ dceResult: "not_performed_bpMRI" }),
            makeLesion({ lesionIndex: 2, dceResult: "negative" }),
          ],
        })
      )
    ).toBe("mpMRI");
  });
});

describe("serializeProstateStructuredInput — TECHNIQUE block and single placement", () => {
  it("emits a TECHNIQUE block after CLINICAL CONTEXT, before the lesions", () => {
    const out = serializeProstateStructuredInput(makeInput());
    const clinical = out.indexOf("CLINICAL CONTEXT");
    const technique = out.indexOf("TECHNIQUE\n");
    const lesion = out.indexOf("LESION 1");
    expect(clinical).toBeLessThan(technique);
    expect(technique).toBeLessThan(lesion);
  });

  it("states bpMRI and drops every DCE line on a bpMRI study", () => {
    const out = serializeProstateStructuredInput(
      makeInput({
        lesions: [makeLesion({ dceResult: "not_performed_bpMRI" })],
        piQualDCESubscore: "not_applicable",
      })
    );
    expect(out).toContain(
      "- MRI protocol: biparametric MRI (bpMRI) — T2W and DWI/ADC; DCE not performed"
    );
    expect(out).not.toContain("- DCE result:");
    expect(out).not.toContain("- PI-QUAL DCE subscore:");
    expect(out).not.toMatch(/multiparametric/);
  });

  it("states mpMRI and keeps DCE lines on an mpMRI study", () => {
    const out = serializeProstateStructuredInput(
      makeInput({
        lesions: [makeLesion({ dceResult: "positive" })],
        piQualDCESubscore: "+",
      })
    );
    expect(out).toContain(
      "- MRI protocol: multiparametric MRI (mpMRI) — T2W, DWI/ADC and DCE"
    );
    expect(out).toContain("- DCE result: positive");
    expect(out).toContain("- PI-QUAL DCE subscore: +");
  });

  it("puts PI-QUAL in the TECHNIQUE block only", () => {
    const out = serializeProstateStructuredInput(makeInput());
    const technique = out.slice(out.indexOf("TECHNIQUE\n"), out.indexOf("LESION 1"));
    expect(technique).toContain("- PI-QUAL overall:");
    expect(out.match(/PI-QUAL overall/g)).toHaveLength(1);
  });

  it("emits PSA density once, right after the prostate volume", () => {
    const out = serializeProstateStructuredInput(
      makeInput({ psaNgPerMl: 8, prostateVolumeMl: 40 })
    );
    expect(out.match(/PSA density/g)).toHaveLength(1);
    expect(out).toContain("- Prostate volume: 40 mL\n- PSA density: 0.20 ng/mL/cc");
    const clinical = out.slice(0, out.indexOf("TECHNIQUE\n"));
    expect(clinical).not.toContain("PSA density");
  });
});

describe("resolveStaging", () => {
  it("returns the derived T/N/M when not overridden, ignoring stored values", () => {
    // The form keeps clinicalT/N/M synced to the derivation; a stale stored
    // value must not leak through while the override is off.
    expect(
      resolveStaging(
        makeInput({ clinicalT: "cT4", clinicalN: "N1", clinicalM: "M1b" })
      )
    ).toEqual({ cT: "cT2b", cN: "N0", cM: "not_assessed" });
  });

  it("returns the override values when isStagingOverridden=true", () => {
    expect(
      resolveStaging(
        makeInput({
          isStagingOverridden: true,
          clinicalT: "cT3a",
          clinicalN: "N1",
          clinicalM: "M1a",
        })
      )
    ).toEqual({ cT: "cT3a", cN: "N1", cM: "M1a" });
  });

  it("falls back per category when an override value is missing", () => {
    expect(
      resolveStaging(makeInput({ isStagingOverridden: true, clinicalT: "cT3a" }))
    ).toEqual({ cT: "cT3a", cN: "N0", cM: "not_assessed" });
  });
});

describe("deriveEauRiskGroup — metastatic disease and staging overrides", () => {
  // ISUP 1, PSA 8, 8 mm unilateral lesion in a 40 mm gland → cT2a → low.
  const lowRisk = {
    clinicalIndication: "staging_after_diagnosis" as const,
    psaNgPerMl: 8,
    priorBiopsyStatus: "positive_ISUP1" as const,
    lesions: [makeLesion({ sizeMaxAxialMm: 8 })],
  };

  it("baseline: the low-risk fixture is low", () => {
    expect(deriveEauRiskGroup(makeInput(lowRisk))).toBe("low");
  });

  it.each([
    ["M1a", { nonRegionalLymphNodes: [{ shortAxisMm: 12 }] }],
    ["M1b", { boneInvolvement: "definite" as const }],
    ["M1c", { otherDistantMetastasis: "liver" as const }],
  ])("metastatic: derived %s", (_m, extra) => {
    expect(deriveEauRiskGroup(makeInput({ ...lowRisk, ...extra }))).toBe(
      "metastatic"
    );
  });

  it("metastatic takes precedence over high-risk gates", () => {
    expect(
      deriveEauRiskGroup(
        makeInput({
          ...lowRisk,
          psaNgPerMl: 30,
          priorBiopsyStatus: "positive_ISUP5",
          boneInvolvement: "definite",
        })
      )
    ).toBe("metastatic");
  });

  it("equivocal bone (cM not assessed) is not metastatic", () => {
    expect(
      deriveEauRiskGroup(makeInput({ ...lowRisk, boneInvolvement: "equivocal" }))
    ).toBe("low");
  });

  it("honours an overridden cT", () => {
    expect(
      deriveEauRiskGroup(
        makeInput({ ...lowRisk, isStagingOverridden: true, clinicalT: "cT3a" })
      )
    ).toBe("high");
  });

  it("honours an overridden cN", () => {
    expect(
      deriveEauRiskGroup(
        makeInput({ ...lowRisk, isStagingOverridden: true, clinicalN: "N1" })
      )
    ).toBe("high");
  });

  it("honours an overridden cM", () => {
    expect(
      deriveEauRiskGroup(
        makeInput({ ...lowRisk, isStagingOverridden: true, clinicalM: "M1b" })
      )
    ).toBe("metastatic");
  });

  it("an override can lower the derived stage", () => {
    expect(
      deriveEauRiskGroup(
        makeInput({
          ...lowRisk,
          lesions: [makeLesion({ epeRiskMehralivand: "3_frank_breach", sizeMaxAxialMm: 8 })],
          isStagingOverridden: true,
          clinicalT: "cT2a",
        })
      )
    ).toBe("low");
  });

  it("negative MRI with an override is stratified from the override", () => {
    expect(
      deriveEauRiskGroup(
        makeInput({
          ...lowRisk,
          priorBiopsyStatus: "positive_ISUP2",
          noSuspiciousLesion: true,
          lesions: [],
          isStagingOverridden: true,
          clinicalT: "cT1c",
          clinicalN: "N0",
          clinicalM: "M0",
        })
      )
    ).toBe("intermediate_favourable");
  });

  it("negative MRI without an override stays not applicable", () => {
    expect(
      deriveEauRiskGroup(
        makeInput({ ...lowRisk, noSuspiciousLesion: true, lesions: [] })
      )
    ).toBe("not_applicable");
  });

  it("serializes the metastatic group as readable prose", () => {
    expect(
      serializeProstateStructuredInput(
        makeInput({ ...lowRisk, boneInvolvement: "definite" })
      )
    ).toContain(
      "- EAU risk group: metastatic disease (cM1) — localised risk groups not applicable"
    );
  });
});
