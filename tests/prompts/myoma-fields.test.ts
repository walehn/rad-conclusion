import { describe, it, expect } from "vitest";
import {
  MYOMA_FIGO_TYPES,
  SARCOMA_RED_FLAG_THRESHOLD,
  deriveFigoType,
  deriveFunakiType,
  distortsCavity,
  type MyomaFigoGeometry,
} from "@/lib/prompts/disease-templates/myoma-fields";

describe("deriveFigoType", () => {
  // The full FIGO 0-8 truth table. This is the contract the uterus diagram
  // picker, the serializer, and the prompt all depend on, so every code has an
  // explicit row rather than a spot check.
  const table: Array<{ figo: string; geometry: MyomaFigoGeometry }> = [
    { figo: "0", geometry: { wall: "Fundal", layer: "Intracavitary" } },
    {
      figo: "1",
      geometry: {
        wall: "Anterior",
        layer: "Submucosal",
        myometrialFraction: "<50% intramural",
      },
    },
    {
      figo: "2",
      geometry: {
        wall: "Anterior",
        layer: "Submucosal",
        myometrialFraction: ">=50% intramural",
      },
    },
    {
      figo: "3",
      geometry: {
        wall: "Posterior",
        layer: "Intramural",
        endometrialContact: true,
      },
    },
    {
      figo: "4",
      geometry: {
        wall: "Posterior",
        layer: "Intramural",
        endometrialContact: false,
      },
    },
    {
      figo: "5",
      geometry: {
        wall: "Fundal",
        layer: "Subserosal",
        myometrialFraction: ">=50% intramural",
      },
    },
    {
      figo: "6",
      geometry: {
        wall: "Fundal",
        layer: "Subserosal",
        myometrialFraction: "<50% intramural",
      },
    },
    {
      figo: "7",
      geometry: { wall: "Anterior", layer: "Subserosal", pedunculated: true },
    },
    { figo: "8", geometry: { wall: "Cervical", layer: "Intramural" } },
  ];

  it.each(table)("derives FIGO $figo", ({ figo, geometry }) => {
    expect(deriveFigoType(geometry)).toBe(figo);
  });

  it("covers every registered FIGO code in the truth table", () => {
    const covered = table.map((row) => row.figo).sort();
    expect(covered).toEqual([...MYOMA_FIGO_TYPES].sort());
  });

  // Cervical / broad ligament / parasitic lesions are FIGO 8 whatever their
  // mural depth, so the site check has to precede the layer switch.
  it.each(["Cervical", "Broad ligament", "Parasitic"] as const)(
    "returns 8 for a %s lesion regardless of layer",
    (wall) => {
      expect(deriveFigoType({ wall, layer: "Subserosal" })).toBe("8");
      expect(deriveFigoType({ wall, layer: "Submucosal" })).toBe("8");
      expect(
        deriveFigoType({ wall, layer: "Subserosal", pedunculated: true })
      ).toBe("8");
    }
  );

  it("treats a pedunculated submucosal lesion as intracavitary (0)", () => {
    expect(
      deriveFigoType({
        wall: "Fundal",
        layer: "Submucosal",
        pedunculated: true,
      })
    ).toBe("0");
  });

  it("builds the hybrid code for a transmural lesion", () => {
    expect(
      deriveFigoType({
        wall: "Posterior",
        layer: "Submucosal",
        myometrialFraction: ">=50% intramural",
        transmural: true,
        serosalFraction: ">=50% intramural",
      })
    ).toBe("2-5");
    expect(
      deriveFigoType({
        wall: "Posterior",
        layer: "Submucosal",
        myometrialFraction: "<50% intramural",
        transmural: true,
        serosalFraction: "<50% intramural",
      })
    ).toBe("1-6");
  });

  it("defaults the serosal component of a transmural lesion to 5", () => {
    expect(
      deriveFigoType({
        wall: "Posterior",
        layer: "Submucosal",
        myometrialFraction: ">=50% intramural",
        transmural: true,
      })
    ).toBe("2-5");
  });

  // Returning undefined rather than guessing is the point: defaulting an
  // intramural lesion to 4 would assert no endometrial contact, which changes
  // fertility management.
  it("returns undefined when the inputs cannot distinguish two codes", () => {
    expect(deriveFigoType({})).toBeUndefined();
    expect(deriveFigoType({ wall: "Anterior" })).toBeUndefined();
    expect(
      deriveFigoType({ wall: "Anterior", layer: "Submucosal" })
    ).toBeUndefined();
    expect(
      deriveFigoType({ wall: "Anterior", layer: "Subserosal" })
    ).toBeUndefined();
    expect(
      deriveFigoType({ wall: "Anterior", layer: "Intramural" })
    ).toBeUndefined();
  });
});

describe("distortsCavity", () => {
  it.each(["0", "1", "2", "3"])("is true for FIGO %s", (figo) => {
    expect(distortsCavity(figo)).toBe(true);
  });

  it.each(["4", "5", "6", "7", "8"])("is false for FIGO %s", (figo) => {
    expect(distortsCavity(figo)).toBe(false);
  });

  // A hybrid lesion's cavity relationship is carried by the first digit.
  it("reads the endometrial component of a hybrid code", () => {
    expect(distortsCavity("2-5")).toBe(true);
    expect(distortsCavity("1-6")).toBe(true);
  });

  it("is false for an unresolved FIGO type", () => {
    expect(distortsCavity(undefined)).toBe(false);
  });
});

describe("deriveFunakiType", () => {
  it("maps the T2 reference comparison onto Funaki I-III", () => {
    expect(deriveFunakiType("Lower than skeletal muscle")).toBe("I");
    expect(deriveFunakiType("Between skeletal muscle and myometrium")).toBe(
      "II"
    );
    expect(deriveFunakiType("Equal to or higher than myometrium")).toBe("III");
  });

  it("returns undefined when the comparison was not recorded", () => {
    expect(deriveFunakiType(undefined)).toBeUndefined();
  });
});

describe("sarcoma constants", () => {
  // The threshold is what turns a tally into a recommendation, so pin it.
  it("requires two concurrent red flags on one lesion", () => {
    expect(SARCOMA_RED_FLAG_THRESHOLD).toBe(2);
  });
});
