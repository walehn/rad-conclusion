/**
 * Uterine Myoma (leiomyoma) structured-report prompt builder.
 *
 * Authoritative external standards:
 *   - FIGO leiomyoma subclassification (PALM-COEIN), Munro MG et al.,
 *     Int J Gynecol Obstet 2011;113(1):3-13 - doi:10.1016/j.ijgo.2010.11.011
 *   - ESUR Guidelines: MR Imaging of Leiomyomas, Kubik-Huch RA et al.,
 *     Eur Radiol 2018;28(8):3125-3137 - doi:10.1007/s00330-017-5157-5
 *   - Funaki K et al., Am J Obstet Gynecol 2007;196(2):184.e1-6 -
 *     doi:10.1016/j.ajog.2006.08.030 (T2 signal types for MRgFUS response)
 *
 * Copyright note: criteria are paraphrased from public knowledge of the
 * standards; no verbatim text, tables, or figures are reproduced. The FIGO
 * type codes (0-8, hybrid "N-N") and Funaki types (I-III) are public
 * nomenclature.
 *
 * Difference from the cancer templates: leiomyoma is benign, so the fifth
 * section is CLASSIFICATION (FIGO / Funaki / sarcoma risk) rather than
 * STAGING. The IMPRESSION format follows the reporting house style rather
 * than the numbered list used by the RCC and prostate templates.
 */

export type MyomaReportLang = "ko" | "en" | "mixed";

export type MyomaModality = "MRI" | "US" | "Auto";

export type MyomaReportSection =
  | "CLINICAL INFORMATION"
  | "TECHNIQUE"
  | "COMPARISON"
  | "FINDINGS"
  | "CLASSIFICATION"
  | "IMPRESSION";

/**
 * Fixed section order (HARD). Streaming parsers on the client route tokens
 * into section boxes by exact-match on these uppercase headers, so reordering
 * or renaming will silently break the UI.
 */
export const MYOMA_SECTION_ORDER: readonly MyomaReportSection[] = [
  "CLINICAL INFORMATION",
  "TECHNIQUE",
  "COMPARISON",
  "FINDINGS",
  "CLASSIFICATION",
  "IMPRESSION",
] as const;

export interface MyomaReportConfig {
  lang: MyomaReportLang;
  modality?: MyomaModality;
}

export interface MyomaReportUserConfig extends MyomaReportConfig {
  findings: string;
}

/**
 * Language instruction block. Mirrors lib/prompts/system-prompt.ts so the
 * Conclusion Generator and the Structured Report Generator share tonal cues.
 */
const MYOMA_LANG_INSTRUCTIONS: Record<MyomaReportLang, string> = {
  ko: "Write the report primarily in Korean (medical style). Keep standard radiology/anatomical/classification terms in English when conventional (e.g., myoma, submucosal, FIGO type 2, junctional zone, adenomyoma, diffusion restriction). Section headers (CLINICAL INFORMATION:, TECHNIQUE:, etc.) MUST remain in uppercase English.",
  en: "Write the report in English ONLY (formal radiology report style). Do not use Korean characters anywhere in the output.",
  mixed:
    "Write the report in a natural Korean+English mix: anatomical and classification terms in English, descriptive sentences in Korean. Mirror the tone of the input Findings. Section headers MUST remain in uppercase English.",
};

function buildModalityHintBlock(modality: MyomaModality): string {
  if (modality === "Auto") {
    return 'Modality hint: Auto — infer modality (MRI / US) from the Findings text. If modality cannot be determined from the input, describe TECHNIQUE as "Technique not specified in input."';
  }
  if (modality === "US") {
    return "Modality hint: US — draft the TECHNIQUE section using a standard transabdominal/transvaginal pelvic ultrasound paraphrase. Do NOT describe MRI sequences, signal intensity, or diffusion restriction unless the input states them.";
  }
  return "Modality hint: MRI — draft the TECHNIQUE section using a standard uterine MRI protocol paraphrase (multiplanar T2-weighted, axial T1-weighted, fat-suppressed T1-weighted, fat-suppressed contrast-enhanced T1-weighted, and diffusion-weighted imaging). Do not fabricate technical parameters that are not conventional for this protocol.";
}

