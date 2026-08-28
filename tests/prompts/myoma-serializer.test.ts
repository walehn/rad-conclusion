import { describe, it, expect } from "vitest";
import {
  collectSarcomaRedFlags,
  createEmptyMyomaInput,
  getMissingMyomaFields,
  hasMinimumMyomaFields,
  resolveIndexLesionIndex,
  resolveLesionFigo,
  serializeMyomaStructuredInput,
  type MyomaStructuredInput,
} from "@/lib/prompts/disease-templates/myoma-serializer";

/**
 * The reference case: the report format this template was built to reproduce.
 * Five myomas described as uniformly typical, a 10 cm pedunculated subserosal
 * index lesion, two cavity myomas, and a posterior adenomyoma with rectal
 * adhesion.
 */
function referenceCase(): MyomaStructuredInput {
  return {
    menopausalStatus: "Premenopausal",
    totalMyomaCount: "5",
    allTypical: true,
    lesions: [
      {
        wall: "Anterior",
        layer: "Subserosal",
        pedunculated: true,
        sizeCm: 10,
      },
      { wall: "Fundal", layer: "Intracavitary", sizeCm: 3 },
      {
        wall: "Fundal",
        layer: "Submucosal",
        myometrialFraction: "<50% intramural",
        sizeCm: 1,
      },
    ],
    adenomyosis: {
      kind: "Focal (adenomyoma)",
      wall: "Posterior",
      sizeCm: 3.5,
      t2CysticFoci: true,
      adhesionSites: ["Rectum"],
    },
    rightOvary: "Normal",
    leftOvary: "Normal",
    pelvicFluid: "Minimal (physiologic)",
  };
}

