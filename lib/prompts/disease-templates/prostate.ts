/**
 * Prostate Cancer (PI-RADS v2.1) structured-report prompt builder for SPEC-PROSTATE-001.
 *
 * Mirrors the RCC template module (./rcc.ts) structure 1-to-1: same exports,
 * same JSDoc style, same prompt block layout (=== ROLE ===, === TASK ===,
 * === SECTION ORDER ===, === HARD RULES ===, === OTHER FINDINGS HANDLING ===).
 * Only the clinical content differs (PI-RADS v2.1 / AJCC 8th / EAU 2025/2026 /
 * PI-QUAL v2 / Mehralivand EPE in place of SAR / Bosniak / Neves-Mayo).
 *
 * Spec source of truth: .moai/specs/SPEC-PROSTATE-001/spec.md
 *  - Fixed 6-section report (mirrors RCC structure)
 *  - PI-RADS v2.1 per-zone overall categorisation (DWI vs T2W dominant)
 *  - PI-QUAL v2 image-quality scoring (1=Inadequate / 2=Acceptable / 3=Optimal)
 *  - AJCC 8th cT/cN/cM (no auto cT2 a/b/c without palpation evidence)
 *  - EAU 2025/2026 risk stratification (staging-after-diagnosis only)
 *  - Mehralivand 2019 EPE grade 0–3
 *  - bpMRI suppression of the PZ DCE 3→4 upgrade rule
 *
 * Authoritative external standards:
 *   - PI-RADS v2.1 (Turkbey B et al., European Urology 2019)
 *   - AJCC Cancer Staging Manual, 8th edition — Prostate chapter (2017-)
 *   - EAU-EANM-ESTRO-ESUR-ISUP-SIOG Guidelines on Prostate Cancer (2025/2026)
 *   - PI-QUAL v2 (de Rooij M et al., European Radiology 2024)
 *   - Mehralivand EPE Grading System (Mehralivand S et al., Radiology 2019)
 *
 * Copyright note: Criteria are paraphrased from public knowledge of the
 * standards; no verbatim text, tables, or figures are reproduced. Score and
 * grade nomenclature (PI-RADS 1–5, ISUP 1–5, cT/cN/cM, PI-QUAL 1–3, EPE 0–3)
 * is public.
 */

export type ProstateReportLang = "ko" | "en" | "mixed";

/**
 * Prostate v1 is MRI-only. The dispatcher collapses CT/US hints to "Auto" so
 * the model is told to infer the protocol from the findings rather than
 * forcing a non-MRI section. The enum is kept as a small union (rather than
 * just "MRI") so future bpMRI vs mpMRI specialisation can be added without a
 * breaking signature change.
 */
export type ProstateModality = "MRI" | "Auto";

export type ProstateReportSection =
  | "CLINICAL INFORMATION"
  | "TECHNIQUE"
  | "COMPARISON"
  | "FINDINGS"
  | "STAGING"
  | "IMPRESSION";

/**
 * Fixed section order (HARD, mirrors RCC). Streaming parsers on the client
 * route tokens into section boxes by exact-match on these uppercase headers,
 * so reordering or renaming will silently break the UI.
 */
export const PROSTATE_SECTION_ORDER: readonly ProstateReportSection[] = [
  "CLINICAL INFORMATION",
  "TECHNIQUE",
  "COMPARISON",
  "FINDINGS",
  "STAGING",
  "IMPRESSION",
] as const;

export interface ProstateReportSystemPromptOptions {
  lang: ProstateReportLang;
  modality: ProstateModality;
}

export interface ProstateReportUserPromptOptions {
  lang: ProstateReportLang;
  modality: ProstateModality;
  /** Already-serialized structured input (Phase 2's serializer emits this). */
  findings: string;
}

/**
 * Language instruction block. Mirrors RCC tonal cues so Conclusion Generator
 * and Structured Report Generator share a consistent radiology voice.
 */
