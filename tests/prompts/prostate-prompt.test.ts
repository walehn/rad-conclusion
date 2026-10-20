/**
 * Prostate report prompt: protocol wording, single placement of facts, and
 * PI-QUAL kept out of IMPRESSION.
 */

import { describe, it, expect } from "vitest";
import {
  buildProstateReportSystemPrompt,
  buildProstateReportUserPrompt,
} from "@/lib/prompts/disease-templates/prostate";

const BP_FINDINGS =
  "CLINICAL CONTEXT\n- PSA: 7.2 ng/mL\n\nTECHNIQUE\n- MRI protocol: biparametric MRI (bpMRI), DCE not performed";
const MP_FINDINGS =
  "CLINICAL CONTEXT\n- PSA: 7.2 ng/mL\n\nTECHNIQUE\n- MRI protocol: multiparametric MRI (mpMRI), with DCE";
const EN_BP_TECHNIQUE =
  "Biparametric MRI (bpMRI): axial/sagittal/coronal T2W, axial T1W, and DWI (b = 0, 100, 1000, 1500 s/mm²) with ADC map. DCE not performed.";
const EN_MP_TECHNIQUE =
  "Multiparametric MRI (mpMRI): axial/sagittal/coronal T2W, axial T1W, DWI (b = 0, 100, 1000, 1500 s/mm²) with ADC map, and DCE.";

describe("buildProstateReportSystemPrompt", () => {
  const prompt = buildProstateReportSystemPrompt({ lang: "ko", modality: "MRI" });
  const impression = prompt.slice(
    prompt.indexOf("=== IMPRESSION SECTION GUIDANCE ==="),
    prompt.indexOf("=== OTHER FINDINGS HANDLING ===")
  );

  it("maps each fact to one home section", () => {
    expect(prompt).toContain("=== ONE SECTION PER FACT (no repetition) ===");
    expect(prompt).toMatch(/CLINICAL INFORMATION: .*NOT PSA density\./);
    expect(prompt).toMatch(/FINDINGS: prostate dimensions and volume, PSA density/);
  });

  it("no longer asks for a PI-QUAL caveat in IMPRESSION", () => {
    expect(impression).not.toMatch(/PI-QUAL caveat/);
    expect(impression).toContain(
      "Never mention PI-QUAL (the term, its score or subscores) in IMPRESSION."
    );
    expect(prompt).not.toMatch(/IMPRESSION section MUST (also )?(include|carry)/);
  });

  it("keeps T / N / M categories out of IMPRESSION", () => {
    expect(impression).toContain("Do NOT write T / N / M categories here");
  });

  it("reports the MRI T stage apart from the DRE-based clinical T", () => {
    const staging = prompt.slice(
      prompt.indexOf("=== STAGING SECTION GUIDANCE ==="),
      prompt.indexOf("=== IMPRESSION SECTION GUIDANCE ===")
    );
    expect(staging).toContain('write the input\'s "MRI T stage:" line');
    expect(staging).toContain('never relabel it "Clinical T" or "cT", and never subdivide T2');
    expect(staging).toContain("A DRE clinical T supplied by the referring clinician belongs to CLINICAL INFORMATION");
    expect(prompt).toMatch(/CLINICAL INFORMATION: .*the DRE clinical T when supplied/);
    expect(prompt).not.toMatch(/cT2 sub-stage|cT2a \/ cT2b|auto-derives cT2/);
  });

  it("takes the protocol from the MRI protocol line for both modality hints", () => {
    for (const modality of ["MRI", "Auto"] as const) {
      expect(buildProstateReportSystemPrompt({ lang: "en", modality })).toContain(
        '"MRI protocol:" line'
      );
    }
  });
});

describe("buildProstateReportUserPrompt", () => {
  it("adds the bpMRI directive only for a bpMRI study", () => {
    const bp = buildProstateReportUserPrompt({ lang: "ko", modality: "MRI", findings: BP_FINDINGS });
    const mp = buildProstateReportUserPrompt({ lang: "ko", modality: "MRI", findings: MP_FINDINGS });
    expect(bp).toContain("This study is biparametric MRI (bpMRI) without DCE.");
    expect(mp).not.toContain("This study is biparametric MRI");
  });

  it("adds no directive to free-text findings without a protocol line", () => {
    const out = buildProstateReportUserPrompt({
      lang: "en",
      modality: "Auto",
      findings: "Free-text prostate findings, biparametric study.",
    });
    expect(out).not.toContain("This study is biparametric MRI");
  });

  it("ends with a language reminder matching the requested language", () => {
    const ko = buildProstateReportUserPrompt({ lang: "ko", modality: "MRI", findings: MP_FINDINGS });
    const en = buildProstateReportUserPrompt({ lang: "en", modality: "MRI", findings: MP_FINDINGS });
    expect(ko.trimEnd().split("\n").at(-1)).toMatch(/^Write every section body in Korean/);
    expect(en.trimEnd().split("\n").at(-1)).toBe("Write the whole report in English.");
  });
});