describe("serializeMyomaStructuredInput", () => {
  it("returns an empty string for a form with nothing filled in", () => {
    // A blank lesion still carries no facts, so the only block that survives
    // is the red-flag tally, which is unconditional by design.
    const result = serializeMyomaStructuredInput(createEmptyMyomaInput());
    expect(result).toBe(
      "Myoma 1:\n" +
        "- Location: Not specified in input\n" +
        "- Layer: Not specified in input\n" +
        "- FIGO type: Not specified in input\n" +
        "- Cavity distortion: Not specified in input\n" +
        "- Size: Not specified in input\n" +
        "- T2 signal: Not specified in input\n" +
        "- Degeneration: Not specified in input\n" +
        "- Enhancement: Not specified in input\n" +
        "- Diffusion: Not specified in input\n" +
        "- Margin: Not specified in input\n" +
        "\n" +
        "Leiomyosarcoma red flags: None identified"
    );
  });

  it("emits the derived FIGO type and cavity distortion per lesion", () => {
    const result = serializeMyomaStructuredInput(referenceCase());
    expect(result).toContain("Myoma 1 (index):");
    expect(result).toContain("- FIGO type: 7");
    expect(result).toContain("Myoma 2:\n- Location: Fundal");
    expect(result).toContain("- FIGO type: 0");
    expect(result).toContain("- FIGO type: 1");
  });

  it("marks the largest lesion as the index lesion", () => {
    const result = serializeMyomaStructuredInput(referenceCase());
    expect(result).toContain("Myoma 1 (index):");
    expect(result).not.toContain("Myoma 2 (index):");
    expect(result).not.toContain("Myoma 3 (index):");
  });

  // With one lesion the marker carries no information, so it is suppressed and
  // "(index)" always means a dominant lesion was actually chosen from several.
  it("omits the index marker when there is only one lesion", () => {
    const result = serializeMyomaStructuredInput({
      lesions: [{ wall: "Anterior", layer: "Intramural", sizeCm: 5 }],
    });
    expect(result).toContain("Myoma 1:");
    expect(result).not.toContain("(index)");
  });

  it("labels the index lesion by size, not by list position", () => {
    const input: MyomaStructuredInput = {
      lesions: [
        { wall: "Anterior", layer: "Intramural", sizeCm: 2 },
        { wall: "Posterior", layer: "Intramural", sizeCm: 9 },
      ],
    };
    const result = serializeMyomaStructuredInput(input);
    expect(result).toContain("Myoma 2 (index):");
    expect(result).not.toContain("Myoma 1 (index):");
  });

  // This is the mechanism that makes a five-lesion study fast to enter: with
  // the blanket statement on, untouched signal fields produce no line at all.
  it("omits untouched signal lines when allTypical is set", () => {
    const result = serializeMyomaStructuredInput(referenceCase());
    expect(result).toContain("- All myomas typical: Yes");
    expect(result).not.toContain("- T2 signal: Not specified in input");
    expect(result).not.toContain("- Degeneration: Not specified in input");
    expect(result).not.toContain("- Enhancement: Not specified in input");
    expect(result).not.toContain("- Diffusion: Not specified in input");
    expect(result).not.toContain("- Margin: Not specified in input");
  });

  // An explicit value on one lesion is the exception to the blanket
  // statement, so it must survive the suppression.
  it("keeps an explicit signal value even when allTypical is set", () => {
    const input = referenceCase();
    input.lesions[1].degeneration = ["Cystic"];
    input.lesions[1].t2Signal = "Heterogeneous";
    const result = serializeMyomaStructuredInput(input);
    expect(result).toContain("- Degeneration: Cystic");
    expect(result).toContain("- T2 signal: Heterogeneous");
    // The other lesions stay suppressed.
    expect(result).not.toContain("- Degeneration: Not specified in input");
  });

  it("emits every signal line when allTypical is not set", () => {
    const input = referenceCase();
    input.allTypical = false;
    const result = serializeMyomaStructuredInput(input);
    expect(result).toContain("- T2 signal: Not specified in input");
    expect(result).toContain("- Diffusion: Not specified in input");
    expect(result).toContain("- All myomas typical: No");
  });

  it("distinguishes an explicit empty degeneration list from an unset one", () => {
    const input: MyomaStructuredInput = {
      lesions: [{ wall: "Anterior", layer: "Intramural", degeneration: [] }],
    };
    expect(serializeMyomaStructuredInput(input)).toContain(
      "- Degeneration: None"
    );
  });

  it("serializes the adenomyoma block with its adhesion", () => {
    const result = serializeMyomaStructuredInput(referenceCase());
    expect(result).toContain("Adenomyosis: Focal (adenomyoma)");
    expect(result).toContain("- Location: Posterior");
    expect(result).toContain("- Size: 3.5 cm");
    expect(result).toContain("- T2 hyperintense foci: Yes");
    expect(result).toContain("- Adhesion: Rectum");
  });

  it("collapses the adenomyosis block to one line when absent", () => {
    const input = referenceCase();
    input.adenomyosis = { kind: "None" };
    const result = serializeMyomaStructuredInput(input);
    expect(result).toContain("Adenomyosis: None");
    expect(result).not.toContain("- Junctional zone thickness:");
  });

  it("omits the adenomyosis block entirely when never answered", () => {
    const input = referenceCase();
    delete input.adenomyosis;
    expect(serializeMyomaStructuredInput(input)).not.toContain("Adenomyosis:");
  });

  it("serializes associated findings only for answered fields", () => {
    const result = serializeMyomaStructuredInput(referenceCase());
    expect(result).toContain("Associated findings:");
    expect(result).toContain("- Right ovary: Normal");
    expect(result).toContain("- Pelvic fluid: Minimal (physiologic)");
    // Hydronephrosis was never answered, so it must not appear as a negative.
    expect(result).not.toContain("- Hydronephrosis:");
  });

  it("appends the endometrial thickness to the endometrium line", () => {
    const input = referenceCase();
    input.endometrium = "Thickened";
    input.endometrialThicknessMm = 14;
    expect(serializeMyomaStructuredInput(input)).toContain(
      "- Endometrium: Thickened (14 mm)"
    );
  });

  it("renders a three-axis uterine measurement", () => {
    const input = referenceCase();
    input.uterineLengthCm = 12;
    input.uterineApCm = 8;
    input.uterineTransverseCm = 7;
    expect(serializeMyomaStructuredInput(input)).toContain(
      "- Uterine size: 12 x 8 x 7 cm"
    );
  });

  it("preserves multi-line other findings verbatim", () => {
    const input = referenceCase();
    input.otherFindings = "Right adnexal cyst, 2 cm.\nDegenerative L5 changes.";
    const result = serializeMyomaStructuredInput(input);
    expect(result).toContain(
      "Other findings:\nRight adnexal cyst, 2 cm.\nDegenerative L5 changes."
    );
  });

  it("flattens multi-line clinical information to a single line", () => {
    const input = referenceCase();
    input.clinicalInformation = "Menorrhagia\n  for 6 months";
    expect(serializeMyomaStructuredInput(input)).toContain(
      "Clinical information: Menorrhagia for 6 months"
    );
  });
});