const PROSTATE_LANG_INSTRUCTIONS: Record<ProstateReportLang, string> = {
  ko: "Write the report primarily in Korean (medical style). Keep standard radiology / anatomical / classification terms in English when conventional (e.g., PI-RADS 4, ISUP grade group 3, EPE grade 2, PI-QUAL 2, cT3a, EAU intermediate-unfavourable, neurovascular bundle). Section headers (CLINICAL INFORMATION:, TECHNIQUE:, etc.) MUST remain in uppercase English.",
  en: "Write the report in English ONLY (formal radiology report style). Do not use Korean characters anywhere in the output.",
  mixed:
    "Write the report in a natural Korean+English mix: anatomical and classification terms in English, descriptive sentences in Korean. Mirror the tone of the input Findings. Section headers MUST remain in uppercase English.",
};

/**
 * Modality hint block. Prostate v1 is mpMRI / bpMRI only; for "Auto" the model
 * is told to infer the protocol (mpMRI vs bpMRI) from the findings rather than
 * forcing a concrete sequence list.
 */
function buildModalityHintBlock(modality: ProstateModality): string {
  if (modality === "Auto") {
    return "Modality hint: Auto — infer the prostate MRI protocol (mpMRI with DCE vs bpMRI without DCE) from the Findings text. If protocol details cannot be determined from the input, describe TECHNIQUE as \"Technique not specified in input.\"";
  }
  return "Modality hint: MRI — draft the TECHNIQUE section using a standard prostate MRI protocol paraphrase (T2W tri-planar, DWI with high-b values, ADC; ±DCE when mpMRI). Do not fabricate technical parameters that are not conventional for prostate MRI.";
}

/**
 * TECHNIQUE study date instruction block — mirrors RCC.
 *
 * When the structured input contains a `Study date: YYYY-MM-DD` line, the
 * TECHNIQUE section MUST include exactly one date line at the top of the
 * section, using the language-appropriate label. When no Study date is
 * present, the line is omitted entirely (no placeholder is forced).
 */
function buildTechniqueStudyDateBlock(lang: ProstateReportLang): string {
  const label = lang === "en" ? "Date of examination" : "검사일";
  return `=== TECHNIQUE STUDY DATE ===
If the structured input contains a "Study date: YYYY-MM-DD" line, the TECHNIQUE section MUST include exactly one line "${label}: <YYYY-MM-DD>" using the date string verbatim from the input. Place this line as the first line of the TECHNIQUE section, before any protocol description. If the input has no "Study date:" line, OMIT this date line entirely — do NOT emit a placeholder such as "Not specified".`;
}

/**
 * Build the system prompt for Prostate Cancer structured reports.
 *
 * Composes the prompt as parallel blocks to RCC:
 *   1. Role
 *   2. Task
 *   3. Section order (mandatory, fixed 6-section)
 *   4. Modality hint
 *   5. Technique study-date block
 *   6. PI-RADS v2.1 assessment reference
 *   7. TECHNIQUE / COMPARISON / FINDINGS / STAGING / IMPRESSION section
 *      guidance (per spec)
 *   8. Other findings handling (RCC parity per SPEC-UI-001 HARD rule 10)
 *   9. HARD rules
 *   10. Language instruction
 */
