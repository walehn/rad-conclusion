/**
 * Uterine Myoma Structured Input Form - field enum constants, union types,
 * and the FIGO type derivation rules.
 *
 * Mirrors the layout of rcc-fields.ts / prostate-fields.ts: this file owns the
 * allowed *input* values, while `myoma.ts` owns output-report configuration
 * (MyomaReportLang, MyomaReportSection, ...).
 *
 * The FIGO derivation helpers live here rather than in the form component so
 * that the serializer, the prompt builder, and the (future) uterus diagram
 * picker all resolve a lesion to the same FIGO type from the same rules.
 *
 * Authoritative standard:
 *   FIGO leiomyoma subclassification (PALM-COEIN), Munro MG et al., 2011.
 *   Codes 0-8 and the hybrid "N-N" notation are public nomenclature.
 */

// ---------------------------------------------------------------------------
// Constant arrays (as const tuples for type inference)
// ---------------------------------------------------------------------------

/**
 * Uterine wall / region a lesion is centred on.
 *
 * "Cervical", "Broad ligament" and "Parasitic" are grouped by FIGO into type 8
 * ("other"), so `deriveFigoType` short-circuits on them regardless of layer.
 */
export const MYOMA_WALLS = [
  "Anterior",
  "Posterior",
  "Fundal",
  "Right lateral",
  "Left lateral",
  "Lower uterine segment",
  "Cervical",
  "Broad ligament",
  "Parasitic",
] as const;

/** Walls that FIGO classifies as type 8 regardless of mural depth. */
export const MYOMA_OTHER_SITE_WALLS = [
  "Cervical",
  "Broad ligament",
  "Parasitic",
] as const;

/**
 * Mural layer the lesion occupies. Set by clicking a band on the uterus
 * diagram; `endometrialContact` disambiguates the two intramural bands.
 */
export const MYOMA_LAYERS = [
  "Intracavitary",
  "Submucosal",
  "Intramural",
  "Subserosal",
] as const;

/**
 * Proportion of the lesion sitting inside the myometrium. Only meaningful for
 * submucosal (FIGO 1 vs 2) and subserosal (FIGO 5 vs 6) lesions.
 */
export const MYOMA_MYOMETRIAL_FRACTIONS = [
  "<50% intramural",
  ">=50% intramural",
] as const;

/** FIGO leiomyoma subclassification codes. */
export const MYOMA_FIGO_TYPES = [
  "0",
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
] as const;

export const MYOMA_T2_SIGNALS = [
  "Hypointense",
  "Heterogeneous",
  "Hyperintense",
] as const;

/**
 * T2 signal of the lesion relative to reference tissues. Captured only when
 * the referral purpose is HIFU/MRgFUS, where it maps to the Funaki type.
 */
export const MYOMA_T2_REFERENCES = [
  "Lower than skeletal muscle",
  "Between skeletal muscle and myometrium",
  "Equal to or higher than myometrium",
] as const;

/** Funaki types I-III, used to predict HIFU/MRgFUS response. */
export const MYOMA_FUNAKI_TYPES = ["I", "II", "III"] as const;

export const MYOMA_DEGENERATIONS = [
  "Hyaline",
  "Cystic",
  "Myxoid",
  "Red (hemorrhagic)",
  "Fatty",
  "Calcification",
] as const;

export const MYOMA_ENHANCEMENTS = [
  "Typical",
  "Hypoenhancing",
  "Heterogeneous",
  "Non-enhancing (necrosis)",
] as const;

export const MYOMA_DIFFUSION = ["No restriction", "Restricted"] as const;

export const MYOMA_MARGINS = [
  "Circumscribed",
  "Irregular",
  "Infiltrative",
] as const;

export const MYOMA_TRAJECTORY = [
  "New",
  "Increasing",
  "Stable",
  "Decreasing",
] as const;

// --- Study level -----------------------------------------------------------