describe("fixed phrases follow the report language", () => {
  it("uses Korean fixed sentences for ko and mixed, English for en", () => {
    const ko = buildProstateReportSystemPrompt({ lang: "ko", modality: "MRI" });
    const mixed = buildProstateReportSystemPrompt({ lang: "mixed", modality: "MRI" });
    const en = buildProstateReportSystemPrompt({ lang: "en", modality: "MRI" });
    for (const p of [ko, mixed]) {
      expect(p).toContain('write exactly: "비교할 이전 MRI 없음."');
      expect(p).toContain('"PI-RADS 3 이상 병변 없음. PSA 및 임상 추적 관찰 권장."');
      expect(p).toContain("영상 품질 저하로 평가가 제한된 검사에서");
      expect(p).toContain('write exactly "전이성 질환 — 비전이성 질환 대상 EAU 위험군 해당 없음."');
      expect(p).not.toContain("No prior MRI available.");
    }
    expect(en).toContain('write exactly: "No prior MRI available."');
    expect(en).toContain("on this examination of limited image quality. Repeat MRI should be considered.");
    expect(en).not.toContain("비교할 이전 MRI 없음.");
  });
});

describe("biopsy recommendation and EPE wording rules", () => {
  const prompt = buildProstateReportSystemPrompt({ lang: "en", modality: "MRI" });

  it("ties the biopsy recommendation to the BIOPSY RECOMMENDATION block", () => {
    expect(prompt).toContain(
      'When the input has a BIOPSY RECOMMENDATION block, end the item of each lesion it lists with "MRI-targeted biopsy recommended."'
    );
    expect(prompt).not.toMatch(/Target for biopsy/);
  });

  it("reserves extraprostatic extension for EPE grade 3", () => {
    expect(prompt).toContain("Only grade 3 is extraprostatic extension.");
  });

  it("omits absent fields instead of calling them unspecified", () => {
    expect(prompt).not.toContain('"Not specified in input"');
    expect(prompt).toMatch(/do NOT write that it is unspecified or unavailable/);
  });
});

describe("case directives", () => {
  const lesionBlock = (epe: string) =>
    `${BP_FINDINGS}\n\nLESION 1\n- Zone: peripheral zone (PZ)\n- EPE risk (Mehralivand): Mehralivand grade ${epe}`;
  const negative = (piQual: string) =>
    `CLINICAL CONTEXT\n- No suspicious lesion: yes (PI-RADS ≤ 2 negative MRI)\n\nTECHNIQUE\n- PI-QUAL overall: PI-QUAL ${piQual}`;
  const user = (findings: string) =>
    buildProstateReportUserPrompt({ lang: "ko", modality: "MRI", findings });

  it("adds the lesion omission directive only when a LESION block exists", () => {
    expect(user(lesionBlock("0 (no features)"))).toContain(
      "Describe each lesion only with the lines its LESION block contains."
    );
    expect(user(negative("3 — optimal"))).not.toContain("Describe each lesion only");
  });

  it("adds the EPE directive for grade 1 or 2, not for grade 0 or 3", () => {
    const directive = "EPE grade 1 or 2 is a risk feature";
    expect(user(lesionBlock("1 (curvilinear contact or capsular bulge)"))).toContain(directive);
    expect(user(lesionBlock("2 (both features present)"))).toContain(directive);
    expect(user(lesionBlock("0 (no features)"))).not.toContain(directive);
    expect(user(lesionBlock("3 (frank capsular breach)"))).not.toContain(directive);
  });

  it("adds the limited-examination directive only on a negative MRI with PI-QUAL 1", () => {
    const directive = "Image quality is inadequate on this negative MRI.";
    expect(user(negative("1 — inadequate"))).toContain(directive);
    expect(user(negative("1 — inadequate"))).toContain(
      "영상 품질 저하로 평가가 제한된 검사에서 PI-RADS 3 이상 병변은 보이지 않음. MRI 재검사 고려."
    );
    expect(user(negative("2 — acceptable"))).not.toContain(directive);
    expect(user(`${lesionBlock("0 (no features)")}\n- PI-QUAL overall: PI-QUAL 1 — inadequate`)).not.toContain(directive);
  });
});

