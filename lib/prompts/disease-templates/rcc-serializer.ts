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
  type RccLnM,
  type RccLnSite,
  type RccMetSite,
  type RccTrajectory,
  BOSNIAK_NA_SOLID,
  PRED_CYSTIC_NA_SOLID,
} from "./rcc-fields";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface RccMass {
  // client-only stable React key, ignored by serializer
  id?: string;
  side?: RccSide;
  massSizeCm?: number;
  growthRate?: number;
  massType?: RccMassType;
  cysticPredominant?: boolean;
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
  // Size comparison (mass-level, all optional)
  priorMassSizeCm?: number;
  priorStudyDate?: string; // YYYY-MM-DD
  trajectory?: RccTrajectory;
}

export interface RccStructuredInput {
  masses: RccMass[];
  // Study-level clinical context (all optional)
  clinicalInformation?: string;
  studyDate?: string; // YYYY-MM-DD
  // Study-level lymph node / metastasis fields (all optional)
  lymphNodes?: RccLnM;
  // Meaningful only when lymphNodes === "Present"
  lymphNodeSites?: RccLnSite[];
  lymphNodeShortAxisCm?: number;
  distantMetastases?: RccLnM;
  // Meaningful only when distantMetastases === "Present"
  metastasisSites?: RccMetSite[];
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

function bosniakLine(mass: RccMass): string {
  // When mass is Solid, always show the NA sentinel regardless of bosniak field.
  if (mass.massType === "Solid") {
    return BOSNIAK_NA_SOLID;
  }
  return strOrNotSpecified(mass.bosniak);
}

/**
 * Build the Predominantly cystic line value.
 * Mirrors the Bosniak NA-on-Solid pattern: a Solid mass always emits the NA
 * sentinel regardless of the cysticPredominant input. For Cystic masses the
 * boolean is rendered as "Yes" / "No"; undefined falls back to NOT_SPECIFIED.
 *  - massType "Solid"             → "Not applicable (solid mass)" (forced)
 *  - massType "Cystic" + true     → "Yes"
 *  - massType "Cystic" + false    → "No"
 *  - massType "Cystic" + undefined → "Not specified in input"
 *  - massType undefined           → "Not specified in input"
 */
function predominantlyCysticLine(mass: RccMass): string {
  if (mass.massType === "Solid") {
    return PRED_CYSTIC_NA_SOLID;
  }
  if (mass.cysticPredominant === undefined) {
    return NOT_SPECIFIED;
  }
  return mass.cysticPredominant ? "Yes" : "No";
}

function thrombusLine(mass: RccMass): string {
  const { thrombusKind, thrombusLevel } = mass;

  if (thrombusKind === undefined) {
    return NOT_SPECIFIED;
  }

  if (thrombusKind === "None") {
    return "None";
  }

  // Renal vein thrombus is by definition Neves-Mayo Level 0. Enforce this
  // invariant on serialization regardless of any stale thrombusLevel value
  // (e.g., from legacy fixtures).
  if (thrombusKind === "Renal vein") {
    return "Renal vein, Neves-Mayo Level 0";
  }

  // IVC thrombus: level is user-selected from {I, II, III, IV}.
  if (thrombusLevel !== undefined) {
    return `IVC, Neves-Mayo Level ${thrombusLevel}`;
  }
  return "IVC";
}

/**
 * Build the Size comparison line value.
 * Combines optional priorMassSizeCm, priorStudyDate, and trajectory.
 *  - priorSize only          → "<size> cm"
 *  - priorSize + date        → "<size> cm on <date>"
 *  - priorSize + trajectory  → "<size> cm, <trajectory>"
 *  - all three               → "<size> cm on <date>, <trajectory>"
 *  - trajectory only         → "<trajectory>"
 *  - none                    → "Not specified in input"
 */
function sizeComparisonLine(mass: RccMass): string {
  const { priorMassSizeCm, priorStudyDate, trajectory } = mass;

  if (
    priorMassSizeCm === undefined &&
    priorStudyDate === undefined &&
    trajectory === undefined
  ) {
    return NOT_SPECIFIED;
  }

  if (priorMassSizeCm !== undefined) {
    let head = `${priorMassSizeCm} cm`;
    if (priorStudyDate !== undefined) {
      head += ` on ${priorStudyDate}`;
    }
    if (trajectory !== undefined) {
      head += `, ${trajectory}`;
    }
    return head;
  }

  // priorMassSizeCm undefined → emit only what's available.
  // priorStudyDate alone is meaningless without a size, so prefer trajectory.
  if (trajectory !== undefined) {
    return trajectory;
  }

  // priorStudyDate alone (extreme edge): pass through.
  return priorStudyDate as string;
}

/**
 * Serialize a single mass into 16 fixed lines (no header).
 * Always outputs all 16 lines in canonical order.
 * Undefined fields produce "Not specified in input".
 */
function serializeRccMass(mass: RccMass): string[] {
  return [
    `- Side: ${strOrNotSpecified(mass.side)}`,
    `- Mass size: ${numCmOrNotSpecified(mass.massSizeCm)}`,
    `- Mass type: ${strOrNotSpecified(mass.massType)}`,
    `- Bosniak: ${bosniakLine(mass)}`,
    `- Predominantly cystic: ${predominantlyCysticLine(mass)}`,
    `- Axial location: ${strOrNotSpecified(mass.axial)}`,
    `- Cranio-caudal location: ${strOrNotSpecified(mass.cranio)}`,
    `- Margins: ${strOrNotSpecified(mass.margins)}`,
    `- Exophytic ratio: ${strOrNotSpecified(mass.exophytic)}`,
    `- Macroscopic fat: ${strOrNotSpecified(mass.macroFat)}`,
    `- Solid enhancement: ${strOrNotSpecified(mass.solidEnhancement)}`,
    `- Distance to collecting system: ${numCmOrNotSpecified(mass.distanceCm)}`,
    `- Venous tumor thrombus: ${thrombusLine(mass)}`,
    `- Bland (non-tumor) thrombus: ${strOrNotSpecified(mass.blandThrombus)}`,
    `- Growth rate: ${growthRateOrNotSpecified(mass.growthRate)}`,
    `- Size comparison: ${sizeComparisonLine(mass)}`,
  ];
}

/**
 * Build the Clinical context block lines (clinical information + study date).
 * Multi-line clinical information is flattened to a single line.
 * Returns [] when both fields are unset/empty.
 */
function clinicalContextBlock(input: RccStructuredInput): string[] {
  const lines: string[] = [];
  const info = input.clinicalInformation?.trim().replace(/\s+/g, " ");
  if (info) {
    lines.push(`Clinical information: ${info}`);
  }
  if (input.studyDate) {
    lines.push(`Study date: ${input.studyDate}`);
  }
  return lines;
}

/**
 * Build the Regional lymph nodes block lines.
 * Returns:
 *  - [] when lymphNodes is undefined (block omitted entirely)
 *  - single line for "Absent" / "Indeterminate"
 *  - header + sub-bullets for "Present"
 */
function lymphNodeBlock(input: RccStructuredInput): string[] {
  const { lymphNodes, lymphNodeSites, lymphNodeShortAxisCm } = input;

  if (lymphNodes === undefined) {
    return [];
  }

  if (lymphNodes !== "Present") {
    return [`Regional lymph nodes: ${lymphNodes}`];
  }

  // Present → header + 2 sub-bullets
  const sitesValue =
    lymphNodeSites !== undefined && lymphNodeSites.length > 0
      ? lymphNodeSites.join(", ")
      : NOT_SPECIFIED;

  return [
    "Regional lymph nodes: Present",
    `- Sites: ${sitesValue}`,
    `- Largest short axis: ${numCmOrNotSpecified(lymphNodeShortAxisCm)}`,
  ];
}

/**
 * Build the Distant metastases block lines.
 * Returns:
 *  - [] when distantMetastases is undefined (block omitted entirely)
 *  - single line for "Absent" / "Indeterminate"
 *  - header + sites sub-bullet for "Present"
 */
function metastasisBlock(input: RccStructuredInput): string[] {
  const { distantMetastases, metastasisSites } = input;

  if (distantMetastases === undefined) {
    return [];
  }

  if (distantMetastases !== "Present") {
    return [`Distant metastases: ${distantMetastases}`];
  }

  const sitesValue =
    metastasisSites !== undefined && metastasisSites.length > 0
      ? metastasisSites.join(", ")
      : NOT_SPECIFIED;

  return ["Distant metastases: Present", `- Sites: ${sitesValue}`];
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Serialize an RccStructuredInput into one block per mass plus an optional
 * study-level block (lymph nodes / distant metastases).
 *
 * Each mass block is prefixed with `Mass N:` and contains 16 canonical lines.
 * The study-level block is appended only when at least one of `lymphNodes`
 * or `distantMetastases` is defined; blocks are separated by a blank line.
 * An empty `masses` array with no study-level fields yields an empty string.
 */
export function serializeRccStructuredInput(input: RccStructuredInput): string {
  const blocks: string[] = [];

  const contextLines = clinicalContextBlock(input);
  if (contextLines.length > 0) {
    blocks.push(contextLines.join("\n"));
  }

  const massBlocks = input.masses.map((mass, idx) =>
    [`Mass ${idx + 1}:`, ...serializeRccMass(mass)].join("\n")
  );
  blocks.push(...massBlocks);

  const studyLevelLines = [...lymphNodeBlock(input), ...metastasisBlock(input)];
  if (studyLevelLines.length > 0) {
    blocks.push(studyLevelLines.join("\n"));
  }

  return blocks.join("\n\n");
}

/**
 * Returns true when at least one mass exists and every mass contains the
 * two mandatory fields (side + mass size) needed for a meaningful prompt.
 */
export function hasMinimumStructuredFields(input: RccStructuredInput): boolean {
  return (
    input.masses.length >= 1 &&
    input.masses.every(
      (m) => m.side !== undefined && m.massSizeCm !== undefined
    )
  );
}
