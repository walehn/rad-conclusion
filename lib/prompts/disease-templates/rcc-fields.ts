/**
 * RCC Structured Input Form — field enum constants and union types.
 *
 * This file defines the allowed values for the 14 input fields rendered in the
 * RCC Structured Input Form (`/structured-report` page).  It is intentionally
 * separate from `rcc.ts`, which owns output-report configuration types
 * (RccReportLang, RccModality, RccReportSection, …).
 *
 * Consumers:
 *   - Step 2: serialization helper (rcc-fields-serialize.ts)
 *   - Step 4: form component (RccInputForm.tsx)
 */

// ---------------------------------------------------------------------------
// Constant arrays (as const tuples for type inference)
// ---------------------------------------------------------------------------

export const RCC_SIDES = ["Right", "Left"] as const;

export const RCC_MASS_TYPES = ["Solid", "Cystic"] as const;

export const RCC_BOSNIAK = ["I", "II", "IIF", "III", "IV"] as const;

export const RCC_NEVES_MAYO = ["0", "I", "II", "III", "IV"] as const;

export const RCC_PRESENT_ABSENT = ["Present", "Absent"] as const;

export const RCC_PRESENT_ABSENT_INDET = [
  "Present",
  "Absent",
  "Indeterminate",
] as const;

export const RCC_AXIAL = ["Upper pole", "Interpolar", "Lower pole"] as const;

export const RCC_CRANIO = ["Anterior", "Posterior"] as const;

export const RCC_MARGINS = ["Smooth", "Irregular"] as const;

export const RCC_EXOPHYTIC = [
  "Endophytic",
  "<50% exophytic",
  ">=50% exophytic",
] as const;

export const RCC_THROMBUS_KINDS = ["None", "Renal vein", "IVC"] as const;

/**
 * Lymph node / metastasis presence enum (study-level).
 * Used for both Regional lymph nodes and Distant metastases.
 */
export const RCC_LN_M = ["Absent", "Present", "Indeterminate"] as const;

/**
 * Mass-level size comparison trajectory category.
 * Captures the change pattern between current and prior study.
 */
export const RCC_TRAJECTORY = [
  "New",
  "Increasing",
  "Stable",
  "Decreasing",
] as const;

/**
 * Regional lymph node station enum (RCC drainage anatomy).
 * Shown when `lymphNodes === "Present"`.
 */
export const RCC_LN_SITES = [
  "Renal hilar",
  "Retroperitoneal",
  "Pelvic",
  "Mediastinal",
  "Other",
] as const;

/**
 * Distant metastasis site enum (RCC clinical distribution).
 * Shown when `distantMetastases === "Present"`.
 */
export const RCC_MET_SITES = [
  "Lung",
  "Liver",
  "Bone",
  "Adrenal",
  "Brain",
  "Pancreas",
  "Other",
] as const;

// ---------------------------------------------------------------------------
// Union types derived from the constant arrays
// ---------------------------------------------------------------------------

export type RccSide = (typeof RCC_SIDES)[number];
export type RccMassType = (typeof RCC_MASS_TYPES)[number];
export type RccBosniak = (typeof RCC_BOSNIAK)[number];
export type RccNevesMayo = (typeof RCC_NEVES_MAYO)[number];
export type RccPresentAbsent = (typeof RCC_PRESENT_ABSENT)[number];
export type RccPresentAbsentIndet = (typeof RCC_PRESENT_ABSENT_INDET)[number];
export type RccAxial = (typeof RCC_AXIAL)[number];
export type RccCranio = (typeof RCC_CRANIO)[number];
export type RccMargins = (typeof RCC_MARGINS)[number];
export type RccExophytic = (typeof RCC_EXOPHYTIC)[number];
export type RccThrombus = (typeof RCC_THROMBUS_KINDS)[number];
export type RccLnM = (typeof RCC_LN_M)[number];
export type RccTrajectory = (typeof RCC_TRAJECTORY)[number];
export type RccLnSite = (typeof RCC_LN_SITES)[number];
export type RccMetSite = (typeof RCC_MET_SITES)[number];
