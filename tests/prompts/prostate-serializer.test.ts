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
 *  - serializeProstateStructuredInput (skip-empty + verbatim Section-4 RCC parity)
 */

import { describe, it, expect } from "vitest";
import {
  derivePiradsCategory,
  deriveClinicalT,
  deriveClinicalN,
  deriveClinicalM,
  derivePsaDensity,
  deriveEauRiskGroup,
  hasMinimumProstateFields,
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
    seminalVesicleInvasionSuspicion: "none",
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
    lesions: [makeLesion()],
    prostateVolumeMl: 40,
    capsuleIntegrity: "intact",
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

  it("returns false when lesions array is empty", () => {
    expect(hasMinimumProstateFields(makeInput({ lesions: [] }))).toBe(false);
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
  it("cT1c: empty findings + DRE not_performed → cT1c", () => {
    expect(
      deriveClinicalT(makeInput({ digitalRectalExam: "not_performed" }))
    ).toBe("cT1c");
  });

  it("cT1c: empty findings + DRE undefined → cT1c (palpation rule, N-1)", () => {
    expect(
      deriveClinicalT(makeInput({ digitalRectalExam: undefined }))
    ).toBe("cT1c");
  });

  it("cT1c: empty findings + DRE normal_T1c → cT1c", () => {
    expect(
      deriveClinicalT(makeInput({ digitalRectalExam: "normal_T1c" }))
    ).toBe("cT1c");
  });

  it("cT2a: DRE palpable_unilateral_T2a_b + no MRI T3+ → cT2a", () => {
    expect(
      deriveClinicalT(
        makeInput({ digitalRectalExam: "palpable_unilateral_T2a_b" })
      )
    ).toBe("cT2a");
  });

  it("cT2c: DRE palpable_bilateral_T2c + no MRI T3+ → cT2c", () => {
    expect(
      deriveClinicalT(
        makeInput({ digitalRectalExam: "palpable_bilateral_T2c" })
      )
    ).toBe("cT2c");
  });

  it("cT3a: any lesion EPE = 1_curvilinear_or_bulge → cT3a", () => {
    expect(
      deriveClinicalT(
        makeInput({
          lesions: [
            makeLesion({ epeRiskMehralivand: "1_curvilinear_or_bulge" }),
          ],
        })
      )
    ).toBe("cT3a");
  });

  it("cT3a: any lesion EPE = 2_both_features → cT3a", () => {
    expect(
      deriveClinicalT(
        makeInput({
          lesions: [makeLesion({ epeRiskMehralivand: "2_both_features" })],
        })
      )
    ).toBe("cT3a");
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

  it("cT3a: capsuleIntegrity gross_extracapsular_extension → cT3a", () => {
    expect(
      deriveClinicalT(
        makeInput({ capsuleIntegrity: "gross_extracapsular_extension" })
      )
    ).toBe("cT3a");
  });

  it("cT3a: DRE extracapsular_T3 alone → cT3a", () => {
    expect(
      deriveClinicalT(makeInput({ digitalRectalExam: "extracapsular_T3" }))
    ).toBe("cT3a");
  });

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

  it("cT3b: any lesion SVI suspicion = definite → cT3b", () => {
    expect(
      deriveClinicalT(
        makeInput({
          lesions: [
            makeLesion({ seminalVesicleInvasionSuspicion: "definite" }),
          ],
        })
      )
    ).toBe("cT3b");
  });

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

  it("cT4: DRE fixed_T4 alone → cT4", () => {
    expect(
      deriveClinicalT(makeInput({ digitalRectalExam: "fixed_T4" }))
    ).toBe("cT4");
  });

  // N-1 explicit guard: MRI lesions present, no DRE evidence, no T3+ → cT1c.
  it("N-1 explicit: MRI lesions alone (no DRE, no T3+) → cT1c (NOT cT2a)", () => {
    const input = makeInput({
      digitalRectalExam: "not_performed",
      lesions: [
        makeLesion({
          t2wScore: "4",
          dwiScore: "4",
          overallPiradsCategory: "4",
          epeRiskMehralivand: "0_no_features",
          seminalVesicleInvasionSuspicion: "none",
        }),
        makeLesion({
          lesionIndex: 2,
          t2wScore: "5",
          dwiScore: "5",
          overallPiradsCategory: "5",
        }),
      ],
    });
    expect(deriveClinicalT(input)).toBe("cT1c");
  });

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
          capsuleIntegrity: "gross_extracapsular_extension",
        })
      )
    ).toBe("cT3b");
  });

  it("priority: cT3a dominates cT2a (EPE + DRE T2a/b both present)", () => {
    expect(
      deriveClinicalT(
        makeInput({
          digitalRectalExam: "palpable_unilateral_T2a_b",
          capsuleIntegrity: "gross_extracapsular_extension",
        })
      )
    ).toBe("cT3a");
  });
});

// ---------------------------------------------------------------------------
// deriveClinicalN
// ---------------------------------------------------------------------------