describe("treatment planning block", () => {
  it("is omitted when no referral purpose was chosen", () => {
    expect(serializeMyomaStructuredInput(referenceCase())).not.toContain(
      "Treatment planning"
    );
  });

  it("lists cavity-involving lesions for a myomectomy referral", () => {
    const input = referenceCase();
    input.purpose = "Myomectomy";
    const result = serializeMyomaStructuredInput(input);
    expect(result).toContain("Treatment planning (Myomectomy):");
    // Myoma 1 is FIGO 7 (no cavity involvement); myomas 2 and 3 are FIGO 0/1.
    expect(result).toContain("- Cavity-involving lesions (FIGO 0-3): Myoma 2, Myoma 3");
  });

  it("flags non-enhancing lesions for a UAE referral", () => {
    const input = referenceCase();
    input.purpose = "Uterine artery embolization";
    input.lesions[0].enhancement = "Non-enhancing (necrosis)";
    const result = serializeMyomaStructuredInput(input);
    expect(result).toContain(
      "- Non-enhancing (non-targetable) lesions: Myoma 1"
    );
  });

  it("reports None when every lesion enhances for a UAE referral", () => {
    const input = referenceCase();
    input.purpose = "Uterine artery embolization";
    expect(serializeMyomaStructuredInput(input)).toContain(
      "- Non-enhancing (non-targetable) lesions: None"
    );
  });

  it("emits the acoustic window fields for a HIFU referral", () => {
    const input = referenceCase();
    input.purpose = "HIFU/MRgFUS";
    input.skinToLesionCm = 4.5;
    input.abdominalWallScar = true;
    input.bowelInterposition = false;
    const result = serializeMyomaStructuredInput(input);
    expect(result).toContain("- Skin-to-lesion distance: 4.5 cm");
    expect(result).toContain("- Abdominal wall scar in acoustic window: Yes");
    expect(result).toContain("- Interposed bowel in acoustic window: No");
  });

  it("derives the Funaki type from the T2 reference comparison", () => {
    const input = referenceCase();
    input.purpose = "HIFU/MRgFUS";
    input.lesions[0].t2Reference = "Lower than skeletal muscle";
    const result = serializeMyomaStructuredInput(input);
    expect(result).toContain("- T2 relative to reference: Lower than skeletal muscle");
    expect(result).toContain("- Funaki type: I");
  });
});

describe("collectSarcomaRedFlags", () => {
  it("finds nothing in a uniformly typical study", () => {
    const summary = collectSarcomaRedFlags(referenceCase());
    expect(summary.flags).toEqual([]);
    expect(summary.maxPerLesion).toBe(0);
    expect(summary.concerning).toBe(false);
  });

  // Two features on the SAME lesion is the finding that matters clinically.
  it("reaches the threshold on two features of one lesion", () => {
    const input = referenceCase();
    input.lesions[0].margin = "Irregular";
    input.lesions[0].diffusion = "Restricted";
    const summary = collectSarcomaRedFlags(input);
    expect(summary.maxPerLesion).toBe(2);
    expect(summary.concerning).toBe(true);
    expect(summary.flags).toContain("Myoma 1: Irregular or infiltrative margin");
    expect(summary.flags).toContain("Myoma 1: Restricted diffusion");
  });

  // One feature each on two lesions is common in a degenerating myomatous
  // uterus and must NOT trip the recommendation.
  it("does not reach the threshold on one feature per lesion", () => {
    const input = referenceCase();
    input.lesions[0].margin = "Irregular";
    input.lesions[1].diffusion = "Restricted";
    const summary = collectSarcomaRedFlags(input);
    expect(summary.flags).toHaveLength(2);
    expect(summary.maxPerLesion).toBe(1);
    expect(summary.concerning).toBe(false);
  });

  it("flags an ADC at or below the cut-off, with the value", () => {
    const input = referenceCase();
    input.lesions[0].adcValue = 0.8;
    const summary = collectSarcomaRedFlags(input);
    expect(summary.flags).toContain(
      "Myoma 1: Low ADC value (0.8 x10^-3 mm^2/s)"
    );
  });

  it("does not flag an ADC above the cut-off", () => {
    const input = referenceCase();
    input.lesions[0].adcValue = 1.4;
    expect(collectSarcomaRedFlags(input).flags).toEqual([]);
  });

  // A myoma is expected to involute once oestrogen support is withdrawn, so
  // growth after menopause is its own flag independent of the rate.
  it("flags interval growth after menopause", () => {
    const input = referenceCase();
    input.menopausalStatus = "Postmenopausal";
    input.lesions[0].trajectory = "Increasing";
    const summary = collectSarcomaRedFlags(input);
    expect(summary.flags).toContain("Myoma 1: Interval growth after menopause");
  });

  it("does not flag interval growth before menopause", () => {
    const input = referenceCase();
    input.lesions[0].trajectory = "Increasing";
    expect(collectSarcomaRedFlags(input).flags).toEqual([]);
  });

  it("reports endometrial thickening as study-level context, not a lesion flag", () => {
    const input = referenceCase();
    input.endometrium = "Thickened";
    const summary = collectSarcomaRedFlags(input);
    expect(summary.contextFlags).toContain("Associated endometrial thickening");
    expect(summary.maxPerLesion).toBe(0);
    expect(summary.concerning).toBe(false);
  });

  it("serializes the tally and whether the threshold was reached", () => {
    const input = referenceCase();
    input.lesions[0].margin = "Irregular";
    input.lesions[0].centralNecrosis = true;
    const result = serializeMyomaStructuredInput(input);
    expect(result).toContain(
      "Leiomyosarcoma red flags: 2 lesion feature(s), max 2 on a single lesion"
    );
    expect(result).toContain("- Threshold reached (>=2 on one lesion): Yes");
  });
});