export const MYOMA_MENOPAUSAL_STATUS = [
  "Premenopausal",
  "Perimenopausal",
  "Postmenopausal",
] as const;

export const MYOMA_INDICATIONS = [
  "Abnormal uterine bleeding",
  "Pelvic pain",
  "Infertility",
  "Preoperative evaluation",
  "Follow-up",
  "Mass characterization",
] as const;

export const MYOMA_PRIOR_TREATMENTS = [
  "Myomectomy",
  "Uterine artery embolization",
  "HIFU/MRgFUS",
  "Hormonal therapy",
] as const;

export const MYOMA_UTERINE_POSITIONS = [
  "Anteverted",
  "Retroverted",
  "Midline",
] as const;

/**
 * Total lesion count. "Multiple (uncountable)" is a real reporting category -
 * beyond roughly five lesions radiologists stop counting and describe the
 * index lesion only.
 */
export const MYOMA_COUNTS = [
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "Multiple (uncountable)",
] as const;

export const MYOMA_ENDOMETRIUM = [
  "Normal",
  "Thickened",
  "Polyp",
  "Not assessable",
] as const;

export const MYOMA_OVARY_STATUS = [
  "Normal",
  "Lesion present",
  "Absent (resected)",
  "Not assessable",
] as const;

export const MYOMA_PELVIC_FLUID = [
  "None",
  "Minimal (physiologic)",
  "Moderate or more",
] as const;

export const MYOMA_HYDRONEPHROSIS = [
  "None",
  "Right",
  "Left",
  "Bilateral",
] as const;

export const MYOMA_ADHESION_SITES = [
  "Rectum",
  "Sigmoid colon",
  "Bladder",
  "Abdominal wall",
  "Adnexa",
] as const;

export const MYOMA_ADENOMYOSIS_KINDS = [
  "None",
  "Diffuse",
  "Focal (adenomyoma)",
] as const;

/**
 * Referral purpose. Gates which optional fields the form asks for, and which
 * treatment-planning block the serializer emits.
 */
export const MYOMA_PURPOSES = [
  "Myomectomy",
  "Uterine artery embolization",
  "HIFU/MRgFUS",
  "Follow-up",
  "Mass characterization",
] as const;

// ---------------------------------------------------------------------------
// Union types derived from the constant arrays
// ---------------------------------------------------------------------------

export type MyomaWall = (typeof MYOMA_WALLS)[number];
export type MyomaLayer = (typeof MYOMA_LAYERS)[number];
export type MyomaMyometrialFraction =
  (typeof MYOMA_MYOMETRIAL_FRACTIONS)[number];
export type MyomaFigoType = (typeof MYOMA_FIGO_TYPES)[number];
export type MyomaT2Signal = (typeof MYOMA_T2_SIGNALS)[number];
export type MyomaT2Reference = (typeof MYOMA_T2_REFERENCES)[number];
export type MyomaFunakiType = (typeof MYOMA_FUNAKI_TYPES)[number];
export type MyomaDegeneration = (typeof MYOMA_DEGENERATIONS)[number];
export type MyomaEnhancement = (typeof MYOMA_ENHANCEMENTS)[number];
export type MyomaDiffusion = (typeof MYOMA_DIFFUSION)[number];
export type MyomaMargin = (typeof MYOMA_MARGINS)[number];
export type MyomaTrajectory = (typeof MYOMA_TRAJECTORY)[number];
export type MyomaMenopausalStatus = (typeof MYOMA_MENOPAUSAL_STATUS)[number];
export type MyomaIndication = (typeof MYOMA_INDICATIONS)[number];
export type MyomaPriorTreatment = (typeof MYOMA_PRIOR_TREATMENTS)[number];
export type MyomaUterinePosition = (typeof MYOMA_UTERINE_POSITIONS)[number];
export type MyomaCount = (typeof MYOMA_COUNTS)[number];
export type MyomaEndometrium = (typeof MYOMA_ENDOMETRIUM)[number];
export type MyomaOvaryStatus = (typeof MYOMA_OVARY_STATUS)[number];
export type MyomaPelvicFluid = (typeof MYOMA_PELVIC_FLUID)[number];
export type MyomaHydronephrosis = (typeof MYOMA_HYDRONEPHROSIS)[number];
export type MyomaAdhesionSite = (typeof MYOMA_ADHESION_SITES)[number];
export type MyomaAdenomyosisKind = (typeof MYOMA_ADENOMYOSIS_KINDS)[number];
export type MyomaPurpose = (typeof MYOMA_PURPOSES)[number];

