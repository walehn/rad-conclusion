import { describe, it, expect } from "vitest";
import {
  serializeRccStructuredInput,
  hasMinimumStructuredFields,
} from "@/lib/prompts/disease-templates/rcc-serializer";

describe("serializeRccStructuredInput", () => {
  // Test 1: Empty mass (single mass, no fields) → "Mass 1:" header + 14 NA lines.
  // massType is undefined here, so Bosniak and Predominantly cystic are omitted
  // entirely (those two lines render only when massType === "Cystic"). The
  // serializer outputs them only after a confirmed cystic classification, so
  // an empty/unselected mass renders the 14-line core canonical order.
  it("returns Mass 1 header plus 14 'Not specified in input' lines for an empty mass", () => {
    const result = serializeRccStructuredInput({ masses: [{}] });
    const lines = result.split("\n");
    expect(lines[0]).toBe("Mass 1:");
    expect(lines).toHaveLength(15);
    expect(result).not.toContain("- Bosniak:");
    expect(result).not.toContain("- Predominantly cystic:");
    for (const line of lines.slice(1)) {
      expect(line).toMatch(/Not specified in input$/);
    }
  });

  // Test 2: Solid mass + Bosniak III → Bosniak line is OMITTED entirely.
  // Bosniak v2019 applies only to cystic masses; for Solid the serializer
  // drops the Bosniak (and Predominantly cystic) lines so the LLM prompt
  // contains no noise about a non-applicable cystic-only field.
  it("omits the Bosniak line entirely when massType is Solid, ignoring user input", () => {
    const result = serializeRccStructuredInput({
      masses: [
        {
          massType: "Solid",
          bosniak: "III",
        },
      ],
    });
    expect(result).toContain("Mass 1:\n");
    expect(result).not.toContain("- Bosniak:");
    expect(result).not.toContain("Not applicable (solid mass)");
  });

  // Test 3: Cystic mass + Bosniak IIF → Bosniak shown as-is
  it("shows Bosniak IIF for Cystic mass", () => {
    const result = serializeRccStructuredInput({
      masses: [
        {
          massType: "Cystic",
          bosniak: "IIF",
        },
      ],
    });
    expect(result).toContain("Mass 1:\n");
    expect(result).toContain("- Bosniak: IIF");
  });

  // Test 4: Cystic + cysticPredominant true + Bosniak III → Bosniak shown,
  // Predominantly cystic emits "Yes", no NA override (was migrated from
  // legacy `massType: "Predominantly cystic"` after enum reduction to binary).
  it("shows Bosniak III for Cystic mass with cysticPredominant true (no Solid override)", () => {
    const result = serializeRccStructuredInput({
      masses: [
        {
          massType: "Cystic",
          cysticPredominant: true,
          bosniak: "III",
        },
      ],
    });
    expect(result).toContain("Mass 1:\n");
    expect(result).toContain("- Bosniak: III");
    expect(result).toContain("- Predominantly cystic: Yes");
    expect(result).not.toContain("Not applicable (solid mass)");
  });

  // Test 5: massSizeCm → formatted with " cm" (single space)
  it("formats massSizeCm with a single space before cm unit", () => {
    const result = serializeRccStructuredInput({
      masses: [{ massSizeCm: 4.2 }],
    });
    expect(result).toContain("Mass 1:\n");
    expect(result).toContain("- Mass size: 4.2 cm");
  });

  // Test 6: distanceCm → formatted with " cm"
  it("formats distanceCm with a single space before cm unit", () => {
    const result = serializeRccStructuredInput({
      masses: [{ distanceCm: 0.5 }],
    });
    expect(result).toContain("Mass 1:\n");
    expect(result).toContain("- Distance to collecting system: 0.5 cm");
  });

  // Test 7: thrombusKind "None" → "None" (no level)
  it("shows 'None' for thrombusKind None", () => {
    const result = serializeRccStructuredInput({
      masses: [{ thrombusKind: "None" }],
    });
    expect(result).toContain("Mass 1:\n");
    expect(result).toContain("- Venous tumor thrombus: None");
  });

  // Test 8: thrombusKind "IVC" + thrombusLevel "II" → combined Neves-Mayo line
  it("combines IVC thrombus with Neves-Mayo level II", () => {
    const result = serializeRccStructuredInput({
      masses: [
        {
          thrombusKind: "IVC",
          thrombusLevel: "II",
        },
      ],
    });
    expect(result).toContain("Mass 1:\n");
    expect(result).toContain(
      "- Venous tumor thrombus: IVC, Neves-Mayo Level II"
    );
  });

  // Test 9: thrombusKind "Renal vein" → invariant auto-emits Level 0.
  // Renal vein thrombus is by definition Neves-Mayo Level 0 (no IVC extension).
  it("auto-emits Neves-Mayo Level 0 for Renal vein thrombus", () => {
    const result = serializeRccStructuredInput({
      masses: [
        {
          thrombusKind: "Renal vein",
        },
      ],
    });
    expect(result).toContain("Mass 1:\n");
    expect(result).toContain(
      "- Venous tumor thrombus: Renal vein, Neves-Mayo Level 0"
    );
  });

  // Test 10: thrombusKind "IVC" + thrombusLevel undefined → kind only
  it("shows only IVC when thrombusLevel is undefined", () => {
    const result = serializeRccStructuredInput({
      masses: [
        {
          thrombusKind: "IVC",
          thrombusLevel: undefined,
        },
      ],
    });
    expect(result).toContain("Mass 1:\n");
    expect(result).toContain("- Venous tumor thrombus: IVC");
    expect(result).not.toContain("Neves-Mayo");
  });

  // Test 11: All mass fields populated → exact 17-line match (header + 16 lines)
  // Size comparison defaults to "Not specified in input" because all 3 prior fields are unset.
  // cysticPredominant true → "- Predominantly cystic: Yes" (inserted after Bosniak).
  it("serializes all populated fields correctly with exact line values", () => {
    const result = serializeRccStructuredInput({
      masses: [
        {
          side: "Right",
          massSizeCm: 3.5,
          growthRate: 0.8,
          massType: "Cystic",
          cysticPredominant: true,
          bosniak: "III",
          macroFat: "Absent",
          solidEnhancement: "Present",
          axial: "Lower pole",
          cranio: "Posterior",
          margins: "Smooth",
          exophytic: ">=50% exophytic",
          distanceCm: 1.2,
          thrombusKind: "IVC",
          thrombusLevel: "II",
          blandThrombus: "Present",
        },
      ],
    });

    const expected = [
      "Mass 1:",
      "- Side: Right",
      "- Mass size: 3.5 cm",
      "- Mass type: Cystic",
      "- Bosniak: III",
      "- Predominantly cystic: Yes",
      "- Axial location: Lower pole",
      "- Cranio-caudal location: Posterior",
      "- Margins: Smooth",
      "- Exophytic ratio: >=50% exophytic",
      "- Macroscopic fat: Absent",
      "- Solid enhancement: Present",
      "- Distance to collecting system: 1.2 cm",
      "- Venous tumor thrombus: IVC, Neves-Mayo Level II",
      "- Bland (non-tumor) thrombus: Present",
      "- Growth rate: 0.8",
      "- Size comparison: Not specified in input",
    ].join("\n");

    expect(result).toBe(expected);
  });

  // Test 12: growthRate → no unit suffix
  it("serializes growthRate as a plain number without unit", () => {
    const result = serializeRccStructuredInput({
      masses: [{ growthRate: 1.5 }],
    });
    expect(result).toContain("Mass 1:\n");
    expect(result).toContain("- Growth rate: 1.5");
    // Confirm no unit is appended
    expect(result).not.toMatch(/Growth rate: 1\.5 /);
  });

  // Test 13: empty masses array → empty string
  it("returns an empty string when masses is an empty array", () => {
    expect(serializeRccStructuredInput({ masses: [] })).toBe("");
  });

  // Test 14: two masses with independent per-mass-type rendering.
  // Solid mass omits Bosniak + Predominantly cystic (14 lines); Cystic mass
  // keeps the full 16-line canonical order.
  it("renders two masses as Mass 1 / Mass 2 blocks with per-mass-type Bosniak rendering", () => {
    const result = serializeRccStructuredInput({
      masses: [
        {
          side: "Right",
          massSizeCm: 4.2,
          massType: "Solid",
          bosniak: "III",
        },
        {
          side: "Left",
          massSizeCm: 2.8,
          massType: "Cystic",
          bosniak: "IIF",
        },
      ],
    });

    const blocks = result.split("\n\n");
    expect(blocks).toHaveLength(2);

    // Mass 1 block: Solid → Bosniak + Predominantly cystic lines OMITTED
    expect(blocks[0]).toMatch(/^Mass 1:\n/);
    expect(blocks[0]).toContain("- Side: Right");
    expect(blocks[0]).toContain("- Mass size: 4.2 cm");
    expect(blocks[0]).not.toContain("- Bosniak:");
    expect(blocks[0]).not.toContain("- Predominantly cystic:");
    expect(blocks[0]).not.toContain("Not applicable (solid mass)");

    // Mass 2 block: Cystic → Bosniak IIF preserved; full 16-line block
    expect(blocks[1]).toMatch(/^Mass 2:\n/);
    expect(blocks[1]).toContain("- Side: Left");
    expect(blocks[1]).toContain("- Mass size: 2.8 cm");
    expect(blocks[1]).toContain("- Bosniak: IIF");
    expect(blocks[1]).not.toContain("Not applicable (solid mass)");

    // Solid block: header + 14 lines = 15 total
    expect(blocks[0].split("\n")).toHaveLength(15);
    // Cystic block: header + 16 lines = 17 total
    expect(blocks[1].split("\n")).toHaveLength(17);
  });

  // -------------------------------------------------------------------------
  // SAR DFP §3.3 core completion: Size comparison (mass-level) +
  // Lymph nodes / Distant metastases (study-level)
  // -------------------------------------------------------------------------

  // Test 20: prior size only → "<size> cm"
  it("serializes Size comparison with prior size only", () => {
    const result = serializeRccStructuredInput({
      masses: [{ priorMassSizeCm: 3.8 }],
    });
    expect(result).toContain("- Size comparison: 3.8 cm");
    expect(result).not.toContain("- Size comparison: 3.8 cm on");
    expect(result).not.toContain("- Size comparison: 3.8 cm,");
  });

  // Test 21: prior size + date → "<size> cm on <date>"
  it("serializes Size comparison with prior size and date", () => {
    const result = serializeRccStructuredInput({
      masses: [{ priorMassSizeCm: 3.8, priorStudyDate: "2025-10-15" }],
    });
    expect(result).toContain("- Size comparison: 3.8 cm on 2025-10-15");
    expect(result).not.toContain(", ");
  });

  // Test 22: trajectory only → "<trajectory>"
  it("serializes Size comparison with trajectory only", () => {
    const result = serializeRccStructuredInput({
      masses: [{ trajectory: "New" }],
    });
    expect(result).toContain("- Size comparison: New");
    expect(result).not.toContain(" cm");
  });

  // Test 23: prior size + date + trajectory → "<size> cm on <date>, <trajectory>"
  it("serializes Size comparison with all three fields", () => {
    const result = serializeRccStructuredInput({
      masses: [
        {
          priorMassSizeCm: 3.8,
          priorStudyDate: "2025-10-15",
          trajectory: "Increasing",
        },
      ],
    });
    expect(result).toContain(
      "- Size comparison: 3.8 cm on 2025-10-15, Increasing"
    );
  });

  // Test 24: lymphNodes Absent → single line, no sub-bullets
  it("emits a single 'Regional lymph nodes: Absent' line with no sub-bullets", () => {
    const result = serializeRccStructuredInput({
      masses: [{}],
      lymphNodes: "Absent",
    });
    expect(result).toContain("Regional lymph nodes: Absent");
    // No sub-bullets when Absent
    expect(result).not.toContain("- Sites:");
    expect(result).not.toContain("- Largest short axis:");
    // Mass block remains separated by blank line from study-level block
    expect(result.split("\n\n")).toHaveLength(2);
  });

  // Test 25: lymphNodes Present + sites + short axis → header + 2 sub-bullets
  it("emits Regional lymph nodes Present block with sites and short axis", () => {
    const result = serializeRccStructuredInput({
      masses: [{}],
      lymphNodes: "Present",
      lymphNodeSites: ["Renal hilar", "Retroperitoneal"],
      lymphNodeShortAxisCm: 1.8,
    });
    expect(result).toContain("Regional lymph nodes: Present");
    expect(result).toContain("- Sites: Renal hilar, Retroperitoneal");
    expect(result).toContain("- Largest short axis: 1.8 cm");
  });

  // Test 26: lymphNodes Present + empty sites array → "Not specified in input"
  it("falls back to 'Not specified in input' for empty lymphNodeSites array", () => {
    const result = serializeRccStructuredInput({
      masses: [{}],
      lymphNodes: "Present",
      lymphNodeSites: [],
    });
    expect(result).toContain("Regional lymph nodes: Present");
    expect(result).toContain("- Sites: Not specified in input");
    expect(result).toContain("- Largest short axis: Not specified in input");
  });

  // Test 27: distantMetastases Present + sites multiselect
  it("emits Distant metastases Present block with sites multiselect", () => {
    const result = serializeRccStructuredInput({
      masses: [{}],
      distantMetastases: "Present",
      metastasisSites: ["Lung", "Bone"],
    });
    expect(result).toContain("Distant metastases: Present");
    expect(result).toContain("- Sites: Lung, Bone");
    // Distant metastases block has only the Sites sub-bullet
    expect(result).not.toContain("- Largest short axis:");
  });

  // Test 28: study-level fields all undefined → block fully omitted
  it("omits the study-level block entirely when no study-level fields are set", () => {
    const result = serializeRccStructuredInput({
      masses: [{ side: "Right", massSizeCm: 3.5 }],
    });
    expect(result).not.toContain("Regional lymph nodes");
    expect(result).not.toContain("Distant metastases");
    // Single mass block only → no blank-line-separated study block
    expect(result.split("\n\n")).toHaveLength(1);
  });

  // -------------------------------------------------------------------------
  // Bosniak v2019 alignment: Predominantly cystic field (Cystic-only boolean)
  // -------------------------------------------------------------------------

  // Test 29: Solid mass omits the Predominantly cystic line entirely, even
  // when cysticPredominant is set. Mirrors the Bosniak omission policy: a
  // cystic-only field has no place in a solid-mass serialization block.
  it("omits the Predominantly cystic line entirely when massType is Solid, ignoring cysticPredominant input", () => {
    const result = serializeRccStructuredInput({
      masses: [
        {
          massType: "Solid",
          cysticPredominant: true,
        },
      ],
    });
    expect(result).not.toContain("- Predominantly cystic:");
    expect(result).not.toContain("Not applicable (solid mass)");
  });

  // Test 30: Cystic + cysticPredominant true → "Yes"
  it("emits 'Yes' for Predominantly cystic when massType is Cystic and cysticPredominant is true", () => {
    const result = serializeRccStructuredInput({
      masses: [
        {
          massType: "Cystic",
          cysticPredominant: true,
        },
      ],
    });
    expect(result).toContain("- Predominantly cystic: Yes");
  });

  // Test 31: Cystic + cysticPredominant false → "No"
  it("emits 'No' for Predominantly cystic when massType is Cystic and cysticPredominant is false", () => {
    const result = serializeRccStructuredInput({
      masses: [
        {
          massType: "Cystic",
          cysticPredominant: false,
        },
      ],
    });
    expect(result).toContain("- Predominantly cystic: No");
  });

  // Test 32: Cystic + cysticPredominant undefined → "Not specified in input"
  it("emits 'Not specified in input' for Predominantly cystic when massType is Cystic and cysticPredominant is undefined", () => {
    const result = serializeRccStructuredInput({
      masses: [
        {
          massType: "Cystic",
        },
      ],
    });
    expect(result).toContain("- Predominantly cystic: Not specified in input");
  });

  // Test 33: Renal vein invariant override — even if a stale thrombusLevel
  // (e.g., from a legacy fixture) is set to anything other than "0", the
  // serializer must force "Renal vein, Neves-Mayo Level 0" because renal
  // vein thrombus has no IVC extension by definition.
  it("forces Neves-Mayo Level 0 for Renal vein even if thrombusLevel is stale", () => {
    const result = serializeRccStructuredInput({
      masses: [
        {
          thrombusKind: "Renal vein",
          thrombusLevel: "III", // stale/invalid combination
        },
      ],
    });
    expect(result).toContain(
      "- Venous tumor thrombus: Renal vein, Neves-Mayo Level 0"
    );
    expect(result).not.toContain("Neves-Mayo Level III");
  });

  // Test 34: clinicalInformation only → header line above mass blocks
  it("prepends Clinical information line when clinicalInformation is set", () => {
    const result = serializeRccStructuredInput({
      clinicalInformation: "50yo M with hematuria",
      masses: [{ side: "Left", massSizeCm: 4.2 }],
    });
    expect(result.startsWith("Clinical information: 50yo M with hematuria\n\nMass 1:")).toBe(true);
  });

  // Test 35: studyDate only → Study date line above mass blocks
  it("prepends Study date line when studyDate is set", () => {
    const result = serializeRccStructuredInput({
      studyDate: "2026-04-26",
      masses: [{ side: "Right", massSizeCm: 3.0 }],
    });
    expect(result.startsWith("Study date: 2026-04-26\n\nMass 1:")).toBe(true);
  });

  // Test 36: both clinicalInformation and studyDate set → both lines, then masses
  it("prepends both Clinical information and Study date when both are set", () => {
    const result = serializeRccStructuredInput({
      clinicalInformation: "Prior left RCC s/p partial nephrectomy",
      studyDate: "2026-04-26",
      masses: [{ side: "Left", massSizeCm: 2.5 }],
    });
    expect(result).toContain(
      "Clinical information: Prior left RCC s/p partial nephrectomy\nStudy date: 2026-04-26\n\nMass 1:"
    );
  });

  // Test 37: multi-line clinicalInformation is flattened to a single line
  it("flattens multi-line clinicalInformation to a single line", () => {
    const result = serializeRccStructuredInput({
      clinicalInformation: "  50yo M\n  with hematuria\n\nprior left RCC  ",
      masses: [{ side: "Left", massSizeCm: 4.2 }],
    });
    expect(result).toContain(
      "Clinical information: 50yo M with hematuria prior left RCC"
    );
    expect(result).not.toContain("Clinical information: 50yo M\n");
  });

  // Test 38: neither clinicalInformation nor studyDate set → no clinical context block
  it("omits the clinical context block when both fields are unset", () => {
    const result = serializeRccStructuredInput({
      masses: [{ side: "Left", massSizeCm: 4.2 }],
    });
    expect(result).not.toContain("Clinical information");
    expect(result).not.toContain("Study date");
    expect(result.startsWith("Mass 1:")).toBe(true);
  });
});

describe("hasMinimumStructuredFields", () => {
  // Test 15: single mass with side + size → true
  it("returns true when both side and massSizeCm are provided in the only mass", () => {
    expect(
      hasMinimumStructuredFields({
        masses: [{ side: "Left", massSizeCm: 4.2 }],
      })
    ).toBe(true);
  });

  // Test 16: single mass missing massSizeCm → false
  it("returns false when massSizeCm is missing", () => {
    expect(
      hasMinimumStructuredFields({ masses: [{ side: "Left" }] })
    ).toBe(false);
  });

  // Test 17: empty mass → false
  it("returns false for a single empty mass", () => {
    expect(hasMinimumStructuredFields({ masses: [{}] })).toBe(false);
  });

  // Test 18: empty masses array → false
  it("returns false when masses is an empty array", () => {
    expect(hasMinimumStructuredFields({ masses: [] })).toBe(false);
  });

  // Test 19: mixed completeness across masses → false
  it("returns false when at least one mass is missing required fields", () => {
    expect(
      hasMinimumStructuredFields({
        masses: [
          { side: "Right", massSizeCm: 3 },
          { side: "Left" },
        ],
      })
    ).toBe(false);
  });
});