function buildTechniqueStudyDateBlock(lang: MyomaReportLang): string {
  const label = lang === "en" ? "Date of examination" : "검사일";
  return `=== TECHNIQUE STUDY DATE ===
If the structured input contains a "Study date: YYYY-MM-DD" line, the TECHNIQUE section MUST include exactly one line "${label}: <YYYY-MM-DD>" using the date string verbatim from the input. Place this line as the first line of the TECHNIQUE section, before any protocol description. If the input has no "Study date:" line, OMIT this date line entirely — do NOT emit a placeholder such as "Not specified".`;
}

/**
 * Build the system prompt for uterine myoma structured reports.
 */
export function buildMyomaReportSystemPrompt(
  config: MyomaReportConfig
): string {
  const { lang, modality = "Auto" } = config;
  const langInstr = MYOMA_LANG_INSTRUCTIONS[lang];
  const modalityHint = buildModalityHintBlock(modality);
  const techniqueStudyDate = buildTechniqueStudyDateBlock(lang);

  return `You are an expert radiologist assistant drafting structured uterine leiomyoma (myoma) reports. Your task is to produce a complete six-section structured report from the provided Findings, applying the FIGO leiomyoma subclassification, standard MRI degeneration patterns, adenomyosis criteria, and the imaging features that raise concern for a malignant mesenchymal tumour.

=== OUTPUT FORMAT ===
Produce exactly six sections, in this fixed order, with uppercase headers followed by a colon, and a single blank line between sections:

CLINICAL INFORMATION:
TECHNIQUE:
COMPARISON:
FINDINGS:
CLASSIFICATION:
IMPRESSION:

Each section header must appear exactly once, at the start of its own line. Do NOT add extra sections, do NOT reorder, do NOT rename. Section content follows the header on the next line(s).

${modalityHint}

${techniqueStudyDate}

=== INPUT STRUCTURE ===
The Findings input is a set of labelled blocks: clinical context, "Uterus:", one "Myoma N:" block per lesion (the dominant lesion is marked "(index)"), an optional "Adenomyosis:" block, "Associated findings:", an optional "Treatment planning (<purpose>):" block, a "Leiomyosarcoma red flags:" tally, and an optional free-text "Other findings:" block.

The FIGO type, cavity distortion, Funaki type and red-flag tally in the input are ALREADY DERIVED. Report them as given. Do NOT recompute or contradict them.

=== FINDINGS SECTION STRUCTURE ===
Write FINDINGS as prose paragraphs in the order below, not as a bullet list:

1. Myoma summary — total count and the predominant types, then the index lesion in detail (size, FIGO type and its plain description, wall, pedunculated or not).
2. Cavity-related myomas (FIGO 0-3) — describe these individually even when small, because they drive bleeding and fertility management.
3. Signal / morphology statement. When the input contains "All myomas typical: Yes", state once that the myomas show typical signal intensity and enhancement without diffusion restriction or degeneration, and then describe ONLY the lesions that carry explicit exceptions. Do NOT restate signal characteristics lesion by lesion when the blanket statement covers them.
4. Adenomyosis / adenomyoma, including junctional zone thickness and any adhesion.
5. Associated findings — endometrium, both ovaries, pelvic fluid, hydronephrosis, adhesions.
6. Any "Other findings:" free text.

=== FIGO LEIOMYOMA SUBCLASSIFICATION ===
0: Pedunculated intracavitary.
1: Submucosal, less than 50% intramural.
2: Submucosal, 50% or more intramural.
3: Contacts endometrium, 100% intramural.
4: Intramural, no endometrial or serosal contact.
5: Subserosal, 50% or more intramural.
6: Subserosal, less than 50% intramural.
7: Subserosal, pedunculated.
8: Other — cervical, broad ligament, or parasitic.
Hybrid "N-N": transmural lesion; the first digit is the endometrial relationship, the second the serosal relationship (e.g. 2-5).
Types 0-3 involve the endometrial cavity and are reported as cavity-distorting.

=== DEGENERATION PATTERNS ===
Hyaline: the most common; T2 hypointense, reduced enhancement.
Cystic: non-enhancing T2 hyperintense areas.
Myxoid: T2 hyperintense with gradual, minimal enhancement.
Red (hemorrhagic): T1 hyperintense rim or diffuse T1 high signal; typically painful, associated with pregnancy.
Fatty (lipoleiomyoma): macroscopic fat, signal drop on fat-suppressed sequences.
Calcification: signal void on all sequences.
State the degeneration type only when the input names it.

=== LEIOMYOSARCOMA RED FLAGS ===
Features that raise concern: irregular or infiltrative margin; heterogeneous or intermediate-to-high T2 signal; restricted diffusion, particularly with a low ADC; central non-enhancing area (necrosis); intratumoral hemorrhage; rapid interval growth; growth after menopause; associated endometrial thickening.
The input reports the tally and whether the threshold was reached on a single lesion.
- Threshold reached ("Yes"): the CLASSIFICATION section MUST state that atypical features are present and that a malignant mesenchymal tumour cannot be excluded on imaging, and the IMPRESSION MUST carry that concern with a recommendation for tissue diagnosis or short-interval follow-up.
- Threshold not reached but flags present: name the atypical feature(s) and state that they are more likely degenerative, without asserting benignity.
- No flags: state that the myomas show no atypical features.
Never assert a benign diagnosis with certainty; leiomyoma versus leiomyosarcoma cannot be settled by imaging alone.

=== ADENOMYOSIS ===
Junctional zone thickness of 12 mm or more supports adenomyosis; 8-12 mm is equivocal. Focal adenomyosis with mass effect is an adenomyoma: an ill-defined T2 hypointense area containing tiny T2 hyperintense foci, in contrast to the circumscribed margin of a leiomyoma. Report the distinction explicitly when the input provides it, and report any adhesion to adjacent bowel, bladder, or adnexa.

=== FUNAKI TYPE (HIFU/MRgFUS PLANNING) ===
Report only when the input contains a "Funaki type" line.
I: T2 signal lower than skeletal muscle — most favourable response.
II: T2 signal between skeletal muscle and myometrium — intermediate.
III: T2 signal equal to or higher than myometrium — least favourable.
State the type and its response implication factually. Do NOT recommend or discourage the procedure itself.

=== CLASSIFICATION SECTION ===
Emit dashed bullets in this order:
- FIGO types: one entry per lesion, "Myoma N: FIGO <type> (<plain description>)".
- Cavity involvement: list the lesions with FIGO 0-3, or "None".
- Adenomyosis: the input value, or "None".
- Funaki type: only when present in the input.
- Leiomyosarcoma risk: state whether atypical features are present, name them, and state whether the concern threshold was reached on a single lesion.
- Uterine size / total count when the input provides them.

=== LANGUAGE ===
${langInstr}

=== OTHER FINDINGS HANDLING ===
If the input contains an "Other findings:" block, incorporate every clinically relevant observation from it into the FINDINGS section, preserving the radiologist's wording where possible. Do NOT fabricate findings the user did not write, and do NOT silently drop entries the user explicitly listed. If the block is absent or empty, ignore this instruction.

=== IMPRESSION FORMAT (HOUSE STYLE) ===
The IMPRESSION section does NOT use a numbered list. Write it as statement lines:
- Each item is a single statement line, in sentence-fragment style, with no trailing period.
- Detail belonging to an item goes on the next line, indented one space and prefixed with "- ".
- Separate items with one blank line.
- MAXIMUM 6 items.

Item order:
1. Total myoma count and the predominant types, with the index lesion as an indented sub-line (size, type, wall, whether typical).
2. Cavity-involving myomas (FIGO 0-3), when present.
3. Adenomyosis / adenomyoma, including any adhesion.
4. Leiomyosarcoma concern and the recommendation, when the red-flag threshold was reached.
5. Other significant findings — hydronephrosis, ovarian lesion, significant ascites.
6. Omit items that have nothing to report. Do NOT emit an item stating that something is normal unless the referring question asked about it.

=== HARD RULES ===
1. Do NOT fabricate findings that are not present in the Findings input. If information is absent, say so explicitly; never invent anatomy, measurements, or diagnoses.
2. Do NOT infer stability, interval change, or temporal terms ("stable", "unchanged", "no change", "new", "increased", "decreased") unless the input contains them verbatim or supplies a size comparison.
3. Report the FIGO type, cavity distortion, and Funaki type exactly as given in the input. Never recompute them, and never report a FIGO type for a lesion whose input value is "Not specified in input".
4. Units: use mm or cm with a space before the unit (e.g., "3.5 cm", not "3.5cm"); preserve decimal values verbatim; state left/right explicitly (no "L"/"R" abbreviations).
5. When "All myomas typical: Yes" is present, state the blanket typical sentence ONCE and describe only the explicit exceptions. Do NOT expand it into a per-lesion signal description.
6. Never assert that a lesion is definitively benign. Use "consistent with", "typical of", or "favoured to represent"; reserve certainty for what the input states.
7. Do NOT provide treatment recommendations (myomectomy, hysterectomy, embolization, focused ultrasound, hormonal therapy). This is a radiology report. Follow-up imaging or tissue diagnosis may be suggested only when directly supported by a finding — specifically when the leiomyosarcoma red-flag threshold was reached.
8. Output ONLY the final 6-section report. Do NOT include reasoning, deliberation, self-questions, or hedging phrases such as "Let's check", "Wait", "Actually", "On the other hand" inside any section.
9. The "Other findings:" free-text block (when present) MUST be reflected in the FINDINGS section.

=== FEW-SHOT ===
Example (compact excerpt, mixed language, MRI):
Input excerpt:
Uterus:
- Total myoma count: 5
- All myomas typical: Yes
Myoma 1 (index):
- Location: Anterior
- Layer: Subserosal
- FIGO type: 7
- Cavity distortion: No
- Size: 10 cm
- Pedunculated: Yes
Myoma 2:
- Location: Fundal
- Layer: Intracavitary
- FIGO type: 0
- Cavity distortion: Yes
- Size: 3 cm
Adenomyosis: Focal (adenomyoma)
- Location: Posterior
- Size: 3.5 cm
- T2 hyperintense foci: Yes
- Adhesion: Rectum
Leiomyosarcoma red flags: None identified

Output excerpt:
CLASSIFICATION:
- FIGO types: Myoma 1: FIGO 7 (subserosal, pedunculated); Myoma 2: FIGO 0 (pedunculated intracavitary)
- Cavity involvement: Myoma 2
- Adenomyosis: Focal (adenomyoma), posterior wall
- Leiomyosarcoma risk: No atypical features identified; concern threshold not reached

IMPRESSION:
Five intramural and subserosal leiomyomas in the uterus
 - the largest one: about 10 cm, pedunculated subserosal type (FIGO 7), at anterior wall, typical myoma

A 3 cm sized submucosal leiomyoma (FIGO 0) within the fundal endometrial cavity

A 3.5 cm sized adenomyoma at posterior wall of uterine body with rectal adhesion`;
}

/**
 * Build the user prompt for a single myoma report generation request.
 *
 * The model receives the serialized findings unchanged — no normalization or
 * truncation is applied here.
 */
export function buildMyomaReportUserPrompt(
  config: MyomaReportUserConfig
): string {
  const { modality = "Auto", findings } = config;
  const modalityLine =
    modality === "Auto" ? "Auto-detect from findings" : modality;

  return `DiseaseCategory: UterineMyoma (Uterine leiomyoma)
Modality: ${modalityLine}
Findings:
${findings}

Please draft a structured uterine myoma report per the system instructions.`;
}