/**
 * A resolved FIGO designation: either a single code ("0".."8") or the hybrid
 * two-number notation for transmural lesions ("2-5"), where the first digit
 * describes the endometrial relationship and the second the serosal one.
 */
export type MyomaFigoDesignation = string;

// ---------------------------------------------------------------------------
// FIGO derivation
// ---------------------------------------------------------------------------

/**
 * The subset of lesion geometry the FIGO rules consume.
 *
 * Every field is optional: the derivation returns `undefined` rather than
 * guessing when the inputs cannot distinguish two codes. Asserting a code the
 * radiologist did not choose (e.g. defaulting an intramural lesion to 4, which
 * claims no endometrial contact) would change the clinical meaning.
 */
export interface MyomaFigoGeometry {
  wall?: MyomaWall;
  layer?: MyomaLayer;
  /** Pedunculated lesions are FIGO 0 (intracavitary) or 7 (subserosal). */
  pedunculated?: boolean;
  /** Submucosal: <50% -> 1, >=50% -> 2. Subserosal: >=50% -> 5, <50% -> 6. */
  myometrialFraction?: MyomaMyometrialFraction;
  /** Intramural only: true -> FIGO 3, false -> FIGO 4. */
  endometrialContact?: boolean;
  /** Lesion spans endometrium to serosa; produces the hybrid "N-N" code. */
  transmural?: boolean;
  /** Serosal component fraction for a transmural lesion (defaults to >=50%). */
  serosalFraction?: MyomaMyometrialFraction;
}

function isOtherSiteWall(wall: MyomaWall | undefined): boolean {
  return (
    wall !== undefined &&
    (MYOMA_OTHER_SITE_WALLS as readonly string[]).includes(wall)
  );
}

/** Submucosal component code: <50% intramural -> "1", >=50% -> "2". */
function submucosalCode(
  fraction: MyomaMyometrialFraction | undefined
): "1" | "2" | undefined {
  if (fraction === "<50% intramural") return "1";
  if (fraction === ">=50% intramural") return "2";
  return undefined;
}

/** Subserosal component code: >=50% intramural -> "5", <50% -> "6". */
function subserosalCode(
  fraction: MyomaMyometrialFraction | undefined
): "5" | "6" | undefined {
  if (fraction === ">=50% intramural") return "5";
  if (fraction === "<50% intramural") return "6";
  return undefined;
}

/**
 * Resolve lesion geometry to a FIGO designation.
 *
 * Returns `undefined` when the inputs are insufficient - specifically for a
 * submucosal or subserosal lesion with no myometrial fraction chosen (1 vs 2,
 * 5 vs 6 are indistinguishable), and for an intramural lesion with no
 * endometrial-contact answer (3 vs 4). The form surfaces those as required
 * fields rather than the serializer inventing a value.
 */
