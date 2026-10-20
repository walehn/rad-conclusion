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
  "CLINICAL CONTEXT\n- PSA: 7.2 ng/mL\n\nTECHNIQUE\n- MRI protocol: biparametric MRI (bpMRI) — T2W and DWI/ADC; DCE not performed";
const MP_FINDINGS =
  "CLINICAL CONTEXT\n- PSA: 7.2 ng/mL\n\nTECHNIQUE\n- MRI protocol: multiparametric MRI (mpMRI) — T2W, DWI/ADC and DCE";

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
      "Never mention PI-QUAL or image quality in IMPRESSION, whatever the PI-QUAL score."
    );
    expect(prompt).not.toMatch(/IMPRESSION section MUST (also )?(include|carry)/);
  });

  it("keeps cT / cN / cM codes out of IMPRESSION", () => {
    expect(impression).toContain("Do NOT write cT / cN / cM codes here");
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
