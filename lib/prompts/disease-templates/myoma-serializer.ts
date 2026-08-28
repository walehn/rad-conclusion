/**
 * Uterine Myoma Structured Input - serialization helpers.
 *
 * Converts a MyomaStructuredInput object into the plain-text block format the
 * prompt builder feeds to the model. All functions are pure (no I/O).
 *
 * Two behaviours differ from the RCC serializer and are deliberate:
 *
 *  1. `allTypical` suppression. Radiologists describe a myomatous uterus as
 *     "N myomas, all typical" and then detail only the lesions that change
 *     management. When `allTypical` is set, per-lesion signal fields that were
 *     left untouched are OMITTED rather than emitted as "Not specified in
 *     input", so a five-lesion study needs signal input on the exceptions only.
 *     A lesion that DOES carry an explicit signal value always emits it - an
 *     exception overrides the blanket statement.
 *
 *  2. Derived values are serialized alongside the raw ones. FIGO type, cavity
 *     distortion, Funaki type and the leiomyosarcoma red-flag tally are
 *     computed here from the same rules the form uses, so the model reports
 *     them rather than re-deriving them (and occasionally getting them wrong).
 */

import {
  deriveFigoType,
  deriveFunakiType,
  distortsCavity,
  MYOMA_RED_FLAG_LABELS,
  SARCOMA_LOW_ADC_THRESHOLD,
  SARCOMA_RED_FLAG_THRESHOLD,
  type MyomaAdenomyosisKind,
  type MyomaAdhesionSite,
  type MyomaCount,
  type MyomaDegeneration,
  type MyomaDiffusion,
  type MyomaEndometrium,
  type MyomaEnhancement,
  type MyomaFigoDesignation,
  type MyomaHydronephrosis,
  type MyomaIndication,
  type MyomaLayer,
  type MyomaMargin,
  type MyomaMenopausalStatus,
  type MyomaMyometrialFraction,
  type MyomaOvaryStatus,
  type MyomaPelvicFluid,
  type MyomaPriorTreatment,
  type MyomaPurpose,
  type MyomaT2Reference,
  type MyomaT2Signal,
  type MyomaTrajectory,
  type MyomaUterinePosition,
  type MyomaWall,
} from "./myoma-fields";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface MyomaLesion {
  /** client-only stable React key, ignored by the serializer */
  id?: string;

  // --- Geometry (set by one click on the uterus diagram) ---
  wall?: MyomaWall;
  layer?: MyomaLayer;
  pedunculated?: boolean;
  myometrialFraction?: MyomaMyometrialFraction;
  endometrialContact?: boolean;
  transmural?: boolean;
  serosalFraction?: MyomaMyometrialFraction;
  /**
   * Manual FIGO override. Takes precedence over the derived value so the
   * radiologist can always correct the diagram-derived code.
   */
  figoOverride?: MyomaFigoDesignation;

  // --- Size ---
  /** Largest dimension in cm. The only value the form cannot collect by click. */
  sizeCm?: number;
  /** Optional second and third dimensions for a three-axis measurement. */
  sizeCm2?: number;
  sizeCm3?: number;

  // --- Signal / morphology (all default to typical when `allTypical` is set) ---
  t2Signal?: MyomaT2Signal;
  degeneration?: MyomaDegeneration[];
  enhancement?: MyomaEnhancement;
  diffusion?: MyomaDiffusion;
  adcValue?: number;
  margin?: MyomaMargin;
  centralNecrosis?: boolean;
  intratumoralHemorrhage?: boolean;

  // --- HIFU/MRgFUS planning (asked only for that referral purpose) ---
  t2Reference?: MyomaT2Reference;

  // --- Comparison ---
  priorSizeCm?: number;
  priorStudyDate?: string; // YYYY-MM-DD
  trajectory?: MyomaTrajectory;
  /** Explicit rapid-growth call; the form shows the computed rate as a hint. */
  rapidGrowth?: boolean;
  /**
   * UI-only flag gating the comparison fields in the form - ignored by the
   * serializer, which relies solely on value presence (mirrors
   * RccMass.hasPriorStudy).
   */
  hasPriorStudy?: boolean;

  /** Free-text remark appended verbatim to this lesion's block. */
  note?: string;
}

export interface MyomaAdenomyosis {
  kind?: MyomaAdenomyosisKind;
  wall?: MyomaWall;
  sizeCm?: number;
  /** Junctional zone thickness in mm; >=12 mm supports adenomyosis. */
  junctionalZoneMm?: number;
  /** T2 hyperintense myometrial foci within the lesion. */
  t2CysticFoci?: boolean;
  adhesionSites?: MyomaAdhesionSite[];
}

