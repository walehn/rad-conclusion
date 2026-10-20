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
 *  - MRI T stage reported apart from the DRE-based cT (AJCC 8th / EAU 2026),
 *    with cN/cM
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
 * Sentences the report must contain verbatim, per output language. Quoted in
 * English alone they came back in English inside Korean reports.
 */
interface ProstateFixedPhrases {
  /** COMPARISON body when no prior MRI date is supplied. */
  noPriorMri: string;
  /** STAGING body on a negative MRI without a staging override. */
  stagingNotApplicable: string;
  /** STAGING line in place of an EAU risk group for cM1 disease. */
  eauMetastatic: string;
  /** STAGING line when the input has no M1 evidence (cM not assessed). */
  mNotAssessed: string;
  /** IMPRESSION item 1 on a negative MRI. */
  negativeImpression: string;
  /**
   * IMPRESSION item 1 on a negative MRI with PI-QUAL 1: a non-diagnostic
   * scan must not read as reassurance. The only image-quality wording
   * allowed in IMPRESSION, and it names no PI-QUAL score.
   */
  limitedNegativeImpression: string;
  /**
   * TECHNIQUE protocol sentences: the institution's standard acquisition,
   * written out in full. Left to paraphrase a bare sequence list, the model
   * expanded it into scanner prose and invented a magnet strength.
   */
  techniqueBpMri: string;
  techniqueMpMri: string;
  /** Ending of the IMPRESSION item of a lesion listed under BIOPSY RECOMMENDATION. */
  targetedBiopsy: string;
}

const KO_FIXED_PHRASES: ProstateFixedPhrases = {
  noPriorMri: "비교할 이전 MRI 없음.",
  stagingNotApplicable:
    "해당 없음 — 음성 MRI로 AJCC 병기 분류 대상 병변 없음.",
  eauMetastatic: "전이성 질환 — 비전이성 질환 대상 EAU 위험군 해당 없음.",
  mNotAssessed: "M 병기는 골반 MRI로 평가하지 않음.",
  negativeImpression:
    "PI-RADS 3 이상 병변 없음. PSA 및 임상 추적 관찰 권장.",
  limitedNegativeImpression:
    "영상 품질 저하로 평가가 제한된 검사에서 PI-RADS 3 이상 병변은 보이지 않음. MRI 재검사 고려.",
  techniqueBpMri:
    "Biparametric MRI (bpMRI): axial/sagittal/coronal T2W, axial T1W, DWI (b = 0, 100, 1000, 1500 s/mm²) 및 ADC map. DCE 미시행.",
  techniqueMpMri:
    "Multiparametric MRI (mpMRI): axial/sagittal/coronal T2W, axial T1W, DWI (b = 0, 100, 1000, 1500 s/mm²), ADC map 및 DCE.",
  targetedBiopsy: "MRI 표적 생검 권고.",
};

const PROSTATE_FIXED_PHRASES: Record<ProstateReportLang, ProstateFixedPhrases> = {
  ko: KO_FIXED_PHRASES,
  en: {
    noPriorMri: "No prior MRI available.",
    stagingNotApplicable:
      "Not applicable — negative MRI; no measurable disease for AJCC categorization.",
    eauMetastatic:
      "Metastatic disease — EAU risk groups for non-metastatic disease not applicable.",
    mNotAssessed: "M category not assessed on pelvic MRI.",
    negativeImpression:
      "No PI-RADS 3 or higher lesion identified. Routine surveillance with PSA and clinical follow-up recommended.",
    limitedNegativeImpression:
      "No PI-RADS 3 or higher lesion identified on this examination of limited image quality. Repeat MRI should be considered.",
    techniqueBpMri:
      "Biparametric MRI (bpMRI): axial/sagittal/coronal T2W, axial T1W, and DWI (b = 0, 100, 1000, 1500 s/mm²) with ADC map. DCE not performed.",
    techniqueMpMri:
      "Multiparametric MRI (mpMRI): axial/sagittal/coronal T2W, axial T1W, DWI (b = 0, 100, 1000, 1500 s/mm²) with ADC map, and DCE.",
    targetedBiopsy: "MRI-targeted biopsy recommended.",
  },
  // Mixed reports write descriptive sentences in Korean.
  mixed: KO_FIXED_PHRASES,
};

