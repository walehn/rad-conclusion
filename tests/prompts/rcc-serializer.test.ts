import { describe, it, expect } from "vitest";
import {
  serializeRccStructuredInput,
  hasMinimumStructuredFields,
} from "@/lib/prompts/disease-templates/rcc-serializer";

describe("serializeRccStructuredInput", () => {
  // Test 1: Empty input → all 14 lines "Not specified in input"
  it("returns 14 lines all set to 'Not specified in input' for empty input", () => {
    const result = serializeRccStructuredInput({});
    const lines = result.split("\n");
    expect(lines).toHaveLength(14);
    for (const line of lines) {
      expect(line).toMatch(/Not specified in input$/);
    }
  });

  // Test 2: Solid mass + Bosniak III → Bosniak line forced to NA sentinel
  it("overrides Bosniak to NA sentinel when massType is Solid, ignoring user input", () => {
    const result = serializeRccStructuredInput({
      massType: "Solid",
      bosniak: "III",
    });
    expect(result).toContain(
      "- Bosniak: Not applicable (solid mass)"
    );
  });

  // Test 3: Cystic mass + Bosniak IIF → Bosniak shown as-is
  it("shows Bosniak IIF for Cystic mass", () => {
    const result = serializeRccStructuredInput({
      massType: "Cystic",
      bosniak: "IIF",
    });
    expect(result).toContain("- Bosniak: IIF");
  });

  // Test 4: Predominantly cystic + Bosniak III → Bosniak shown, no NA override
  it("shows Bosniak III for Predominantly cystic mass (no Solid override)", () => {
    const result = serializeRccStructuredInput({
      massType: "Predominantly cystic",
      bosniak: "III",
    });
    expect(result).toContain("- Bosniak: III");
    expect(result).not.toContain("Not applicable (solid mass)");
  });

  // Test 5: massSizeCm → formatted with " cm" (single space)
  it("formats massSizeCm with a single space before cm unit", () => {
    const result = serializeRccStructuredInput({ massSizeCm: 4.2 });
    expect(result).toContain("- Mass size: 4.2 cm");
  });

  // Test 6: distanceCm → formatted with " cm"
  it("formats distanceCm with a single space before cm unit", () => {
    const result = serializeRccStructuredInput({ distanceCm: 0.5 });
    expect(result).toContain("- Distance to collecting system: 0.5 cm");
  });

  // Test 7: thrombusKind "None" → "None" (no level)
  it("shows 'None' for thrombusKind None", () => {
    const result = serializeRccStructuredInput({ thrombusKind: "None" });
    expect(result).toContain("- Venous tumor thrombus: None");
  });

  // Test 8: thrombusKind "IVC" + thrombusLevel "II" → combined Neves-Mayo line
  it("combines IVC thrombus with Neves-Mayo level II", () => {
    const result = serializeRccStructuredInput({
      thrombusKind: "IVC",
      thrombusLevel: "II",
    });
    expect(result).toContain(
      "- Venous tumor thrombus: IVC, Neves-Mayo Level II"
    );
  });

  // Test 9: thrombusKind "Renal vein" + thrombusLevel "I" → combined line
  it("combines Renal vein thrombus with Neves-Mayo level I", () => {
    const result = serializeRccStructuredInput({
      thrombusKind: "Renal vein",
      thrombusLevel: "I",
    });
    expect(result).toContain(
      "- Venous tumor thrombus: Renal vein, Neves-Mayo Level I"
    );
  });

  // Test 10: thrombusKind "IVC" + thrombusLevel undefined → kind only
  it("shows only IVC when thrombusLevel is undefined", () => {
    const result = serializeRccStructuredInput({
      thrombusKind: "IVC",
      thrombusLevel: undefined,
    });
    expect(result).toContain("- Venous tumor thrombus: IVC");
    expect(result).not.toContain("Neves-Mayo");
  });

  // Test 11: All 14 fields populated → exact 14-line match
  it("serializes all 14 fields correctly with exact line values", () => {
    const result = serializeRccStructuredInput({
      side: "Right",
      massSizeCm: 3.5,
      growthRate: 0.8,
      massType: "Cystic",
      bosniak: "III",
      macroFat: "Absent",
      solidEnhancement: "Present",
      axial: "Lower pole",
      cranio: "Posterior",
      margins: "Smooth",
      exophytic: ">=50% exophytic",
      distanceCm: 1.2,
      thrombusKind: "Renal vein",
      thrombusLevel: "I",
      blandThrombus: "Present",
    });

    const expected = [
      "- Side: Right",
      "- Mass size: 3.5 cm",
      "- Mass type: Cystic",
      "- Bosniak: III",
      "- Axial location: Lower pole",
      "- Cranio-caudal location: Posterior",
      "- Margins: Smooth",
      "- Exophytic ratio: >=50% exophytic",
      "- Macroscopic fat: Absent",
      "- Solid enhancement: Present",
      "- Distance to collecting system: 1.2 cm",
      "- Venous tumor thrombus: Renal vein, Neves-Mayo Level I",
      "- Bland (non-tumor) thrombus: Present",
      "- Growth rate: 0.8",
    ].join("\n");

    expect(result).toBe(expected);
  });

  // Test 12: growthRate → no unit suffix
  it("serializes growthRate as a plain number without unit", () => {
    const result = serializeRccStructuredInput({ growthRate: 1.5 });
    expect(result).toContain("- Growth rate: 1.5");
    // Confirm no unit is appended
    expect(result).not.toMatch(/Growth rate: 1\.5 /);
  });
});

describe("hasMinimumStructuredFields", () => {
  // Test 13: three sub-cases
  it("returns true when both side and massSizeCm are provided", () => {
    expect(
      hasMinimumStructuredFields({ side: "Left", massSizeCm: 4.2 })
    ).toBe(true);
  });

  it("returns false when massSizeCm is missing", () => {
    expect(hasMinimumStructuredFields({ side: "Left" })).toBe(false);
  });

  it("returns false for empty input", () => {
    expect(hasMinimumStructuredFields({})).toBe(false);
  });
});