describe("deriveClinicalN", () => {
  it("NX: no nodes assessed", () => {
    expect(deriveClinicalN(makeInput())).toBe("NX");
  });

  it("NX: explicit empty arrays for both", () => {
    expect(
      deriveClinicalN(
        makeInput({ regionalLymphNodes: [], nonRegionalLymphNodes: [] })
      )
    ).toBe("NX");
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
  it("M0: no metastasis", () => {
    expect(deriveClinicalM(makeInput())).toBe("M0");
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

  it("MX: boneInvolvement=equivocal (no other M1 evidence)", () => {
    expect(
      deriveClinicalM(makeInput({ boneInvolvement: "equivocal" }))
    ).toBe("MX");
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
// derivePsaDensity
// ---------------------------------------------------------------------------

describe("derivePsaDensity", () => {
  it("psa=8, vol=40 → 0.2", () => {
    expect(derivePsaDensity(8, 40)).toBe(0.2);
  });

  it("psa=10, vol=50 → 0.2", () => {
    expect(derivePsaDensity(10, 50)).toBe(0.2);
  });

  it("rounds to 1 decimal place", () => {
    // 7 / 30 = 0.2333... → 0.2
    expect(derivePsaDensity(7, 30)).toBe(0.2);
    // 7.5 / 30 = 0.25 → 0.3 (Math.round rounds .5 up)
    expect(derivePsaDensity(7.5, 30)).toBe(0.3);
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

  it("low: PSA=8, ISUP1, cT1c", () => {
    expect(
      deriveEauRiskGroup(
        makeInput({
          clinicalIndication: "staging_after_diagnosis",
          psaNgPerMl: 8,
          priorBiopsyStatus: "positive_ISUP1",
          digitalRectalExam: "not_performed",
        })
      )
    ).toBe("low");
  });

  it("low: PSA=8, ISUP1, cT2a (DRE-driven)", () => {
    expect(
      deriveEauRiskGroup(
        makeInput({
          clinicalIndication: "staging_after_diagnosis",
          psaNgPerMl: 8,
          priorBiopsyStatus: "positive_ISUP1",
          digitalRectalExam: "palpable_unilateral_T2a_b",
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

  it("high: PSA=8, ISUP1, cT3a → high (T-stage)", () => {
    expect(
      deriveEauRiskGroup(
        makeInput({
          clinicalIndication: "staging_after_diagnosis",
          psaNgPerMl: 8,
          priorBiopsyStatus: "positive_ISUP1",
          capsuleIntegrity: "gross_extracapsular_extension",
        })
      )
    ).toBe("high");
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
          digitalRectalExam: "not_performed",
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
          digitalRectalExam: "not_performed",
        })
      )
    ).toBe("intermediate_unfavourable");
  });

  it("intermediate_unfavourable: PSA=8, ISUP2, cT2c → 2 factors", () => {
    expect(
      deriveEauRiskGroup(
        makeInput({
          clinicalIndication: "staging_after_diagnosis",
          psaNgPerMl: 8,
          priorBiopsyStatus: "positive_ISUP2",
          digitalRectalExam: "palpable_bilateral_T2c",
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
          digitalRectalExam: "not_performed",
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
    ).toContain("- PSA density: 0.2 ng/mL/cc");
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
    const result = serializeProstateStructuredInput(makeInput());
    expect(result).toContain("- Clinical T: cT1c");
    expect(result).toContain("- Clinical N: NX");
    expect(result).toContain("- Clinical M: M0");
    expect(result).not.toContain("- Staging overridden:");
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
    expect(result).toContain("  - Node 1: station obturator");
    expect(result).toContain("short axis 10 mm");
    expect(result).toContain("morphology round");
    expect(result).toContain("features: necrosis");
    expect(result).toContain("  - Node 2: station internal_iliac");
    expect(result).toContain("- Non-regional lymph nodes:");
    expect(result).toContain("  - Node 1: location retroperitoneal");
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
    expect(result).toContain("- PI-QUAL overall: 2_acceptable");
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
      digitalRectalExam: "palpable_unilateral_T2a_b",
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
          seminalVesicleInvasionSuspicion: "none",
          neurovascularBundleInvolvement: "abutment",
          relationToApex: "mid",
          relationToUrethra: "abutting",
          targetForBiopsy: true,
        }),
      ],
      prostateVolumeMl: 50,
      capsuleIntegrity: "focally_breached",
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
    expect(result).toContain("- Clinical indication: staging_after_diagnosis");
    expect(result).toContain("- PSA: 12.5 ng/mL");
    expect(result).toContain("- PSA density: 0.3 ng/mL/cc");

    // Lesion content
    expect(result).toContain("- Zone: peripheral_zone_PZ");
    expect(result).toContain("- Sector map location: R-mid-PZpl, R-mid-PZpm");
    expect(result).toContain("- Size (max axial): 14 mm");
    expect(result).toContain("- Size (orthogonal axial): 12 mm");
    expect(result).toContain("- T2W score: 4");
    expect(result).toContain("- DWI score: 4");
    expect(result).toContain("- DCE result: positive");
    expect(result).toContain("- Overall PI-RADS category: 4");
    expect(result).toContain("- ADC mean value: 750 ×10⁻⁶ mm²/s");
    expect(result).toContain("- EPE risk (Mehralivand): 1_curvilinear_or_bulge");

    // Staging — derived (cT3a from EPE; ISUP=2, PSA=12.5, cT3a → high)
    expect(result).toContain("- Clinical T: cT3a");
    expect(result).toContain("- EAU risk group: high");

    // Section 4 verbatim
    expect(result).toContain("Right inguinal hernia.");
    expect(result).toContain("Targeted biopsy of right mid PZ lesion.");
    expect(result).not.toContain("Bony abnormalities:");
  });
});