/**
 * Modality hint block. Prostate v1 is mpMRI / bpMRI only. The serializer
 * derives the protocol and states it on an "MRI protocol:" line, so both
 * hints defer to that line rather than letting the model pick a default
 * (it otherwise writes "multiparametric" with DCE on every report).
 */
function buildModalityHintBlock(modality: ProstateModality): string {
  if (modality === "Auto") {
    return "Modality hint: Auto — take the prostate MRI protocol (mpMRI with DCE vs bpMRI without DCE) from the \"MRI protocol:\" line of the input and write the matching protocol sentence from TECHNIQUE SECTION GUIDANCE. If the input has no such line and protocol details cannot be determined, describe TECHNIQUE as \"Technique not specified in input.\"";
  }
  return "Modality hint: MRI — take the prostate MRI protocol from the \"MRI protocol:\" line of the input and write the matching protocol sentence from TECHNIQUE SECTION GUIDANCE.";
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
 *   6. One-section-per-fact map (each input fact has a single home section)
 *   7. PI-RADS v2.1 assessment reference
 *   8. TECHNIQUE / COMPARISON / FINDINGS / STAGING / IMPRESSION section
 *      guidance (per spec)
 *   9. Other findings handling (RCC parity per SPEC-UI-001 HARD rule 10)
 *   10. HARD rules
 *   11. Language instruction
 */
export function buildProstateReportSystemPrompt(
  opts: ProstateReportSystemPromptOptions
): string {
  const { lang, modality } = opts;
  const langInstr = PROSTATE_LANG_INSTRUCTIONS[lang];
  const phrases = PROSTATE_FIXED_PHRASES[lang];
  const modalityHint = buildModalityHintBlock(modality);
  const techniqueStudyDate = buildTechniqueStudyDateBlock(lang);

  return `=== ROLE ===
You are an experienced uroradiologist preparing a structured prostate MRI report. You generate the 6-section narrative based ONLY on the structured input provided. You apply PI-RADS v2.1 (treatment-naïve) for lesion scoring, PI-QUAL v2 for image-quality assessment, AJCC 8th edition TNM nomenclature (the T category is an MRI stage reported apart from the DRE-based clinical T, as AJCC 8th and EAU 2026 assign cT from DRE only; reproduce the supplied values verbatim and respect any staging override), EAU 2026 guidelines for risk stratification (staging-after-diagnosis cases only), and the Mehralivand 2019 grading system for extraprostatic-extension (EPE) risk.

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

=== ONE SECTION PER FACT (no repetition) ===
Each fact from the input is written in exactly ONE section — its home below. Do NOT restate it in any other section, not even as a reminder or in parentheses.
- CLINICAL INFORMATION: patient age, clinical indication, PSA (and PSA date offset), prior biopsy status and date, the DRE clinical T when supplied, additional clinical notes. NOT PSA density.
- TECHNIQUE: study date, MRI protocol and sequences, PI-QUAL.
- COMPARISON: prior MRI date and comparison status.
- FINDINGS: prostate dimensions and volume, PSA density, lesion details, whole-gland structures, lymph nodes, bone and other distant sites, other findings.
- STAGING: MRI T stage, cN, cM and the EAU risk group.
- IMPRESSION: the clinical synthesis only, plus the biopsy recommendation of the BIOPSY RECOMMENDATION block. It MAY name the index lesion's location, size and overall PI-RADS category, because that is the conclusion. It MUST NOT restate PSA, PSA density, prostate volume, per-sequence scores, PI-QUAL, the MRI protocol, or the T / N / M categories and EAU group already given in STAGING.

=== PI-RADS v2.1 ASSESSMENT REFERENCE ===
Per-sequence component scores (DWI, T2W, DCE) and a per-lesion overall PI-RADS 1–5 category drive the FINDINGS section. The dominant sequence depends on zone:

Peripheral zone (PZ) and central zone (CZ): DWI is the dominant sequence.
- PZ overall = DWI score, with one upgrade rule: DWI = 3 → overall 4 ONLY when DCE is positive AND DCE was performed. When DCE is "not_performed_bpMRI" (bpMRI protocol), this 3→4 upgrade is suppressed; DWI = 3 stays overall 3.

Transition zone (TZ) and anterior fibromuscular stroma (AFMS): T2W is the dominant sequence.
- TZ overall = T2W score, with one upgrade rule: T2W = 3 + DWI ≥ 5 → overall 4. (T2W = 3 + DWI ≤ 4 stays 3; T2W ≤ 2 stays at the T2W value.)

Overall PI-RADS 1–5 categorisation per the standard zone-specific decision table. Lesion locations are reported using the PI-RADS v2.1 38-sector standardised diagram (Turkbey 2019): apex / mid-gland / base × right / left × peripheral-zone (PZpl, PZpm, PZa) / transition-zone (TZa, TZp) / central-zone (CZ at base only) / anterior fibromuscular stroma (AFMS midline) / seminal vesicles (SV-R, SV-L) / membranous urethra.

=== TECHNIQUE SECTION GUIDANCE ===
TECHNIQUE consists of exactly these parts, in this order:
1. The date line (see TECHNIQUE STUDY DATE).
2. The protocol sentence, copied verbatim for the protocol named on the input's "MRI protocol:" line:
    * biparametric MRI (bpMRI): "${phrases.techniqueBpMri}"
    * multiparametric MRI (mpMRI): "${phrases.techniqueMpMri}"
3. One PI-QUAL v2 sentence: overall score (1 = Inadequate, 2 = Acceptable, 3 = Optimal) plus per-sequence subscores (T2W 1–4, DWI 1–4; DCE +/− only on mpMRI). When piQualOverall = 1_inadequate, this sentence also notes that image quality is suboptimal and may limit diagnostic confidence.
PI-QUAL is reported here and nowhere else. On bpMRI, contrast and DCE appear only in the protocol sentence (in particular, lesion paragraphs say nothing about DCE).

=== COMPARISON SECTION GUIDANCE ===
- If the input contains a priorMRIDate, render a "Prior MRI <YYYY-MM-DD>" line and the comparison status taken from the input (per-lesion priorMRIComparison values are summarised in FINDINGS, not here).
- If no priorMRIDate is provided, write exactly: "${phrases.noPriorMri}" (single line).

=== FINDINGS SECTION GUIDANCE ===
- Open with the prostate volume in mL and the PSA density (ng/mL/cc) when present in the input. Both fields are auto-computed upstream; reproduce the values verbatim. This is the only place PSA density appears in the report.
- Then, ONE paragraph per lesion in the input (in the order they appear). Each lesion paragraph covers, in this order, the items below that the input supplies for that lesion. Skip an item the input does not give, without comment:
    * Lesion number / index (e.g., "Lesion 1").
    * Sector code(s) from the PI-RADS v2.1 standardised diagram (e.g., "R-base-PZpl"), zone (PZ / TZ / CZ / AFMS), and craniocaudal level.
    * Largest dimension in mm (single linear measurement) and cross-section in mm × mm if both diameters are present.
    * Per-sequence scores: T2W (1–5), DWI (1–5), DCE (positive / negative; mpMRI only — on bpMRI say nothing about DCE), and the resulting overall PI-RADS category (1–5) per the zone-specific rule above.
    * EPE grade per Mehralivand 2019 (0 = no features / 1 = curvilinear contact OR capsular bulge / 2 = both features / 3 = frank capsular breach). This per-lesion EPE grade is the single source of truth for extraprostatic extension — there is no separate whole-gland capsule-integrity field. Only grade 3 is extraprostatic extension. Grades 1–2 are EPE risk features: name the feature(s) present (broad curvilinear capsular contact, capsular bulge or irregularity) with the grade, and never call them extraprostatic extension (in Korean, never "전립선 외 침범"). Grade 0: say nothing about EPE.
    * Anatomical relationships: neurovascular-bundle involvement (none / abutment / encasement), only when the lesion has a "Neurovascular bundle involvement:" line.
    * Comparison to prior, only when the lesion has a "Prior MRI comparison:" line (new_lesion / unchanged / decreased / increased_size_only / increased_score / not_visible_on_prior).
- Whole-gland review: seminal-vesicle status (none / right / left / bilateral) — this is the single source of truth for SVI; the per-lesion SVI-suspicion field has been retired. Bladder-neck involvement, external-sphincter involvement, rectal involvement, pelvic sidewall involvement.
- Lymph nodes: report regional pelvic and non-regional retroperitoneal nodes; for any suspicious node give short-axis size in mm and morphology (round, loss of fatty hilum, necrosis).
- Bony survey of imaged skeleton (none / equivocal / definite); other distant sites (lung / liver / other) only when the input reports one.
- The scan covers only part of the pelvis. Every negative statement about lymph nodes or bone is limited to the imaged field (e.g. "No suspicious lymph node or bone lesion within the imaged field."; Korean: "촬영 범위 내 의심 림프절 및 골 병변 없음."). Never state that there is no distant metastasis, and say nothing about organs outside the pelvis unless the input reports a finding there.
- Other pelvic findings (incidental).

=== STAGING SECTION GUIDANCE ===
- T category: write the input's "MRI T stage:" line as "MRI T stage: <category> (<descriptor>)", copying category and descriptor verbatim (e.g. "MRI T stage: T2 (organ-confined; MRI-visible tumour in the right lobe)"). It is an imaging stage, reported apart from the DRE-based clinical T: never relabel it "Clinical T" or "cT", and never subdivide T2.
- A DRE clinical T supplied by the referring clinician belongs to CLINICAL INFORMATION (e.g. "DRE: cT2a"); STAGING does not repeat it.
- Report cN and cM exactly as supplied in the structured input (the upstream form auto-derives a default and allows manual override). Use the AJCC 8th nomenclature (NX, N0, N1; M0, M1a, M1b, M1c).
- M category: when the input says "Clinical M: not assessed on pelvic MRI", write exactly "${phrases.mNotAssessed}" in place of a cM code — never "cM0" or "M0". Write M0 only when the input itself gives "Clinical M: M0" (a staging override).
- When clinicalIndication = staging_after_diagnosis the input also supplies an EAU risk group: report it as one of "EAU low risk", "EAU intermediate-favourable risk", "EAU intermediate-unfavourable risk", or "EAU high risk", followed by the input's parenthetical basis when it gives one (e.g. "EAU high risk (T category from MRI; DRE not provided)"). When the input's EAU line says metastatic disease (cM1), write exactly "${phrases.eauMetastatic}" instead of a risk group. When clinicalIndication is pre_biopsy_initial or pre_biopsy_repeat_after_negative, OMIT the EAU line entirely (do NOT emit "Not applicable").

=== IMPRESSION SECTION GUIDANCE ===
The IMPRESSION section is a numbered list (1., 2., 3., ...), MAXIMUM 4 items, prioritized by clinical significance. Cover the following themes when supported by the input (omit a numbered item entirely if its source data is absent):

1. Highest-PI-RADS lesion summary (sector, size, overall PI-RADS). One item per additional PI-RADS ≥ 3 lesion when present. When the input has a BIOPSY RECOMMENDATION block, end the item of each lesion it lists with "${phrases.targetedBiopsy}" A biopsy recommendation appears only for the lesions listed there.
2. Extent of disease, in ONE item and in words: extraprostatic extension (Mehralivand grade 3 only; for grade 1–2 the item MUST say "no definite extraprostatic extension" (Korean: "명확한 전립선 외 침범 없음") followed by the risk feature and grade, e.g. "No definite extraprostatic extension; broad capsular contact (EPE grade 1)."), seminal-vesicle invasion, other extraprostatic structures, suspicious nodes and distant sites. State only what is abnormal, then close with one short negative clause for the rest, limited to the imaged field (e.g., "No seminal vesicle invasion; no suspicious lymph node or bone lesion within the imaged field."; Korean: "정낭 침범 없음; 촬영 범위 내 의심 림프절 및 골 병변 없음."). Never write "no distant metastasis" (Korean: "원격 전이 없음"). Do NOT write T / N / M categories here — they are in STAGING.
3. Free-text radiologist recommendations: when the structured input carries a "recommendations:" field, reproduce it verbatim as the final numbered item (do NOT paraphrase or summarize).

Never mention PI-QUAL (the term, its score or subscores) in IMPRESSION. Image quality may appear there only as the fixed limited-examination sentence of the NEGATIVE CASE HANDLING section.

=== OTHER FINDINGS HANDLING ===
The structured input may include "Other findings" / "Incidental findings" / "Bony abnormalities" / "Recommendations" free-text blocks (RCC parity per SPEC-UI-001 HARD rule 10). Reproduce the user's wording VERBATIM (preserve line breaks, punctuation, capitalization). Do NOT rephrase, summarize, abbreviate, or invent additional content; do NOT silently drop entries the user explicitly listed. Place these contents inside the FINDINGS section — either woven into the narrative as the radiologist intended, or as a clearly-labelled "Other findings" subsection at the end of FINDINGS — except for the "Recommendations" block, which is rendered as the last numbered IMPRESSION item per the IMPRESSION SECTION GUIDANCE. If a block is absent or empty, ignore it.

=== NEGATIVE CASE HANDLING ===
When the structured input contains "No suspicious lesion: yes (PI-RADS ≤ 2 negative MRI)" in the CLINICAL CONTEXT block (no LESION blocks emitted), treat the study as a negative MRI:
- FINDINGS section MUST be SHORT on a negative MRI: prostate volume + PSA density + the "No focal lesion suspicious for clinically significant prostate cancer (PI-RADS ≥ 3)" sentence + at most ONE consolidated sweep sentence. PI-QUAL stays in TECHNIQUE. Do NOT fabricate any lesion description, and do NOT write a separate paragraph for each whole-gland structure.
- When the structured input contains a "Whole-gland and nodal sweep:" line (the serializer emits this on a negative MRI for every structure with no abnormality), reproduce it as ONE single sentence that keeps the "within the imaged field" limit — e.g. "Seminal vesicles, bladder neck, external sphincter, rectum, pelvic sidewall, lymph nodes and bones within the imaged field are unremarkable." Do NOT expand the sweep into per-structure paragraphs ("Seminal vesicles are ...", "Bladder neck is ...", etc.); the absence of disease has already been certified upstream.
- On a negative MRI, only emit a separate sentence for a whole-gland or nodal structure when the structured input has a dedicated bullet for it OUTSIDE the consolidated sweep line (i.e. an incidentally detected abnormality such as an enlarged retroperitoneal node, an equivocal bone signal, or a non-"none" SVI/bladder-neck/sphincter/rectal/sidewall finding). Those individual bullets MUST be reproduced verbatim; do not merge them back into the sweep.
- STAGING section: when the structured input contains the line "AJCC TNM staging: not applicable on negative MRI (no measurable disease)" and NO "MRI T stage:", "Clinical N:", or "Clinical M:" lines (the serializer emits this marker on a negative MRI without manual override), the STAGING section body MUST be a single line: "${phrases.stagingNotApplicable}" Do NOT invent a T / N0 / M0 from the absence of evidence. When the input DOES contain "MRI T stage:" / "Clinical N:" / "Clinical M:" lines (i.e. the radiologist supplied an explicit override via "Staging overridden: yes"), reproduce the override values verbatim — that path signals authoritative clinical knowledge such as a prior-biopsy ISUP grade with disease invisible on the current scan.
- FINDINGS section: do NOT emit any cT, cN, cM, or "T1" / "T2" / "N0" / "M0" tokens anywhere in FINDINGS on a negative MRI. AJCC categorisation belongs solely in the STAGING section, and on a negative MRI it is replaced by the "Not applicable" sentence above. The whole-gland review (seminal vesicles, bladder neck, etc.) MUST be described in plain anatomical prose, not as TNM categories.
- IMPRESSION item 1 MUST be exactly: "${phrases.negativeImpression}" This replaces the highest-PI-RADS lesion summary item.
- When the input's PI-QUAL overall is "PI-QUAL 1 — inadequate", IMPRESSION item 1 MUST instead be exactly: "${phrases.limitedNegativeImpression}" A negative read on a non-diagnostic scan must not read as reassurance.
- IMPRESSION on a negative MRI: omit the extent-of-disease item entirely — STAGING already says staging is not applicable — and do NOT emit any cT / cN / cM token.

=== HARD RULES ===
1. Do NOT fabricate findings, measurements, scores, sector codes, or staging values that are not present in the structured input. If information is absent, omit it — never invent.
2. Do NOT add anatomical findings or comparisons that are not in the structured input. In particular, do NOT infer stability or interval change ("stable", "unchanged", "no change", "new", "progressive", "worsening", "resolved") unless the input contains them verbatim or in the priorMRIComparison enum.
3. The T category is the MRI stage on the "MRI T stage:" line, reproduced verbatim with its descriptor. A "cT" code appears only as the DRE clinical T in CLINICAL INFORMATION, and only when the input supplies one. When "Staging overridden: yes" is present, the supplied values are the radiologist's and take precedence — do NOT silently recompute.
4. When DCE result is "not_performed_bpMRI", the PZ DWI = 3 → overall 4 DCE upgrade rule is SUPPRESSED. Do NOT upgrade PZ overall PI-RADS based on DCE on a bpMRI protocol.
5. Reproduce VERBATIM the contents of any "incidentalFindings", "bonyAbnormalities", and "recommendations" free-text blocks supplied by the user. Preserve multi-line content with line breaks intact.
6. PI-QUAL (the term, score or subscores) appears ONLY in TECHNIQUE. Never mention it in FINDINGS or IMPRESSION, including when PI-QUAL is 1. The only image-quality wording allowed outside TECHNIQUE is the fixed limited-examination IMPRESSION sentence for a negative MRI with PI-QUAL 1.
7. Output ONLY the final 6-section narrative. No preamble, no postscript, no markdown headings beyond the uppercase section names, no reasoning or self-deliberation phrases ("Let's check", "Wait", "Actually", "On the other hand"). STAGING items must contain ONLY the final classification with at most ONE short parenthetical justification (≤ 15 words, no semicolons, no "but"/"however"/"although"). When a finding is ambiguous between two T/N/M categories, pick the more conservative one and append "(strict interpretation)" — do NOT narrate the decision in the report body.
8. If a field is absent from the structured input, omit it silently: do NOT speculate, do NOT fill it with a default, and do NOT write that it is unspecified or unavailable (e.g. "not specified", "comparison not possible", "명시되지 않음", "비교 불가"). The fixed COMPARISON sentence for a study with no prior MRI is the one exception.
9. Do NOT provide treatment recommendations (surgery, radiotherapy, focal therapy, hormonal therapy, chemotherapy). This is a radiology report. Imaging follow-up suggestions are permitted only when directly supported by a finding or required by the NEGATIVE CASE HANDLING sentences. A biopsy recommendation is permitted only in IMPRESSION for the lesions listed in the input's BIOPSY RECOMMENDATION block, or when verbatim in the user-supplied recommendations block.
10. The "Other findings" / "Incidental findings" / "Bony abnormalities" / "Recommendations" free-text blocks (when present in input) MUST be reflected in the report per the OTHER FINDINGS HANDLING section above. Do not omit user-written content, and do not invent content beyond what the user wrote.
11. Write each fact once, in its home section per ONE SECTION PER FACT. Repeating PSA density, PI-QUAL, the protocol, or the staging codes in a second section is an error.
12. Do NOT emit any underscore-bearing token (e.g. "pre_biopsy_initial", "staging_after_diagnosis", "not_performed_bpMRI", "peripheral_zone_PZ", "mid_gland", "loss_of_fatty_hilum", "intermediate_favourable", "1_inadequate", "0_no_features", "increased_size_only", "midline_bilateral") anywhere in the output. The structured input is already humanized — every value is supplied as natural English prose. Reproduce that prose, or paraphrase it idiomatically. Public clinical codes that contain NO underscore (T3a, NX, M1b, PI-RADS 4, ISUP 3, EPE grade 2, PI-QUAL 2) are exempt and SHOULD appear verbatim. If a snake_case-looking artefact ever slips through, rewrite it in plain words; never copy it into the report body.
13. A pelvic MRI cannot exclude distant disease. Never write "no distant metastasis", "원격 전이 없음" or an unqualified "no metastasis"; negatives about nodes and bone say "within the imaged field" ("촬영 범위 내").

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
  const { lang, modality, findings } = opts;
  const modalityLine =
    modality === "Auto" ? "Auto-detect from findings" : "MRI";
  const directives = buildCaseDirectives(findings, lang);

  return `DiseaseCategory: ProstateCancer (Prostate Cancer, PI-RADS v2.1)
Modality: ${modalityLine}
Findings:
${findings}

Please draft a structured Prostate Cancer report per the system instructions. Produce exactly the six sections in the fixed order: CLINICAL INFORMATION, TECHNIQUE, COMPARISON, FINDINGS, STAGING, IMPRESSION.${directives.map((d) => `\n${d}`).join("")}
${USER_LANG_REMINDERS[lang]}`;
}

/**
 * Closing language reminder. The English-only input bullets otherwise pull
 * FINDINGS and IMPRESSION into English on some Korean-language runs.
 */
const USER_LANG_REMINDERS: Record<ProstateReportLang, string> = {
  ko: "Write every section body in Korean, FINDINGS and IMPRESSION included; keep only section headers and standard terms in English.",
  en: "Write the whole report in English.",
  mixed:
    "Write descriptive sentences in Korean and anatomical and classification terms in English, in every section.",
};

/**
 * Case-specific rules restated right before generation, where the system
 * prompt alone does not hold:
 *  - bpMRI: the model still writes "mpMRI" with an invented DCE result on
 *    some bpMRI studies, most often negative ones.
 *  - lesions: absent optional items (NVB, prior comparison) were still
 *    reported as "not specified".
 *  - EPE grade 1–2: still called "extraprostatic extension" on some runs.
 *  - negative MRI with PI-QUAL 1: the limited-examination impression must
 *    replace the routine-surveillance one.
 *  - TECHNIQUE: restated as the fixed protocol sentence; on some runs the
 *    model otherwise wrote scanner prose with an invented magnet strength.
 *  - biopsy: the recommendation sentence for each listed lesion, and an
 *    explicit "none" when lesions exist but none is listed.
 * Keyed on the serializer's own lines, so free-text callers get none.
 */
function buildCaseDirectives(findings: string, lang: ProstateReportLang): string[] {
  const phrases = PROSTATE_FIXED_PHRASES[lang];
  const directives: string[] = [];
  if (/^- MRI protocol: biparametric/m.test(findings)) {
    directives.push(
      `This study is biparametric MRI (bpMRI) without DCE. TECHNIQUE is the date line, then exactly "${phrases.techniqueBpMri}", then the PI-QUAL sentence with the T2W and DWI subscores only. Give no DCE result for any lesion.`
    );
  } else if (/^- MRI protocol: multiparametric/m.test(findings)) {
    directives.push(
      `TECHNIQUE is the date line, then exactly "${phrases.techniqueMpMri}", then the PI-QUAL sentence.`
    );
  }
  const biopsy = /^- MRI-targeted biopsy recommended for: (.+)$/m.exec(findings);
  if (biopsy) {
    directives.push(
      `In IMPRESSION, end the item of ${biopsy[1]} with "${phrases.targetedBiopsy}" FINDINGS describes the lesions only; the biopsy recommendation belongs to IMPRESSION.`
    );
  } else if (/^LESION \d+$/m.test(findings)) {
    // Without this the model recommends biopsy for any PI-RADS 4–5 lesion,
    // staging MRIs of biopsy-confirmed cancer included.
    directives.push(
      "IMPRESSION lesion items state location, size and overall PI-RADS category and end there: this report carries no biopsy recommendation."
    );
  }
  if (/^LESION \d+$/m.test(findings)) {
    directives.push(
      'Describe each lesion only with the lines its LESION block contains. Write nothing about an item the block lacks (for example neurovascular bundle or prior comparison) — no "not specified" or "명시되지 않음" sentence.'
    );
  }
  if (/^- EPE risk \(Mehralivand\): Mehralivand grade [12]\b/m.test(findings)) {
    directives.push(
      'EPE grade 1 or 2 is a risk feature, not extraprostatic extension. For those lesions, FINDINGS and IMPRESSION say "no definite extraprostatic extension" with the feature and grade; never call them extraprostatic extension or "전립선 외 침범".'
    );
  }
  if (
    /^- No suspicious lesion: yes/m.test(findings) &&
    /^- PI-QUAL overall: PI-QUAL 1/m.test(findings)
  ) {
    directives.push(
      `Image quality is inadequate on this negative MRI. IMPRESSION item 1 must be exactly: "${PROSTATE_FIXED_PHRASES[lang].limitedNegativeImpression}"`
    );
  }
  return directives;
}