export interface MyomaStructuredInput {
  // --- Clinical context ---
  clinicalInformation?: string;
  studyDate?: string; // YYYY-MM-DD
  indications?: MyomaIndication[];
  menopausalStatus?: MyomaMenopausalStatus;
  priorTreatments?: MyomaPriorTreatment[];
  /** Referral purpose; gates the treatment-planning block. */
  purpose?: MyomaPurpose;
  comparisonStudyDate?: string; // YYYY-MM-DD

  // --- Uterus ---
  uterinePosition?: MyomaUterinePosition;
  uterineLengthCm?: number;
  uterineApCm?: number;
  uterineTransverseCm?: number;

  // --- Myomas ---
  totalMyomaCount?: MyomaCount;
  /**
   * "All myomas show typical signal intensity and enhancement without
   * diffusion restriction or degeneration." Suppresses per-lesion signal
   * lines that were left untouched.
   */
  allTypical?: boolean;
  lesions: MyomaLesion[];

  // --- Adenomyosis / adenomyoma ---
  adenomyosis?: MyomaAdenomyosis;

  // --- Associated findings ---
  endometrium?: MyomaEndometrium;
  endometrialThicknessMm?: number;
  rightOvary?: MyomaOvaryStatus;
  leftOvary?: MyomaOvaryStatus;
  pelvicFluid?: MyomaPelvicFluid;
  hydronephrosis?: MyomaHydronephrosis;
  adhesionSites?: MyomaAdhesionSite[];

  // --- Purpose-conditional treatment planning ---
  /** HIFU/MRgFUS: skin-to-lesion distance in cm. */
  skinToLesionCm?: number;
  /** HIFU/MRgFUS: abdominal wall scar in the acoustic window. */
  abdominalWallScar?: boolean;
  /** HIFU/MRgFUS: interposed bowel in the acoustic window. */
  bowelInterposition?: boolean;
  /** UAE: suspected ovarian artery supply to the dominant lesion. */
  ovarianArterySupply?: boolean;

