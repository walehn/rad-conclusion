/**
 * Structured Report prompt dispatcher (SPEC-DASHBOARD-001, extended by SPEC-PROSTATE-001).
 *
 * Delegates system/user prompt construction to the disease-specific template
 * module that matches the requested DiseaseCategory. Currently dispatches to:
 *   - 'RCC'            → ./disease-templates/rcc.ts
 *   - 'ProstateCancer' → ./disease-templates/prostate.ts
 *
 * Unrecognised categories trigger the compile-time exhaustiveness check
 * (assertUnreachable) so the API layer can return a 400 response instead of
 * silently producing a malformed prompt.
 *
 * When adding a new disease category:
 *   1. Extend the DiseaseCategory union in ./disease-registry.ts
 *   2. Add a matching entry in DISEASE_REGISTRY
 *   3. Create ./disease-templates/<category>.ts with buildXxxReportSystemPrompt
 *      and buildXxxReportUserPrompt exports
 *   4. Add a new case to both switch statements below — the TypeScript
 *      exhaustiveness check (assertUnreachable) will flag the missing branch
 *      at compile time.
 */

import type { DiseaseCategory } from "./disease-registry";
import {
  buildRccReportSystemPrompt,
  buildRccReportUserPrompt,
  type RccModality,
  type RccReportLang,
} from "./disease-templates/rcc";
import {
  buildProstateReportSystemPrompt,
  buildProstateReportUserPrompt,
  type ProstateModality,
  type ProstateReportLang,
} from "./disease-templates/prostate";

/**
 * Output language for the structured-report body.
 *
 * RccReportLang and ProstateReportLang are both `"ko" | "en" | "mixed"`, so
 * either can be used as the alias source. The intersection (`& ProstateReportLang`)
 * is written explicitly so a future divergence in either template's language
 * enum is caught at compile time at this dispatch boundary.
 */
export type StructuredReportLang = RccReportLang & ProstateReportLang;

export interface StructuredReportConfig {
  /** Which disease category template to use. v0.1.0 accepts 'RCC' only. */
  diseaseCategory: DiseaseCategory;
  /** Output language for the report body. */
  lang: StructuredReportLang;
  /**
   * Optional modality hint. Strings not recognized by the chosen template
   * are normalized to 'Auto' by that template.
   */
  modality?: string;
}

export interface StructuredReportUserConfig extends StructuredReportConfig {
  /** Raw findings text from the user; passed through unchanged. */
  findings: string;
}

/**
 * Normalize a free-form modality string into the RCC template's enum.
 *
 * Unknown / empty values collapse to 'Auto' so the prompt instructs the
 * model to infer modality from the findings rather than forcing a mismatch.
 */
function toRccModality(modality: string | undefined): RccModality {
  switch (modality) {
    case "CT":
    case "MRI":
    case "US":
    case "Auto":
      return modality;
    default:
      return "Auto";
  }
}

/**
 * Normalize a free-form modality string into the prostate template's enum.
 *
 * Prostate v1 (SPEC-PROSTATE-001) is MRI-only. Non-MRI hints collapse to
 * "Auto" so the prompt instructs the model to infer rather than force a
 * mismatched modality.
 */
function toProstateModality(modality: string | undefined): ProstateModality {
  switch (modality) {
    case "MRI":
    case "Auto":
      return modality;
    case "CT":
    case "US":
      return "Auto";
    default:
      return "Auto";
  }
}

/**
 * Compile-time exhaustiveness helper. If a new DiseaseCategory variant is
 * added to the union without a matching case, TypeScript will flag the
 * offending switch as returning `never` at this call.
 */
function assertUnreachable(value: never): never {
  throw new Error(
    `Unsupported disease category: ${String(value)}. ` +
      "Currently supported: 'RCC' and 'ProstateCancer'. " +
      "Add a new branch in structured-report-prompt.ts to extend."
  );
}

/**
 * Build the system prompt for the requested disease category.
 */
export function buildReportSystemPrompt(
  config: StructuredReportConfig
): string {
  const { diseaseCategory, lang, modality } = config;

  switch (diseaseCategory) {
    case "RCC":
      return buildRccReportSystemPrompt({
        lang,
        modality: toRccModality(modality),
      });
    case "ProstateCancer":
      return buildProstateReportSystemPrompt({
        lang,
        modality: toProstateModality(modality),
      });
    default:
      return assertUnreachable(diseaseCategory);
  }
}

/**
 * Build the user prompt (with findings body) for the requested disease
 * category. Findings text is forwarded verbatim — the API layer is the
 * single place responsible for validating length/emptiness.
 */
export function buildReportUserPrompt(
  config: StructuredReportUserConfig
): string {
  const { diseaseCategory, lang, modality, findings } = config;

  switch (diseaseCategory) {
    case "RCC":
      return buildRccReportUserPrompt({
        lang,
        modality: toRccModality(modality),
        findings,
      });
    case "ProstateCancer":
      return buildProstateReportUserPrompt({
        lang,
        modality: toProstateModality(modality),
        findings,
      });
    default:
      return assertUnreachable(diseaseCategory);
  }
}