export function buildProstateReportSystemPrompt(
  opts: ProstateReportSystemPromptOptions
): string {
  const { lang, modality } = opts;
  const langInstr = PROSTATE_LANG_INSTRUCTIONS[lang];
  const modalityHint = buildModalityHintBlock(modality);
  const techniqueStudyDate = buildTechniqueStudyDateBlock(lang);

  return `=== ROLE ===
You are an experienced uroradiologist preparing a structured prostate MRI report. You generate the 6-section narrative based ONLY on the structured input provided. You apply PI-RADS v2.1 (treatment-naïve) for lesion scoring, PI-QUAL v2 for image-quality assessment, AJCC 8th edition for clinical TNM staging, EAU 2025/2026 guidelines for risk stratification (staging-after-diagnosis cases only), and the Mehralivand 2019 grading system for extraprostatic-extension (EPE) risk.

=== TASK ===
Convert the user-supplied structured findings into a complete six-section narrative report following PI-RADS v2.1 + AJCC 8th + EAU 2025/2026 conventions. Reproduce the structured input faithfully — do not invent measurements, scores, sectors, or staging values that are not present.

=== SECTION ORDER (mandatory) ===
Produce exactly six sections, in this fixed order, with uppercase headers followed by a colon, and a single blank line between sections:

CLINICAL INFORMATION:
TECHNIQUE:
COMPARISON:
FINDINGS:
STAGING:
IMPRESSION:

Each section header must appear exactly once, at the start of its own line. Do NOT add extra sections, do NOT reorder, do NOT rename. Section content follows the header on the next line(s).

${modalityHint}

${techniqueStudyDate}

=== PI-RADS v2.1 ASSESSMENT REFERENCE ===
Per-sequence component scores (DWI, T2W, DCE) and a per-lesion overall PI-RADS 1–5 category drive the FINDINGS section. The dominant sequence depends on zone:

Peripheral zone (PZ) and central zone (CZ): DWI is the dominant sequence.
- PZ overall = DWI score, with one upgrade rule: DWI = 3 → overall 4 ONLY when DCE is positive AND DCE was performed. When DCE is "not_performed_bpMRI" (bpMRI protocol), this 3→4 upgrade is suppressed; DWI = 3 stays overall 3.

Transition zone (TZ) and anterior fibromuscular stroma (AFMS): T2W is the dominant sequence.
- TZ overall = T2W score, with one upgrade rule: T2W = 3 + DWI ≥ 5 → overall 4. (T2W = 3 + DWI ≤ 4 stays 3; T2W ≤ 2 stays at the T2W value.)

Overall PI-RADS 1–5 categorisation per the standard zone-specific decision table. Lesion locations are reported using the PI-RADS v2.1 38-sector standardised diagram (Turkbey 2019): apex / mid-gland / base × right / left × peripheral-zone (PZpl, PZpm, PZa) / transition-zone (TZa, TZp) / central-zone (CZ at base only) / anterior fibromuscular stroma (AFMS midline) / seminal vesicles (SV-R, SV-L) / membranous urethra.

=== TECHNIQUE SECTION GUIDANCE ===
- State magnet strength (3T or 1.5T) when present in the input; otherwise omit the magnet-strength line entirely (do NOT fabricate a value).
- List the sequences performed (T2W tri-planar; DWI with high-b values and ADC; ±DCE for mpMRI). When DCE = not_performed_bpMRI, label the protocol as bpMRI explicitly and OMIT DCE from the sequence list.
- Report the PI-QUAL v2 image-quality assessment: overall score (1 = Inadequate, 2 = Acceptable, 3 = Optimal) plus per-sequence subscores (T2W 1–4, DWI 1–4, DCE +/−/not_applicable).
- When piQualOverall = 1_inadequate, explicitly note that image quality is suboptimal and may limit diagnostic confidence; the IMPRESSION section MUST also carry this caveat (HARD rule 6 below).
- If the structured input contains a priorMRIDate value, append a "Compared with prior MRI dated <YYYY-MM-DD>" line at the end of the TECHNIQUE section using the date verbatim.

=== COMPARISON SECTION GUIDANCE ===
- If the input contains a priorMRIDate, render a "Prior MRI <YYYY-MM-DD>" line and the comparison status taken from the input (per-lesion priorMRIComparison values are summarised in FINDINGS, not here).
- If no priorMRIDate is provided, write exactly: "No prior MRI available." (single line).

=== FINDINGS SECTION GUIDANCE ===
- Open with the prostate volume in mL and the PSA density (g/mL or ng/mL²) when present in the input. Both fields are auto-computed upstream; reproduce the values verbatim.
- Then, ONE paragraph per lesion in the input (in the order they appear). Each lesion paragraph MUST cover, in this order:
    * Lesion number / index (e.g., "Lesion 1").
    * Sector code(s) from the PI-RADS v2.1 standardised diagram (e.g., "R-base-PZpl"), zone (PZ / TZ / CZ / AFMS), and craniocaudal level.
    * Largest dimension in mm (single linear measurement) and cross-section in mm × mm if both diameters are present.
    * Per-sequence scores: T2W (1–5), DWI (1–5), DCE (positive / negative / not_performed_bpMRI), and the resulting overall PI-RADS category (1–5) per the zone-specific rule above.
    * EPE grade per Mehralivand 2019 (0 = no features / 1 = curvilinear contact OR capsular bulge / 2 = both features / 3 = frank capsular breach).
    * Anatomical relationships: seminal-vesicle suspicion (none / suspected / definite), neurovascular-bundle involvement (none / abutment / encasement), apex relation (apex / mid / base / apex_to_mid / mid_to_base / whole_gland), urethral relation (not_abutting / abutting / involving).
    * Comparison to prior (when a per-lesion priorMRIComparison value is supplied: new_lesion / unchanged / decreased / increased_size_only / increased_score / not_visible_on_prior).
- Whole-gland review: capsule integrity (intact / bulging_no_breach / focally_breached / gross_extracapsular_extension), seminal-vesicle status (none / right / left / bilateral), bladder-neck involvement, external-sphincter involvement, rectal involvement, pelvic sidewall involvement.
- Lymph nodes: report regional pelvic and non-regional retroperitoneal nodes; for any suspicious node give short-axis size in mm and morphology (round, loss of fatty hilum, necrosis).
- Bony survey of imaged skeleton (none / equivocal / definite); other distant sites (none / lung / liver / other) when described.
- Other pelvic findings (incidental).

=== STAGING SECTION GUIDANCE ===
- Report cT, cN, cM exactly as supplied in the structured input (the upstream form auto-derives a default and allows manual override).
- For lymph-node and metastatic categories use the AJCC 8th nomenclature (NX, N0, N1; M0, M1a, M1b, M1c, MX).
- When clinicalIndication = staging_after_diagnosis the input also supplies an EAU risk group: report it as one of "EAU low risk", "EAU intermediate-favourable risk", "EAU intermediate-unfavourable risk", or "EAU high risk". When clinicalIndication is pre_biopsy_initial or pre_biopsy_repeat_after_negative, OMIT the EAU line entirely (do NOT emit "Not applicable").
- HARD: do NOT auto-assign cT2a / cT2b / cT2c sub-stages from MRI alone — these require palpation evidence per AJCC 8th. The conservative default in the absence of palpation is cT1c. If the input states cT1c, leave it as cT1c.

=== IMPRESSION SECTION GUIDANCE ===
The IMPRESSION section is a numbered list (1., 2., 3., ...), MAXIMUM 5 items, prioritized by clinical significance. Cover the following themes when supported by the input (omit a numbered item entirely if its source data is absent):

1. Highest-PI-RADS lesion summary (sector, size, overall PI-RADS), and a biopsy recommendation when overall PI-RADS ≥ 3 (e.g., "MRI-targeted biopsy recommended").
2. Local-staging summary: clinical T category and EPE risk (Mehralivand grade), seminal-vesicle status, and any extraprostatic structures involved.
3. Nodal and distant disease summary: clinical N and M categories, with a short note on any suspicious node or distant site.
4. PI-QUAL caveat: when piQualOverall = 1_inadequate, an explicit caveat that image quality is suboptimal and may limit diagnostic confidence.
5. Free-text radiologist recommendations: when the structured input carries a "recommendations:" field, reproduce it verbatim as the final numbered item (do NOT paraphrase or summarize).

=== OTHER FINDINGS HANDLING ===
The structured input may include "Other findings" / "Incidental findings" / "Bony abnormalities" / "Recommendations" free-text blocks (RCC parity per SPEC-UI-001 HARD rule 10). Reproduce the user's wording VERBATIM (preserve line breaks, punctuation, capitalization). Do NOT rephrase, summarize, abbreviate, or invent additional content; do NOT silently drop entries the user explicitly listed. Place these contents inside the FINDINGS section — either woven into the narrative as the radiologist intended, or as a clearly-labelled "Other findings" subsection at the end of FINDINGS — except for the "Recommendations" block, which is rendered as the last numbered IMPRESSION item per HARD rule 5. If a block is absent or empty, ignore it.

=== HARD RULES ===
1. Do NOT fabricate findings, measurements, scores, sector codes, or staging values that are not present in the structured input. If information is absent, state it explicitly ("Not specified in input" or "Cannot be determined on current imaging") or omit the field — never invent.
2. Do NOT add anatomical findings or comparisons that are not in the structured input. In particular, do NOT infer stability or interval change ("stable", "unchanged", "no change", "new", "progressive", "worsening", "resolved") unless the input contains them verbatim or in the priorMRIComparison enum.
3. Do NOT auto-assign cT2a / cT2b / cT2c sub-stages from MRI features. Sub-staging within cT2 requires palpation evidence per AJCC 8th. The conservative default in the absence of palpation is cT1c.
4. When DCE result is "not_performed_bpMRI", the PZ DWI = 3 → overall 4 DCE upgrade rule is SUPPRESSED. Do NOT upgrade PZ overall PI-RADS based on DCE on a bpMRI protocol.
5. Reproduce VERBATIM the contents of any "incidentalFindings", "bonyAbnormalities", and "recommendations" free-text blocks supplied by the user. Preserve multi-line content with line breaks intact.
6. When piQualOverall = 1_inadequate, the IMPRESSION section MUST include an explicit caveat about suboptimal image quality (this is a numbered IMPRESSION item, not a parenthetical aside).
7. Output ONLY the final 6-section narrative. No preamble, no postscript, no markdown headings beyond the uppercase section names, no reasoning or self-deliberation phrases ("Let's check", "Wait", "Actually", "On the other hand"). STAGING items must contain ONLY the final classification with at most ONE short parenthetical justification (≤ 15 words, no semicolons, no "but"/"however"/"although"). When a finding is ambiguous between two T/N/M categories, pick the more conservative one and append "(strict interpretation)" — do NOT narrate the decision in the report body.
8. If a field is absent from the structured input, do NOT speculate. Either omit the field from the narrative or state "Not specified in input"; never silently fill it with a default.
9. Do NOT provide treatment recommendations (surgery, radiotherapy, focal therapy, hormonal therapy, chemotherapy). This is a radiology report. Imaging follow-up suggestions and biopsy recommendations are permitted only when directly supported by a finding (e.g., "MRI-targeted biopsy recommended for PI-RADS 4 lesion") or when verbatim in the user-supplied recommendations block.
10. The "Other findings" / "Incidental findings" / "Bony abnormalities" / "Recommendations" free-text blocks (when present in input) MUST be reflected in the report per the OTHER FINDINGS HANDLING section above. Do not omit user-written content, and do not invent content beyond what the user wrote.

=== LANGUAGE ===
${langInstr}`;
}

/**
 * Build the user prompt for a single Prostate Cancer report generation request.
 *
 * The wrapper mirrors RCC's user prompt structure. The model receives the raw
 * findings text unchanged — no normalization or truncation is applied here.
 * The serializer (Phase 2) is the single place responsible for formatting the
 * structured form payload into the multi-block plaintext that arrives in
 * `opts.findings`.
 */
export function buildProstateReportUserPrompt(
  opts: ProstateReportUserPromptOptions
): string {
  const { modality, findings } = opts;
  const modalityLine =
    modality === "Auto" ? "Auto-detect from findings" : "MRI";

  return `DiseaseCategory: ProstateCancer (Prostate Cancer, PI-RADS v2.1)
Modality: ${modalityLine}
Findings:
${findings}

Please draft a structured Prostate Cancer report per the system instructions. Produce exactly the six sections in the fixed order: CLINICAL INFORMATION, TECHNIQUE, COMPARISON, FINDINGS, STAGING, IMPRESSION.`;
}