export function deriveFigoType(
  geometry: MyomaFigoGeometry
): MyomaFigoDesignation | undefined {
  const {
    wall,
    layer,
    pedunculated,
    myometrialFraction,
    endometrialContact,
    transmural,
    serosalFraction,
  } = geometry;

  // Cervical / broad ligament / parasitic lesions are FIGO 8 whatever their
  // mural depth, so this check precedes the layer switch.
  if (isOtherSiteWall(wall)) return "8";
  if (layer === undefined) return undefined;

  switch (layer) {
    case "Intracavitary":
      return "0";

    case "Submucosal": {
      // A pedunculated submucosal lesion has migrated into the cavity: FIGO 0.
      if (pedunculated) return "0";
      const endo = submucosalCode(myometrialFraction);
      if (endo === undefined) return undefined;
      if (!transmural) return endo;
      // Transmural: default the serosal component to >=50% intramural (5),
      // the common configuration for a lesion still centred in the wall.
      const sero = subserosalCode(serosalFraction) ?? "5";
      return `${endo}-${sero}`;
    }

    case "Intramural":
      if (endometrialContact === true) return "3";
      if (endometrialContact === false) return "4";
      return undefined;

    case "Subserosal": {
      if (pedunculated) return "7";
      return subserosalCode(myometrialFraction);
    }
  }
}

/**
 * True when the FIGO designation implies the lesion contacts or distorts the
 * endometrial cavity (types 0-3, or a hybrid whose endometrial component is
 * 0-3). Drives the cavity-distortion statement that matters for infertility
 * and abnormal uterine bleeding.
 */
export function distortsCavity(
  figo: MyomaFigoDesignation | undefined
): boolean {
  if (!figo) return false;
  const endometrialComponent = figo.split("-")[0];
  return ["0", "1", "2", "3"].includes(endometrialComponent);
}

// ---------------------------------------------------------------------------
// Funaki type (HIFU/MRgFUS response prediction)
// ---------------------------------------------------------------------------

/**
 * Map the lesion's T2 signal relative to reference tissue onto a Funaki type.
 *
 * Type I lesions (T2 darker than skeletal muscle) respond best to HIFU;
 * Type III (T2 at or above myometrium) respond poorly. Returns `undefined`
 * when the reference comparison was not recorded.
 */
export function deriveFunakiType(
  reference: MyomaT2Reference | undefined
): MyomaFunakiType | undefined {
  switch (reference) {
    case "Lower than skeletal muscle":
      return "I";
    case "Between skeletal muscle and myometrium":
      return "II";
    case "Equal to or higher than myometrium":
      return "III";
    default:
      return undefined;
  }
}

// ---------------------------------------------------------------------------
// Leiomyosarcoma red flags
// ---------------------------------------------------------------------------

/**
 * Number of concurrent red flags at which the report must raise the
 * possibility of a malignant mesenchymal tumour. A single atypical feature is
 * common in degenerating leiomyomas; two or more shifts the pretest
 * probability enough that tissue diagnosis or short-interval follow-up is
 * warranted.
 */
export const SARCOMA_RED_FLAG_THRESHOLD = 2;

/** Machine keys for the sarcoma red flags, paired with report wording. */
export const MYOMA_RED_FLAG_LABELS = {
  irregularMargin: "Irregular or infiltrative margin",
  t2Heterogeneous: "Heterogeneous or intermediate-to-high T2 signal",
  restrictedDiffusion: "Restricted diffusion",
  lowAdc: "Low ADC value",
  centralNecrosis: "Central non-enhancing area (necrosis)",
  intratumoralHemorrhage: "Intratumoral hemorrhage",
  rapidGrowth: "Rapid interval growth",
  postmenopausalGrowth: "Interval growth after menopause",
  endometrialThickening: "Associated endometrial thickening",
} as const;

export type MyomaRedFlagKey = keyof typeof MYOMA_RED_FLAG_LABELS;

/**
 * ADC (x10^-3 mm^2/s) at or below which diffusion is treated as a red flag.
 *
 * Reported cut-offs separating leiomyosarcoma from benign leiomyoma cluster
 * around 0.9-1.1; 0.9 is the conservative end, chosen so the flag fires on
 * clearly low values rather than on cellular leiomyomas.
 */
export const SARCOMA_LOW_ADC_THRESHOLD = 0.9;