  /** Free-text block preserved verbatim and woven into FINDINGS. */
  otherFindings?: string;
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

function listOrNotSpecified(values: readonly string[] | undefined): string {
  return values !== undefined && values.length > 0
    ? values.join(", ")
    : NOT_SPECIFIED;
}

function yesNo(value: boolean | undefined): string {
  if (value === undefined) return NOT_SPECIFIED;
  return value ? "Yes" : "No";
}

/** "10 x 8 x 7 cm" when all three axes are present, "10 cm" for one. */
function sizeLine(
  primary: number | undefined,
  second?: number,
  third?: number
): string {
  if (primary === undefined) return NOT_SPECIFIED;
  const axes = [primary, second, third].filter(
    (v): v is number => v !== undefined
  );
  return `${axes.join(" x ")} cm`;
}

/**
 * Resolve the FIGO designation for a lesion: manual override first, then the
 * geometry-derived value.
 */
export function resolveLesionFigo(
  lesion: MyomaLesion
): MyomaFigoDesignation | undefined {
  if (lesion.figoOverride) return lesion.figoOverride;
  return deriveFigoType(lesion);
}

/**
 * Index of the index (dominant) lesion - the largest by maximum diameter.
 *
 * Ties and missing sizes fall back to the first lesion, matching how a report
 * reads when the radiologist has not measured every lesion.
 */
export function resolveIndexLesionIndex(lesions: MyomaLesion[]): number {
  let best = 0;
  let bestSize = -1;
  lesions.forEach((lesion, idx) => {
    const size = lesion.sizeCm ?? -1;
    if (size > bestSize) {
      best = idx;
      bestSize = size;
    }
  });
  return best;
}

// ---------------------------------------------------------------------------
// Leiomyosarcoma red flags
// ---------------------------------------------------------------------------

export interface MyomaRedFlagSummary {
  /** Lesion-prefixed red flags, e.g. "Myoma 2: Restricted diffusion". */
  flags: string[];
  /** Study-level context that raises suspicion but is not lesion-specific. */
  contextFlags: string[];
  /** Highest number of red flags carried by any single lesion. */
  maxPerLesion: number;
  /** True when one lesion reaches SARCOMA_RED_FLAG_THRESHOLD. */
  concerning: boolean;
}

/** Red flags carried by one lesion, as report wording. */
function lesionRedFlags(
  lesion: MyomaLesion,
  menopausalStatus: MyomaMenopausalStatus | undefined
): string[] {
  const flags: string[] = [];
  const L = MYOMA_RED_FLAG_LABELS;

  if (lesion.margin === "Irregular" || lesion.margin === "Infiltrative") {
    flags.push(L.irregularMargin);
  }
  if (lesion.t2Signal === "Heterogeneous" || lesion.t2Signal === "Hyperintense") {
    flags.push(L.t2Heterogeneous);
  }
  if (lesion.diffusion === "Restricted") {
    flags.push(L.restrictedDiffusion);
  }
  if (
    lesion.adcValue !== undefined &&
    lesion.adcValue <= SARCOMA_LOW_ADC_THRESHOLD
  ) {
    flags.push(`${L.lowAdc} (${lesion.adcValue} x10^-3 mm^2/s)`);
  }
  if (lesion.centralNecrosis === true) {
    flags.push(L.centralNecrosis);
  }
  if (lesion.intratumoralHemorrhage === true) {
    flags.push(L.intratumoralHemorrhage);
  }
  if (lesion.rapidGrowth === true) {
    flags.push(L.rapidGrowth);
  }
  // Growth after menopause is a distinct flag from rapid growth: a myoma is
  // expected to involute once oestrogen support is withdrawn.
  if (
    menopausalStatus === "Postmenopausal" &&
    (lesion.trajectory === "Increasing" || lesion.trajectory === "New")
  ) {
    flags.push(L.postmenopausalGrowth);
  }

  return flags;
}

/**
 * Collect leiomyosarcoma red flags across the study.
 *
 * The threshold is evaluated PER LESION: two atypical features on the same
 * mass is the finding that matters, whereas one feature each on two different
 * masses is common in a degenerating myomatous uterus.
 */
export function collectSarcomaRedFlags(
  input: MyomaStructuredInput
): MyomaRedFlagSummary {
  const flags: string[] = [];
  let maxPerLesion = 0;

  input.lesions.forEach((lesion, idx) => {
    const lesionFlags = lesionRedFlags(lesion, input.menopausalStatus);
    maxPerLesion = Math.max(maxPerLesion, lesionFlags.length);
    lesionFlags.forEach((flag) => flags.push(`Myoma ${idx + 1}: ${flag}`));
  });

  const contextFlags: string[] = [];
  if (input.endometrium === "Thickened") {
    contextFlags.push(MYOMA_RED_FLAG_LABELS.endometrialThickening);
  }

  return {
    flags,
    contextFlags,
    maxPerLesion,
    concerning: maxPerLesion >= SARCOMA_RED_FLAG_THRESHOLD,
  };
}

// ---------------------------------------------------------------------------
// Block builders
// ---------------------------------------------------------------------------

function clinicalContextBlock(input: MyomaStructuredInput): string[] {
  const lines: string[] = [];
  const info = input.clinicalInformation?.trim().replace(/\s+/g, " ");
  if (info) lines.push(`Clinical information: ${info}`);
  if (input.studyDate) lines.push(`Study date: ${input.studyDate}`);
  if (input.comparisonStudyDate) {
    lines.push(`Comparison study date: ${input.comparisonStudyDate}`);
  }
  if (input.indications && input.indications.length > 0) {
    lines.push(`Indication: ${input.indications.join(", ")}`);
  }
  if (input.menopausalStatus) {
    lines.push(`Menopausal status: ${input.menopausalStatus}`);
  }
  if (input.priorTreatments && input.priorTreatments.length > 0) {
    lines.push(`Prior treatment: ${input.priorTreatments.join(", ")}`);
  }
  if (input.purpose) lines.push(`Referral purpose: ${input.purpose}`);
  return lines;
}

function uterusBlock(input: MyomaStructuredInput): string[] {
  const hasSize =
    input.uterineLengthCm !== undefined ||
    input.uterineApCm !== undefined ||
    input.uterineTransverseCm !== undefined;

  const lines: string[] = [];
  if (input.uterinePosition) {
    lines.push(`- Position: ${input.uterinePosition}`);
  }
  if (hasSize) {
    lines.push(
      `- Uterine size: ${sizeLine(
        input.uterineLengthCm,
        input.uterineApCm,
        input.uterineTransverseCm
      )}`
    );
  }
  if (input.totalMyomaCount) {
    lines.push(`- Total myoma count: ${input.totalMyomaCount}`);
  }
  if (input.allTypical !== undefined) {
    lines.push(`- All myomas typical: ${yesNo(input.allTypical)}`);
  }

  return lines.length > 0 ? ["Uterus:", ...lines] : [];
}

/**
 * Serialize one lesion.
 *
 * Signal fields obey the `allTypical` rule: when the blanket statement is on
 * and the field was never touched, the line is dropped instead of shipping
 * "Not specified in input" for something the study-level line already covers.
 */
function serializeLesion(
  lesion: MyomaLesion,
  input: MyomaStructuredInput,
  isIndex: boolean,
  index: number
): string[] {
  const header = isIndex ? `Myoma ${index + 1} (index):` : `Myoma ${index + 1}:`;
  const figo = resolveLesionFigo(lesion);
  const suppressTypical = input.allTypical === true;

  const lines: string[] = [
    `- Location: ${strOrNotSpecified(lesion.wall)}`,
    `- Layer: ${strOrNotSpecified(lesion.layer)}`,
    `- FIGO type: ${strOrNotSpecified(figo)}`,
    `- Cavity distortion: ${figo ? yesNo(distortsCavity(figo)) : NOT_SPECIFIED}`,
    `- Size: ${sizeLine(lesion.sizeCm, lesion.sizeCm2, lesion.sizeCm3)}`,
  ];

  if (lesion.pedunculated !== undefined) {
    lines.push(`- Pedunculated: ${yesNo(lesion.pedunculated)}`);
  }

  // Signal / morphology group.
  if (lesion.t2Signal !== undefined || !suppressTypical) {
    lines.push(`- T2 signal: ${strOrNotSpecified(lesion.t2Signal)}`);
  }
  if (
    (lesion.degeneration !== undefined && lesion.degeneration.length > 0) ||
    !suppressTypical
  ) {
    const value =
      lesion.degeneration === undefined
        ? NOT_SPECIFIED
        : lesion.degeneration.length === 0
          ? "None"
          : lesion.degeneration.join(", ");
    lines.push(`- Degeneration: ${value}`);
  }
  if (lesion.enhancement !== undefined || !suppressTypical) {
    lines.push(`- Enhancement: ${strOrNotSpecified(lesion.enhancement)}`);
  }
  if (lesion.diffusion !== undefined || !suppressTypical) {
    lines.push(`- Diffusion: ${strOrNotSpecified(lesion.diffusion)}`);
  }
  if (lesion.adcValue !== undefined) {
    lines.push(`- ADC: ${lesion.adcValue} x10^-3 mm^2/s`);
  }
  if (lesion.margin !== undefined || !suppressTypical) {
    lines.push(`- Margin: ${strOrNotSpecified(lesion.margin)}`);
  }
  if (lesion.centralNecrosis !== undefined) {
    lines.push(`- Central non-enhancing area: ${yesNo(lesion.centralNecrosis)}`);
  }
  if (lesion.intratumoralHemorrhage !== undefined) {
    lines.push(
      `- Intratumoral hemorrhage: ${yesNo(lesion.intratumoralHemorrhage)}`
    );
  }

  // HIFU planning: emit the Funaki type derived from the reference comparison.
  if (lesion.t2Reference !== undefined) {
    const funaki = deriveFunakiType(lesion.t2Reference);
    lines.push(`- T2 relative to reference: ${lesion.t2Reference}`);
    lines.push(`- Funaki type: ${strOrNotSpecified(funaki)}`);
  }

  // Comparison.
  if (lesion.priorSizeCm !== undefined) {
    let comparison = `${lesion.priorSizeCm} cm`;
    if (lesion.priorStudyDate) comparison += ` on ${lesion.priorStudyDate}`;
    if (lesion.trajectory) comparison += `, ${lesion.trajectory}`;
    lines.push(`- Size comparison: ${comparison}`);
  } else if (lesion.trajectory !== undefined) {
    lines.push(`- Size comparison: ${lesion.trajectory}`);
  }
  if (lesion.rapidGrowth !== undefined) {
    lines.push(`- Rapid growth: ${yesNo(lesion.rapidGrowth)}`);
  }

  const note = lesion.note?.trim();
  if (note) lines.push(`- Note: ${note}`);

  return [header, ...lines];
}

function adenomyosisBlock(input: MyomaStructuredInput): string[] {
  const adeno = input.adenomyosis;
  if (!adeno || adeno.kind === undefined) return [];
  if (adeno.kind === "None") return ["Adenomyosis: None"];

  const lines = [
    `Adenomyosis: ${adeno.kind}`,
    `- Location: ${strOrNotSpecified(adeno.wall)}`,
    `- Size: ${numCmOrNotSpecified(adeno.sizeCm)}`,
    `- Junctional zone thickness: ${
      adeno.junctionalZoneMm !== undefined
        ? `${adeno.junctionalZoneMm} mm`
        : NOT_SPECIFIED
    }`,
  ];
  if (adeno.t2CysticFoci !== undefined) {
    lines.push(`- T2 hyperintense foci: ${yesNo(adeno.t2CysticFoci)}`);
  }
  if (adeno.adhesionSites !== undefined && adeno.adhesionSites.length > 0) {
    lines.push(`- Adhesion: ${adeno.adhesionSites.join(", ")}`);
  }
  return lines;
}

function associatedFindingsBlock(input: MyomaStructuredInput): string[] {
  const lines: string[] = [];
  if (input.endometrium) {
    const thickness =
      input.endometrialThicknessMm !== undefined
        ? ` (${input.endometrialThicknessMm} mm)`
        : "";
    lines.push(`- Endometrium: ${input.endometrium}${thickness}`);
  }
  if (input.rightOvary) lines.push(`- Right ovary: ${input.rightOvary}`);
  if (input.leftOvary) lines.push(`- Left ovary: ${input.leftOvary}`);
  if (input.pelvicFluid) lines.push(`- Pelvic fluid: ${input.pelvicFluid}`);
  if (input.hydronephrosis) {
    lines.push(`- Hydronephrosis: ${input.hydronephrosis}`);
  }
  if (input.adhesionSites !== undefined && input.adhesionSites.length > 0) {
    lines.push(`- Adhesion: ${input.adhesionSites.join(", ")}`);
  }
  return lines.length > 0 ? ["Associated findings:", ...lines] : [];
}

/**
 * Treatment-planning block, emitted only for the referral purposes that have
 * purpose-specific fields. Fields the purpose does not use are never asked for
 * by the form, so they are never serialized as "Not specified in input".
 */
function treatmentPlanningBlock(input: MyomaStructuredInput): string[] {
  const { purpose } = input;
  if (purpose === undefined) return [];

  const lines: string[] = [];

  if (purpose === "HIFU/MRgFUS") {
    lines.push(
      `- Skin-to-lesion distance: ${numCmOrNotSpecified(input.skinToLesionCm)}`,
      `- Abdominal wall scar in acoustic window: ${yesNo(
        input.abdominalWallScar
      )}`,
      `- Interposed bowel in acoustic window: ${yesNo(input.bowelInterposition)}`
    );
  }

  if (purpose === "Uterine artery embolization") {
    lines.push(
      `- Suspected ovarian artery supply: ${yesNo(input.ovarianArterySupply)}`
    );
    // Enhancement determines whether a lesion is devascularisable at all, so
    // it is restated here even though it also appears per lesion.
    const nonEnhancing = input.lesions
      .map((lesion, idx) => ({ lesion, idx }))
      .filter(
        ({ lesion }) => lesion.enhancement === "Non-enhancing (necrosis)"
      )
      .map(({ idx }) => `Myoma ${idx + 1}`);
    lines.push(
      `- Non-enhancing (non-targetable) lesions: ${
        nonEnhancing.length > 0 ? nonEnhancing.join(", ") : "None"
      }`
    );
  }

  if (purpose === "Myomectomy") {
    const cavityLesions = input.lesions
      .map((lesion, idx) => ({ figo: resolveLesionFigo(lesion), idx }))
      .filter(({ figo }) => distortsCavity(figo))
      .map(({ idx }) => `Myoma ${idx + 1}`);
    lines.push(
      `- Cavity-involving lesions (FIGO 0-3): ${
        cavityLesions.length > 0 ? cavityLesions.join(", ") : "None"
      }`
    );
  }

  if (lines.length === 0) return [];
  return [`Treatment planning (${purpose}):`, ...lines];
}

function sarcomaBlock(input: MyomaStructuredInput): string[] {
  const summary = collectSarcomaRedFlags(input);
  if (summary.flags.length === 0 && summary.contextFlags.length === 0) {
    return ["Leiomyosarcoma red flags: None identified"];
  }
  const lines = [
    `Leiomyosarcoma red flags: ${summary.flags.length} lesion feature(s), max ${summary.maxPerLesion} on a single lesion`,
  ];
  summary.flags.forEach((flag) => lines.push(`- ${flag}`));
  summary.contextFlags.forEach((flag) => lines.push(`- Study level: ${flag}`));
  lines.push(
    `- Threshold reached (>=${SARCOMA_RED_FLAG_THRESHOLD} on one lesion): ${
      summary.concerning ? "Yes" : "No"
    }`
  );
  return lines;
}

function otherFindingsBlock(input: MyomaStructuredInput): string[] {
  const text = input.otherFindings?.trim();
  if (!text) return [];
  return ["Other findings:", text];
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Serialize a MyomaStructuredInput into the block text consumed by the prompt.
 *
 * Block order is fixed: clinical context, uterus, one block per lesion,
 * adenomyosis, associated findings, treatment planning, sarcoma red flags,
 * other findings. Blocks with nothing to say are omitted entirely.
 */
export function serializeMyomaStructuredInput(
  input: MyomaStructuredInput
): string {
  const blocks: string[] = [];

  const push = (lines: string[]) => {
    if (lines.length > 0) blocks.push(lines.join("\n"));
  };

  push(clinicalContextBlock(input));
  push(uterusBlock(input));

  // With a single lesion the "(index)" marker carries no information, so it is
  // emitted only when there is actually a choice of dominant lesion.
  const indexIdx = resolveIndexLesionIndex(input.lesions);
  const markIndex = input.lesions.length > 1;
  input.lesions.forEach((lesion, idx) => {
    push(serializeLesion(lesion, input, markIndex && idx === indexIdx, idx));
  });

  push(adenomyosisBlock(input));
  push(associatedFindingsBlock(input));
  push(treatmentPlanningBlock(input));
  push(sarcomaBlock(input));
  push(otherFindingsBlock(input));

  return blocks.join("\n\n");
}

/**
 * Korean-labelled list of every required field still empty, so the UI can say
 * exactly what blocks the Generate button instead of disabling it silently.
 *
 * Required per lesion: wall, layer, a resolvable FIGO designation, and size.
 * The FIGO check is what catches a submucosal/subserosal lesion whose
 * myometrial-fraction chip was never pressed (1 vs 2, 5 vs 6 are otherwise
 * indistinguishable) and an intramural lesion with no endometrial-contact
 * answer (3 vs 4).
 */
export function getMissingMyomaFields(input: MyomaStructuredInput): string[] {
  const missing: string[] = [];

  if (input.lesions.length < 1) {
    missing.push("근종 1개 이상 (근종 추가 버튼을 눌러 추가)");
    return missing;
  }

  input.lesions.forEach((lesion, idx) => {
    const label = `근종 ${idx + 1}`;
    if (lesion.wall === undefined) {
      missing.push(`${label} — 위치 (자궁 벽/부위 선택)`);
    }
    if (lesion.layer === undefined) {
      missing.push(`${label} — 층 (장막하/근층내/점막하/강내)`);
    }
    if (resolveLesionFigo(lesion) === undefined) {
      missing.push(`${label} — FIGO type (근층내 비율 또는 내막 접촉 여부 선택)`);
    }
    if (lesion.sizeCm === undefined) {
      missing.push(`${label} — 크기 (cm)`);
    }
    // UAE: whether a lesion enhances decides whether embolization can reach
    // it at all, so the report is not actionable without it.
    if (
      input.purpose === "Uterine artery embolization" &&
      lesion.enhancement === undefined
    ) {
      missing.push(`${label} — 조영증강 (UAE 의뢰 시 필수)`);
    }
  });

  // HIFU/MRgFUS: the Funaki type predicts treatment response, so the index
  // (dominant) lesion must carry the T2 reference comparison it derives from.
  if (input.purpose === "HIFU/MRgFUS" && input.lesions.length > 0) {
    const indexIdx = resolveIndexLesionIndex(input.lesions);
    if (input.lesions[indexIdx].t2Reference === undefined) {
      missing.push(
        `근종 ${indexIdx + 1} — T2 기준 신호 (HIFU 의뢰 시 index 병변 필수, Funaki type 산출용)`
      );
    }
  }

  return missing;
}

/** True when every required field for a meaningful prompt is filled. */
export function hasMinimumMyomaFields(input: MyomaStructuredInput): boolean {
  return getMissingMyomaFields(input).length === 0;
}

/** Empty form state: one blank lesion, matching the RCC/prostate convention. */
export function createEmptyMyomaInput(): MyomaStructuredInput {
  return { lesions: [{}] };
}