describe("pelvic field of view", () => {
  const ko = buildProstateReportSystemPrompt({ lang: "ko", modality: "MRI" });
  const en = buildProstateReportSystemPrompt({ lang: "en", modality: "MRI" });

  it("limits node and bone negatives to the imaged field", () => {
    expect(en).toContain("Every negative statement about lymph nodes or bone is limited to the imaged field");
    expect(en).toContain('Never write "no distant metastasis"');
    expect(en).not.toContain("nodal or distant metastasis.");
  });

  it("replaces cM0 with a not-assessed sentence in the report language", () => {
    expect(ko).toContain('write exactly "M 병기는 골반 MRI로 평가하지 않음." in place of a cM code');
    expect(en).toContain('write exactly "M category not assessed on pelvic MRI." in place of a cM code');
    expect(en).not.toMatch(/M1c, MX\)/);
  });
});

describe("TECHNIQUE is the institution's fixed protocol sentence", () => {
  it("names no magnet strength and no paraphrased sequence list", () => {
    for (const lang of ["en", "ko", "mixed"] as const) {
      for (const modality of ["MRI", "Auto"] as const) {
        const p = buildProstateReportSystemPrompt({ lang, modality });
        expect(p).not.toMatch(/magnet|\b(3|1\.5)T\b|tri-planar|high-b/i);
      }
    }
  });

  it("quotes both protocol sentences in the report language", () => {
    const en = buildProstateReportSystemPrompt({ lang: "en", modality: "MRI" });
    expect(en).toContain(`"${EN_BP_TECHNIQUE}"`);
    expect(en).toContain(`"${EN_MP_TECHNIQUE}"`);
    for (const lang of ["ko", "mixed"] as const) {
      const p = buildProstateReportSystemPrompt({ lang, modality: "MRI" });
      expect(p).toContain("DWI (b = 0, 100, 1000, 1500 s/mm²) 및 ADC map. DCE 미시행.");
      expect(p).not.toContain(EN_BP_TECHNIQUE);
    }
  });

  it("restates the matching sentence in the case directives", () => {
    const bp = buildProstateReportUserPrompt({ lang: "en", modality: "Auto", findings: BP_FINDINGS });
    const mp = buildProstateReportUserPrompt({ lang: "en", modality: "Auto", findings: MP_FINDINGS });
    expect(bp).toContain(`then exactly "${EN_BP_TECHNIQUE}"`);
    expect(bp).not.toContain(EN_MP_TECHNIQUE);
    expect(mp).toContain(`then exactly "${EN_MP_TECHNIQUE}"`);
    expect(mp).not.toContain(EN_BP_TECHNIQUE);
  });
});

describe("biopsy directive", () => {
  const withBlock = `${BP_FINDINGS}\n\nBIOPSY RECOMMENDATION\n- MRI-targeted biopsy recommended for: Lesion 1, Lesion 3`;

  it("names the listed lesions and the sentence in the report language", () => {
    const en = buildProstateReportUserPrompt({ lang: "en", modality: "MRI", findings: withBlock });
    const ko = buildProstateReportUserPrompt({ lang: "ko", modality: "MRI", findings: withBlock });
    expect(en).toContain('In IMPRESSION, end the item of Lesion 1, Lesion 3 with "MRI-targeted biopsy recommended."');
    expect(ko).toContain('end the item of Lesion 1, Lesion 3 with "MRI 표적 생검 권고."');
  });

  it("rules out a biopsy recommendation when lesions exist without the block", () => {
    const lesion = `${BP_FINDINGS}\n\nLESION 1\n- Zone: peripheral zone (PZ)`;
    const out = buildProstateReportUserPrompt({ lang: "en", modality: "MRI", findings: lesion });
    expect(out).not.toContain("In IMPRESSION, end the item of");
    expect(out).toContain("this report carries no biopsy recommendation.");
    const withTargets = buildProstateReportUserPrompt({
      lang: "en",
      modality: "MRI",
      findings: `${lesion}\n\nBIOPSY RECOMMENDATION\n- MRI-targeted biopsy recommended for: Lesion 1`,
    });
    expect(withTargets).not.toContain("carries no biopsy recommendation");
  });

  it("says nothing about biopsy on a study without lesions", () => {
    const out = buildProstateReportUserPrompt({ lang: "en", modality: "MRI", findings: BP_FINDINGS });
    expect(out).not.toMatch(/biopsy recommendation|end the item of/);
  });
});
