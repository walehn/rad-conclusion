/**
 * RCC Structured Input — serialization helpers.
 *
 * Converts an RccStructuredInput object into a plain-text representation
 * suitable for inclusion in LLM prompts.  All functions are pure (no I/O).
 */

import {
  type RccSide,
  type RccMassType,
  type RccBosniak,
  type RccNevesMayo,
  type RccPresentAbsent,
  type RccPresentAbsentIndet,
  type RccAxial,
  type RccCranio,
  type RccMargins,
  type RccExophytic,
  type RccThrombus,
  BOSNIAK_NA_SOLID,
} from "./rcc-fields";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface RccStructuredInput {
  side?: RccSide;
  massSizeCm?: number;
  growthRate?: number;
  massType?: RccMassType;
  bosniak?: RccBosniak;
  macroFat?: RccPresentAbsentIndet;
  solidEnhancement?: RccPresentAbsentIndet;
  axial?: RccAxial;
  cranio?: RccCranio;
  margins?: RccMargins;
  exophytic?: RccExophytic;
  distanceCm?: number;
  thrombusKind?: RccThrombus;
  thrombusLevel?: RccNevesMayo;
  blandThrombus?: RccPresentAbsent;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const NOT_SPECIFIED = "Not specified in input";

function strOrNotSpecified(value: string | undefined): string {
  return value !== undefined ? value : NOT_SPECIFIED;
}

function numCmOrNotSpecified(value: number | undefined): string {
  return value !== undefined ? `${value} cm` : NOT_SPECIFIED;
}

function growthRateOrNotSpecified(value: number | undefined): string {
  return value !== undefined ? String(value) : NOT_SPECIFIED;
}

function bosniakLine(input: RccStructuredInput): string {
  // When mass is Solid, always show the NA sentinel regardless of bosniak field.
  if (input.massType === "Solid") {
    return BOSNIAK_NA_SOLID;
  }
  return strOrNotSpecified(input.bosniak);
}

function thrombusLine(input: RccStructuredInput): string {
  const { thrombusKind, thrombusLevel } = input;

  if (thrombusKind === undefined) {
    return NOT_SPECIFIED;
  }

  if (thrombusKind === "None") {
    return "None";
  }

  // "Renal vein" | "IVC"
  if (thrombusLevel !== undefined) {
    return `${thrombusKind}, Neves-Mayo Level ${thrombusLevel}`;
  }
  return thrombusKind;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Serialize an RccStructuredInput object into 14 fixed lines.
 * Always outputs all 14 lines in canonical order.
 * Undefined fields produce "Not specified in input".
 */
export function serializeRccStructuredInput(input: RccStructuredInput): string {
  const lines = [
    `- Side: ${strOrNotSpecified(input.side)}`,
    `- Mass size: ${numCmOrNotSpecified(input.massSizeCm)}`,
    `- Mass type: ${strOrNotSpecified(input.massType)}`,
    `- Bosniak: ${bosniakLine(input)}`,
    `- Axial location: ${strOrNotSpecified(input.axial)}`,
    `- Cranio-caudal location: ${strOrNotSpecified(input.cranio)}`,
    `- Margins: ${strOrNotSpecified(input.margins)}`,
    `- Exophytic ratio: ${strOrNotSpecified(input.exophytic)}`,
    `- Macroscopic fat: ${strOrNotSpecified(input.macroFat)}`,
    `- Solid enhancement: ${strOrNotSpecified(input.solidEnhancement)}`,
    `- Distance to collecting system: ${numCmOrNotSpecified(input.distanceCm)}`,
    `- Venous tumor thrombus: ${thrombusLine(input)}`,
    `- Bland (non-tumor) thrombus: ${strOrNotSpecified(input.blandThrombus)}`,
    `- Growth rate: ${growthRateOrNotSpecified(input.growthRate)}`,
  ];

  return lines.join("\n");
}

/**
 * Returns true when the input contains at least the two mandatory fields
 * needed to produce a meaningful prompt context (side + mass size).
 */
export function hasMinimumStructuredFields(input: RccStructuredInput): boolean {
  return input.side !== undefined && input.massSizeCm !== undefined;
}
