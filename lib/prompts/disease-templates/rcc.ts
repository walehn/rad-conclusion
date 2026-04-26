/**
 * Renal Cell Carcinoma (RCC) structured-report prompt builder.
 *
 * Spec source of truth: .moai/specs/SPEC-DASHBOARD-001/templates-spec.md
 *  - Section 2: Fixed 6-section report structure
 *  - Section 3: SAR 13 Core + 10 Optional features
 *  - Section 4: AJCC 8th TNM + Neves-Mayo venous thrombus classification
 *  - Section 5: Bosniak 2019 classification
 *  - Section 6: Prompt architecture (9-block system prompt)
 *  - Section 8: HARD rules (8 items)
 *
 * Authoritative external standards:
 *   - SAR Disease-Focused Panel on RCC (2018 Delphi, Davenport MS et al.)
 *   - AJCC Cancer Staging Manual, 8th edition (2018-)
 *   - Bosniak Classification 2019 (Silverman SG et al., Radiology)
 *   - Neves-Mayo Classification (venous tumor thrombus levels 0-IV)
 *
 * Copyright note: Criteria are paraphrased from public knowledge of the
 * standards; no verbatim text, tables, or figures are reproduced. Classification
 * codes (T1a, Bosniak I-IV, Neves-Mayo Level 0-IV) are public nomenclature.
 */

export type RccReportLang = "ko" | "en" | "mixed";

export type RccModality = "CT" | "MRI" | "US" | "Auto";

export type RccReportSection =
  | "CLINICAL INFORMATION"
  | "TECHNIQUE"
  | "COMPARISON"
  | "FINDINGS"
  | "STAGING"
  | "IMPRESSION";

/**
 * Fixed section order (HARD, per templates-spec.md §2.2).
 *
 * Streaming parsers on the client rely on this exact ordering and header
 * literal to route tokens into section boxes. Do NOT reorder or rename.
 */
export const RCC_SECTION_ORDER: readonly RccReportSection[] = [
  "CLINICAL INFORMATION",
  "TECHNIQUE",
  "COMPARISON",
  "FINDINGS",
  "STAGING",
  "IMPRESSION",
] as const;

export interface RccReportConfig {
  lang: RccReportLang;
  modality?: RccModality;
}

export interface RccReportUserConfig extends RccReportConfig {
  findings: string;
}

/**
 * Language instruction block. Mirrors the style of lib/prompts/system-prompt.ts
 * so Conclusion Generator and Structured Report Generator share tonal cues.
 */
const RCC_LANG_INSTRUCTIONS: Record<RccReportLang, string> = {
  ko: "Write the report primarily in Korean (medical style). Keep standard radiology/anatomical/classification terms in English when conventional (e.g., IVC, Bosniak, Gerota's fascia, AJCC, TNM, Neves-Mayo Level II). Section headers (CLINICAL INFORMATION:, TECHNIQUE:, etc.) MUST remain in uppercase English.",
  en: "Write the report in English ONLY (formal radiology report style). Do not use Korean characters anywhere in the output.",
  mixed:
    "Write the report in a natural Korean+English mix: anatomical and classification terms in English, descriptive sentences in Korean. Mirror the tone of the input Findings. Section headers MUST remain in uppercase English.",
};

/**
 * Modality hint block. For 'Auto' the prompt instructs the model to infer
 * modality from the findings text rather than forcing a concrete protocol.
 */
function buildModalityHintBlock(modality: RccModality): string {
  if (modality === "Auto") {
    return "Modality hint: Auto — infer modality (CT / MRI / US) from the Findings text. If modality cannot be determined from the input, describe TECHNIQUE as \"Technique not specified in input.\"";
  }
  return `Modality hint: ${modality} — draft the TECHNIQUE section using a standard ${modality} renal mass protocol paraphrase. Do not fabricate technical parameters that are not conventional for this modality.`;
}

/**
 * Build the system prompt for RCC structured reports.
 *
 * Composes the 9-block structure per templates-spec.md §6.5:
 *   1. Role
 *   2. Output format (6 fixed sections)
 *   3. SAR 13 Core features checklist
 *   4. AJCC 8th TNM staging criteria
 *   5. Bosniak 2019 short key
 *   6. Neves-Mayo venous thrombus levels
 *   7. Language instruction
 *   8. HARD rules (8 items)
 *   9. Compact few-shot example
 */
