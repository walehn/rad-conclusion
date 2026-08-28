import { describe, it, expect } from "vitest";
import {
  MYOMA_SECTION_ORDER,
  buildMyomaReportSystemPrompt,
  buildMyomaReportUserPrompt,
  type MyomaReportLang,
} from "@/lib/prompts/disease-templates/myoma";

describe("MYOMA_SECTION_ORDER", () => {
  // Leiomyoma is benign, so the fifth section carries the FIGO / Funaki /
  // sarcoma-risk codes instead of a TNM stage.
  it("replaces STAGING with CLASSIFICATION", () => {
    expect(MYOMA_SECTION_ORDER).toEqual([
      "CLINICAL INFORMATION",
      "TECHNIQUE",
      "COMPARISON",
      "FINDINGS",
      "CLASSIFICATION",
      "IMPRESSION",
    ]);
    expect(MYOMA_SECTION_ORDER).not.toContain("STAGING");
  });
});

describe("buildMyomaReportSystemPrompt", () => {
  const prompt = buildMyomaReportSystemPrompt({ lang: "mixed" });

  it("declares the six section headers in order", () => {
    // Scoped to the OUTPUT FORMAT block: the few-shot example further down
    // legitimately repeats section headers inside its sample output.
    const start = prompt.indexOf("=== OUTPUT FORMAT ===");
    const end = prompt.indexOf("Each section header must appear exactly once");
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const declaration = prompt.slice(start, end);

    for (const section of MYOMA_SECTION_ORDER) {
      const occurrences = declaration.split(`${section}:`).length - 1;
      expect(occurrences, `${section} header`).toBe(1);
    }
    const positions = MYOMA_SECTION_ORDER.map((s) =>
      declaration.indexOf(`${s}:`)
    );
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it("documents all nine FIGO codes and the hybrid notation", () => {
    expect(prompt).toContain("=== FIGO LEIOMYOMA SUBCLASSIFICATION ===");
    for (const [code, phrase] of [
      ["0", "Pedunculated intracavitary"],
      ["1", "Submucosal, less than 50% intramural"],
      ["2", "Submucosal, 50% or more intramural"],
      ["3", "Contacts endometrium, 100% intramural"],
      ["4", "Intramural, no endometrial or serosal contact"],
      ["5", "Subserosal, 50% or more intramural"],
      ["6", "Subserosal, less than 50% intramural"],
      ["7", "Subserosal, pedunculated"],
      ["8", "Other"],
    ] as const) {
      expect(prompt, `FIGO ${code}`).toContain(`${code}: ${phrase}`);
    }
    expect(prompt).toContain('Hybrid "N-N"');
  });

  it("tells the model the derived values are authoritative", () => {
    // The FIGO type and red-flag tally are computed by the serializer; a model
    // that recomputes them can disagree with what the form showed the user.
    expect(prompt).toContain("ALREADY DERIVED");
    expect(prompt).toContain("Do NOT recompute or contradict them");
  });

  it("ties the sarcoma recommendation to the threshold, not to any red flag", () => {
    expect(prompt).toContain("=== LEIOMYOSARCOMA RED FLAGS ===");
    expect(prompt).toContain(
      "Threshold reached (\"Yes\"): the CLASSIFICATION section MUST state"
    );
    expect(prompt).toContain(
      "Threshold not reached but flags present: name the atypical feature(s)"
    );
    expect(prompt).toContain(
      "Never assert a benign diagnosis with certainty"
    );
  });

  it("carries the allTypical suppression rule into the report text", () => {
    expect(prompt).toContain('When "All myomas typical: Yes" is present');
    expect(prompt).toContain(
      "Do NOT expand it into a per-lesion signal description"
    );
  });

  it("specifies the unnumbered house-style IMPRESSION", () => {
    expect(prompt).toContain("=== IMPRESSION FORMAT (HOUSE STYLE) ===");
    expect(prompt).toContain("does NOT use a numbered list");
    expect(prompt).toContain('indented one space and prefixed with "- "');
    expect(prompt).toContain("MAXIMUM 6 items");
  });

  it("forbids treatment recommendations but allows tissue diagnosis at threshold", () => {
    expect(prompt).toContain(
      "Do NOT provide treatment recommendations (myomectomy, hysterectomy, embolization, focused ultrasound, hormonal therapy)"
    );
    expect(prompt).toContain(
      "when the leiomyosarcoma red-flag threshold was reached"
    );
  });

  it("documents the adenomyosis junctional zone cut-off", () => {
    expect(prompt).toContain("Junctional zone thickness of 12 mm or more");
  });

  it("describes Funaki types only as response likelihood, not as advice", () => {
    expect(prompt).toContain("=== FUNAKI TYPE (HIFU/MRgFUS PLANNING) ===");
    expect(prompt).toContain(
      "Do NOT recommend or discourage the procedure itself"
    );
  });
});

describe("language handling", () => {
  const langs: MyomaReportLang[] = ["ko", "en", "mixed"];

  it.each(langs)("embeds a distinct instruction for %s", (lang) => {
    const prompt = buildMyomaReportSystemPrompt({ lang });
    expect(prompt).toContain("=== LANGUAGE ===");
    if (lang === "en") {
      expect(prompt).toContain("Do not use Korean characters anywhere");
    } else {
      expect(prompt).toContain("Section headers");
    }
  });

  it("produces a different prompt for every language", () => {
    const rendered = langs.map((lang) =>
      buildMyomaReportSystemPrompt({ lang })
    );
    expect(new Set(rendered).size).toBe(langs.length);
  });

  it("labels the examination date per language", () => {
    expect(buildMyomaReportSystemPrompt({ lang: "en" })).toContain(
      '"Date of examination: <YYYY-MM-DD>"'
    );
    expect(buildMyomaReportSystemPrompt({ lang: "ko" })).toContain(
      '"검사일: <YYYY-MM-DD>"'
    );
  });
});

describe("modality handling", () => {
  it("defaults to Auto when no modality is given", () => {
    expect(buildMyomaReportSystemPrompt({ lang: "ko" })).toContain(
      "Modality hint: Auto"
    );
  });

  it("describes a uterine MRI protocol for MRI", () => {
    const prompt = buildMyomaReportSystemPrompt({
      lang: "ko",
      modality: "MRI",
    });
    expect(prompt).toContain("Modality hint: MRI");
    expect(prompt).toContain("diffusion-weighted imaging");
  });

  // Signal intensity and diffusion restriction are MRI concepts; letting them
  // leak into an ultrasound report would be a fabricated finding.
  it("forbids MRI vocabulary for an ultrasound study", () => {
    const prompt = buildMyomaReportSystemPrompt({ lang: "ko", modality: "US" });
    expect(prompt).toContain("Modality hint: US");
    expect(prompt).toContain(
      "Do NOT describe MRI sequences, signal intensity, or diffusion restriction"
    );
  });
});

describe("buildMyomaReportUserPrompt", () => {
  it("passes the findings through unchanged", () => {
    const findings = "Uterus:\n- Total myoma count: 5";
    const prompt = buildMyomaReportUserPrompt({ lang: "ko", findings });
    expect(prompt).toContain(findings);
    expect(prompt).toContain("DiseaseCategory: UterineMyoma");
  });

  it("marks an unspecified modality as auto-detect", () => {
    expect(
      buildMyomaReportUserPrompt({ lang: "ko", findings: "x" })
    ).toContain("Modality: Auto-detect from findings");
  });

  it("names an explicit modality", () => {
    expect(
      buildMyomaReportUserPrompt({ lang: "ko", findings: "x", modality: "MRI" })
    ).toContain("Modality: MRI");
  });
});