describe("resolveLesionFigo", () => {
  it("prefers a manual override over the derived value", () => {
    expect(
      resolveLesionFigo({
        wall: "Anterior",
        layer: "Subserosal",
        pedunculated: true,
        figoOverride: "5",
      })
    ).toBe("5");
  });

  it("falls back to the derived value with no override", () => {
    expect(
      resolveLesionFigo({
        wall: "Anterior",
        layer: "Subserosal",
        pedunculated: true,
      })
    ).toBe("7");
  });
});

describe("resolveIndexLesionIndex", () => {
  it("falls back to the first lesion when no size was measured", () => {
    expect(resolveIndexLesionIndex([{}, {}])).toBe(0);
  });

  it("keeps the earlier lesion on a size tie", () => {
    expect(resolveIndexLesionIndex([{ sizeCm: 4 }, { sizeCm: 4 }])).toBe(0);
  });

  it("prefers a measured lesion over an unmeasured one", () => {
    expect(resolveIndexLesionIndex([{}, { sizeCm: 1 }])).toBe(1);
  });
});

describe("getMissingMyomaFields", () => {
  it("asks for a lesion when the list is empty", () => {
    expect(getMissingMyomaFields({ lesions: [] })).toEqual([
      "근종 1개 이상 (근종 추가 버튼을 눌러 추가)",
    ]);
  });

  it("lists location, layer, FIGO and size for a blank lesion", () => {
    const missing = getMissingMyomaFields(createEmptyMyomaInput());
    expect(missing).toHaveLength(4);
    expect(missing[0]).toContain("위치");
    expect(missing[1]).toContain("층");
    expect(missing[2]).toContain("FIGO");
    expect(missing[3]).toContain("크기");
  });

  // The FIGO check is what catches the un-pressed myometrial-fraction chip:
  // location, layer and size are all filled, yet 5 and 6 remain ambiguous.
  it("blocks a subserosal lesion whose myometrial fraction was never chosen", () => {
    const missing = getMissingMyomaFields({
      lesions: [{ wall: "Anterior", layer: "Subserosal", sizeCm: 6 }],
    });
    expect(missing).toEqual([
      "근종 1 — FIGO type (근층내 비율 또는 내막 접촉 여부 선택)",
    ]);
  });

  // Purpose-conditional requirements: the referral decides which extra field
  // makes the report actionable.
  it("requires enhancement on every lesion for a UAE referral", () => {
    const input = referenceCase();
    input.purpose = "Uterine artery embolization";
    const missing = getMissingMyomaFields(input);
    expect(missing).toEqual([
      "근종 1 — 조영증강 (UAE 의뢰 시 필수)",
      "근종 2 — 조영증강 (UAE 의뢰 시 필수)",
      "근종 3 — 조영증강 (UAE 의뢰 시 필수)",
    ]);
    input.lesions.forEach((l) => (l.enhancement = "Typical"));
    expect(getMissingMyomaFields(input)).toEqual([]);
  });

  it("requires the T2 reference on the index lesion for a HIFU referral", () => {
    const input = referenceCase();
    input.purpose = "HIFU/MRgFUS";
    expect(getMissingMyomaFields(input)).toEqual([
      "근종 1 — T2 기준 신호 (HIFU 의뢰 시 index 병변 필수, Funaki type 산출용)",
    ]);
    // Only the index (largest) lesion needs it - not every lesion.
    input.lesions[0].t2Reference = "Lower than skeletal muscle";
    expect(getMissingMyomaFields(input)).toEqual([]);
  });

  // The UI-only comparison toggle must never leak into the prompt.
  it("ignores hasPriorStudy in serialization", () => {
    const input = referenceCase();
    input.lesions[0].hasPriorStudy = true;
    const result = serializeMyomaStructuredInput(input);
    expect(result).not.toContain("hasPriorStudy");
    expect(result).not.toContain("Prior study available");
  });

  it("accepts the reference case as complete", () => {
    expect(getMissingMyomaFields(referenceCase())).toEqual([]);
    expect(hasMinimumMyomaFields(referenceCase())).toBe(true);
  });

  it("numbers each incomplete lesion separately", () => {
    const missing = getMissingMyomaFields({
      lesions: [
        { wall: "Anterior", layer: "Intracavitary", sizeCm: 2 },
        { wall: "Posterior", layer: "Intramural" },
      ],
    });
    expect(missing.every((m) => m.startsWith("근종 2"))).toBe(true);
  });
});