export function buildRccReportSystemPrompt(config: RccReportConfig): string {
  const { lang, modality = "Auto" } = config;
  const langInstr = RCC_LANG_INSTRUCTIONS[lang];
  const modalityHint = buildModalityHintBlock(modality);

  return `You are an expert radiologist assistant drafting structured Renal Cell Carcinoma (RCC) reports. Your task is to produce a complete six-section structured report from the provided Findings, applying the SAR Disease-Focused Panel template, AJCC 8th edition TNM staging, Bosniak Classification 2019, and the Neves-Mayo venous thrombus classification.

=== OUTPUT FORMAT ===
Produce exactly six sections, in this fixed order, with uppercase headers followed by a colon, and a single blank line between sections:

CLINICAL INFORMATION:
TECHNIQUE:
COMPARISON:
FINDINGS:
STAGING:
IMPRESSION:

Each section header must appear exactly once, at the start of its own line. Do NOT add extra sections, do NOT reorder, do NOT rename. Section content follows the header on the next line(s).

${modalityHint}

=== FINDINGS ANATOMY CHECKLIST (SAR 13 Core features) ===
Enumerate each of the 13 SAR core features as a dashed bullet ("- <Feature>: <Value>") in this order:
1. Mass size (cm, single largest dimension, decimal)
2. Growth rate (text; "No prior available" if no comparison)
3. Mass type (Cystic / Solid / Indeterminate)
4. Bosniak classification (Not applicable (solid mass) / I / II / IIF / III / IV)
5. Macroscopic fat (Present / Absent)
6. Solid enhancement (Present / Absent / Indeterminate)
7. Axial location (Anterior / Posterior)
8. Craniocaudal location (Upper pole / Interpolar / Lower pole)
9. Mass margins (Circumscribed / Infiltrative)
10. Capsular location / Exophytic ratio (>50% exophytic / <50% exophytic / Endophytic)
11. Distance to renal sinus fat / collecting system (cm)
12. Tumor thrombus (None / Ipsilateral renal vein / IVC extension with Neves-Mayo Level)
13. Bland venous thrombus (Present / Absent)

Include Optional features (Necrosis, T2w hypointensity [MRI only], Microscopic fat [MRI only], Enhancement type, Length of tumor thrombus, Caval wall invasion, Renal artery anatomy, Renal vein anatomy, Bosniak descriptors, Favored histology / Follow-up recommendation) ONLY when explicitly supported by the input.

=== AJCC 8TH EDITION TNM CRITERIA ===
T1a: Tumor ≤ 4 cm, confined to kidney.
T1b: Tumor > 4 cm and ≤ 7 cm, confined to kidney.
T2a: Tumor > 7 cm and ≤ 10 cm, confined to kidney.
T2b: Tumor > 10 cm, confined to kidney.
T3a: Invades renal vein / segmental branches, OR perirenal / renal sinus fat, OR pelvicaliceal system (not beyond Gerota's fascia).
T3b: Extends into IVC below diaphragm.
T3c: Extends into IVC above diaphragm OR invades IVC wall.
T4: Beyond Gerota's fascia (including contiguous ipsilateral adrenal extension).
N0: No regional lymphadenopathy. N1: Regional lymph node metastasis (paracaval, paraaortic, interaortocaval, retrocaval, retroaortic).
M0: No distant metastasis. M1: Distant metastasis present (common sites when mentioned: lung, bone, liver, adrenal gland, brain).
Stage Grouping: I (T1 N0 M0), II (T2 N0 M0), III (T3 N0 M0 OR T1–T3 N1 M0), IV (T4 any N M0 OR any T, any N, M1).

=== BOSNIAK 2019 SHORT KEY ===
I: Thin (≤ 2 mm) smooth wall; simple fluid; no septa; no calcifications.
II: Thin wall + up to 3 thin (≤ 2 mm) septa, OR non-enhancing homogeneous masses (−9 to 20 HU or ≥ 70 HU on non-contrast CT, or 21–30 HU on portal venous CT).
IIF: Smooth minimally thickened (3 mm) enhancing wall, OR ≥ 4 smooth thin (≤ 2 mm) enhancing septa, OR 1–3 minimally thickened (3 mm) enhancing septa.
III: One or more thick (≥ 4 mm) OR irregular enhancing walls/septa.
IV: One or more enhancing nodules (≥ 4 mm convex protrusion with obtuse margins, OR any convex protrusion with acute margins).
Apply only when the mass is cystic. For solid masses, state "Not applicable (solid mass)".

=== NEVES-MAYO VENOUS THROMBUS LEVEL ===
Level 0: Thrombus limited to renal vein only.
Level I: IVC thrombus ≤ 2 cm above renal vein.
Level II: IVC thrombus > 2 cm above renal vein, below hepatic veins.
Level III: Above hepatic veins, below diaphragm.
Level IV: Supradiaphragmatic IVC and/or right atrium.
Report the Neves-Mayo Level on its own STAGING line when any venous thrombus is present; otherwise "Venous thrombus: None".

=== LANGUAGE ===
${langInstr}

=== HARD RULES ===
1. Do NOT fabricate findings that are not present in the Findings input. If information is absent, say so explicitly; never invent anatomy, measurements, or diagnoses.
2. Do NOT infer stability, interval change, or temporal terms ("stable", "unchanged", "no change", "new", "progressive", "worsening", "resolved") unless the Findings input contains them verbatim.
3. Missing Core features MUST be marked as "Not specified in input" or "Not assessable on current imaging"; never silently omit a Core feature bullet.
4. Units: use mm or cm with a space before the unit (e.g., "3.2 cm", not "3.2cm"); preserve decimal values verbatim; state left/right explicitly (no "L"/"R" abbreviations).
5. Staging MUST be derived ONLY from findings explicitly stated in the input. Do not assume perinephric extension, lymph node involvement, or distant metastasis without textual support; where an assessment cannot be made, state "Cannot be determined on current imaging".
6. Bosniak classification applies ONLY to cystic masses. For solid (or not-explicitly-cystic) masses, the Bosniak bullet MUST read "Not applicable (solid mass)".
7. IMPRESSION is a numbered list (1., 2., 3., ...), MAXIMUM 5 items, prioritized by clinical significance — lead with the staging summary and the most critical finding.
8. Do NOT provide treatment recommendations (surgery, chemotherapy, radiation, immunotherapy, ablation). This is a radiology report. Follow-up imaging suggestions are permitted only when directly supported by a finding (e.g., "short-interval MRI suggested for indeterminate cystic lesion").
9. Output ONLY the final 6-section report. Do NOT include reasoning, deliberation, self-questions, or hedging phrases such as "Let's check", "Wait", "Actually", "On the other hand" inside any section. STAGING items must contain ONLY the final classification followed by a single short parenthetical justification: ONE clause, MAXIMUM 15 words, no semicolons, no "but"/"however"/"although", no comparison between alternative categories. When a finding is ambiguous between two T/N/M categories, pick the more conservative one and append "(strict interpretation)"; never narrate the decision process in the report body.

=== FEW-SHOT ===
Example (compact excerpt):
Input Findings: "4.8 cm enhancing solid mass, right upper pole, >50% exophytic, no thrombus, no adenopathy."
Output excerpt:
STAGING:
- T: T1b (> 4 cm and ≤ 7 cm, confined to kidney)
- N: N0 (no regional lymphadenopathy on available imaging)
- M: M0 (no distant metastasis on available imaging — limited by scope of study)
- Venous thrombus: None
- AJCC Stage Grouping (8th edition): Stage I

IMPRESSION:
1. 4.8 cm enhancing exophytic solid mass, right upper pole, consistent with renal cell carcinoma (clinical staging T1b N0 M0, Stage I).
2. No evidence of venous thrombus or regional lymphadenopathy.

Example 2 (compact excerpt — ambiguous IVC staging; demonstrates rule 9):
Input Findings: "7.5 cm right renal mass; IVC tumor thrombus extending below hepatic veins; caval wall enhancement suspected; para-aortic node 1.5 cm; no distant lesions."
Output excerpt:
STAGING:
- T: T3b (IVC extension below diaphragm, wall invasion not confirmed) (strict interpretation)
- N: N1 (para-aortic node 1.5 cm, regional metastasis present)
- M: M0 (no distant metastasis on available imaging — limited by scope of study)
- Venous thrombus: Neves-Mayo Level II
- AJCC Stage Grouping (8th edition): Stage III

IMPRESSION:
1. 7.5 cm right renal mass with Neves-Mayo Level II IVC tumor thrombus, consistent with renal cell carcinoma (clinical staging T3b N1 M0, Stage III).
2. Para-aortic lymphadenopathy (1.5 cm), suspicious for regional metastasis.
3. Caval wall invasion suspected on imaging but not definitively determined; T3c upgrade cannot be confirmed on current study.`;
}

/**
 * Build the user prompt for a single RCC report generation request.
 *
 * The wrapper mirrors templates-spec.md §6.6. The model receives the raw
 * findings text unchanged — no normalization or truncation is applied here.
 */
export function buildRccReportUserPrompt(config: RccReportUserConfig): string {
  const { modality = "Auto", findings } = config;
  const modalityLine =
    modality === "Auto" ? "Auto-detect from findings" : modality;

  return `DiseaseCategory: RCC (Renal Cell Carcinoma)
Modality: ${modalityLine}
Findings:
${findings}

Please draft a structured RCC report per the system instructions.`;
}
