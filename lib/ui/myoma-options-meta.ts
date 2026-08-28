/**
 * Uterine myoma option-set semantic metadata.
 *
 * Maps FIGO types, trajectory categories, and the Funaki T2-reference
 * comparison to visual semantic tones and short clinical sublabels for use
 * with `RadioCardGroup`. Color coding is a visual aid only; clinical
 * decisions are the radiologist's responsibility (SPEC-UI-001 disclaimer).
 *
 * Source mappings:
 *   - FIGO 0-8: Munro 2011 (PALM-COEIN) - types 0-3 involve the endometrial
 *     cavity (drives AUB/fertility management), 4-7 do not, 8 is "other".
 *   - Trajectory: same growth semantics as the RCC template.
 *   - Funaki: type I responds best to HIFU/MRgFUS, type III worst.
 */

import {
  MYOMA_FIGO_TYPES,
  MYOMA_TRAJECTORY,
  MYOMA_T2_REFERENCES,
  type MyomaFigoType,
  type MyomaT2Reference,
  type MyomaTrajectory,
} from "@/lib/prompts/disease-templates/myoma-fields";
import type {
  RadioCardOption,
  SemanticTone,
} from "@/components/ui/radio-card-group";

// ---------------------------------------------------------------------------
// FIGO types
// ---------------------------------------------------------------------------

/**
 * Cavity-involving types (0-3) are highlighted in warning tone because they
 * change bleeding/fertility management; 4-7 are neutral anatomy; 8 covers
 * cervical / broad ligament / parasitic sites.
 */
const FIGO_TONE: Record<MyomaFigoType, SemanticTone> = {
  "0": "warning",
  "1": "warning",
  "2": "warning",
  "3": "warning",
  "4": "neutral",
  "5": "neutral",
  "6": "neutral",
  "7": "neutral",
  "8": "neutral",
};

const FIGO_SUBLABEL: Record<MyomaFigoType, string> = {
  "0": "Intracavitary",
  "1": "Submucosal <50% mural",
  "2": "Submucosal ≥50% mural",
  "3": "Contacts endometrium",
  "4": "Intramural",
  "5": "Subserosal ≥50% mural",
  "6": "Subserosal <50% mural",
  "7": "Pedunculated subserosal",
  "8": "Cervical / other",
};

export const MYOMA_FIGO_RADIO_OPTIONS: ReadonlyArray<
  RadioCardOption<MyomaFigoType>
> = MYOMA_FIGO_TYPES.map((value) => ({
  value,
  label: value,
  sublabel: FIGO_SUBLABEL[value],
  tone: FIGO_TONE[value],
}));

// ---------------------------------------------------------------------------
// Trajectory
// ---------------------------------------------------------------------------

const TRAJECTORY_TONE: Record<MyomaTrajectory, SemanticTone> = {
  New: "destructive",
  Increasing: "destructive",
  Stable: "neutral",
  Decreasing: "success",
};

const TRAJECTORY_SUBLABEL: Record<MyomaTrajectory, string> = {
  New: "Active growth",
  Increasing: "Active growth",
  Stable: "Stable",
  Decreasing: "Regression",
};

export const MYOMA_TRAJECTORY_RADIO_OPTIONS: ReadonlyArray<
  RadioCardOption<MyomaTrajectory>
> = MYOMA_TRAJECTORY.map((value) => ({
  value,
  label: value,
  sublabel: TRAJECTORY_SUBLABEL[value],
  tone: TRAJECTORY_TONE[value],
}));

// ---------------------------------------------------------------------------
// Funaki T2 reference comparison (HIFU/MRgFUS planning)
// ---------------------------------------------------------------------------

const T2_REFERENCE_TONE: Record<MyomaT2Reference, SemanticTone> = {
  "Lower than skeletal muscle": "success",
  "Between skeletal muscle and myometrium": "warning",
  "Equal to or higher than myometrium": "destructive",
};

const T2_REFERENCE_SUBLABEL: Record<MyomaT2Reference, string> = {
  "Lower than skeletal muscle": "Funaki I — best response",
  "Between skeletal muscle and myometrium": "Funaki II — intermediate",
  "Equal to or higher than myometrium": "Funaki III — poor response",
};

export const MYOMA_T2_REFERENCE_RADIO_OPTIONS: ReadonlyArray<
  RadioCardOption<MyomaT2Reference>
> = MYOMA_T2_REFERENCES.map((value) => ({
  value,
  label: value,
  sublabel: T2_REFERENCE_SUBLABEL[value],
  tone: T2_REFERENCE_TONE[value],
}));
