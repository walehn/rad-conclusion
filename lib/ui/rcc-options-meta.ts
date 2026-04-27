/**
 * RCC option-set semantic metadata.
 *
 * SPEC-UI-001
 *
 * Maps Bosniak v2019 grades and RCC trajectory categories to their visual
 * semantic tone and short clinical sublabel for use with `RadioCardGroup`.
 * Color coding is a visual aid only; clinical decisions are the radiologist's
 * responsibility (see SPEC-UI-001 §1 disclaimer note).
 *
 * Source mappings:
 *   - Bosniak: SAR DFP §3.3 / Silverman 2019 — I/II benign, IIF surveillance,
 *     III surgical, IV malignant.
 *   - Trajectory: ACR CT/MR Renal mass surveillance categories.
 */

import {
  RCC_BOSNIAK,
  RCC_TRAJECTORY,
  type RccBosniak,
  type RccTrajectory,
} from "@/lib/prompts/disease-templates/rcc-fields";
import type {
  RadioCardOption,
  SemanticTone,
} from "@/components/ui/radio-card-group";

// ---------------------------------------------------------------------------
// Per-grade tone + sublabel maps
// ---------------------------------------------------------------------------

const BOSNIAK_TONE: Record<RccBosniak, SemanticTone> = {
  I: "success",
  II: "success",
  IIF: "warning",
  III: "orange",
  IV: "destructive",
};

const BOSNIAK_SUBLABEL: Record<RccBosniak, string> = {
  I: "Benign",
  II: "Benign",
  IIF: "Surveillance",
  III: "Surgical",
  IV: "Malignant",
};

const TRAJECTORY_TONE: Record<RccTrajectory, SemanticTone> = {
  New: "destructive",
  Increasing: "destructive",
  Stable: "neutral",
  Decreasing: "success",
};

const TRAJECTORY_SUBLABEL: Record<RccTrajectory, string> = {
  New: "Active growth",
  Increasing: "Active growth",
  Stable: "Stable",
  Decreasing: "Regression",
};

// ---------------------------------------------------------------------------
// Public option arrays (preserve label = value identity for domain terms)
// ---------------------------------------------------------------------------

/**
 * Bosniak v2019 cyst classification options with semantic tone and sublabel.
 * Label preserves the domain literal ("I", "II", "IIF", "III", "IV").
 */
export const RCC_BOSNIAK_RADIO_OPTIONS: ReadonlyArray<
  RadioCardOption<RccBosniak>
> = RCC_BOSNIAK.map((value) => ({
  value,
  label: value,
  sublabel: BOSNIAK_SUBLABEL[value],
  tone: BOSNIAK_TONE[value],
}));

/**
 * RCC mass trajectory options with semantic tone and sublabel.
 * Label preserves the domain literal ("New", "Increasing", "Stable",
 * "Decreasing").
 */
export const RCC_TRAJECTORY_RADIO_OPTIONS: ReadonlyArray<
  RadioCardOption<RccTrajectory>
> = RCC_TRAJECTORY.map((value) => ({
  value,
  label: value,
  sublabel: TRAJECTORY_SUBLABEL[value],
  tone: TRAJECTORY_TONE[value],
}));
