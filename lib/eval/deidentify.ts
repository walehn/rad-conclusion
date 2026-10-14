// lib/eval/deidentify.ts
// Scrubs report text before it reaches an LLM judge.
//
// Findings are free text typed by a radiologist, so the realistic identifiers
// are exam dates, registration/accession numbers and outside-hospital names.
// Measurements ("2.3 cm", "S7", "LI-RADS 4") must survive untouched: they are
// exactly what the judge checks.
//
// Placeholders are numbered per distinct value and shared across the texts
// passed in one call, so a judge can still tell that the conclusion cites the
// same date as the findings ([DATE1] in both) without seeing the date itself.

export interface DeidentifyResult {
  texts: string[];
  /** Placeholder counts by kind, for auditing what was removed. */
  replaced: Record<"date" | "id" | "hospital", number>;
}

const MONTH =
  "(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|June?|July?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)";

/** Shared with the rule checks, which compare dates rather than hide them. */
export const DATE_PATTERNS: readonly RegExp[] = [
  // 2026-09-18, 2026.9.18, 2026/9/18
  /\b(?:19|20)\d{2}\s*[-./]\s*\d{1,2}\s*[-./]\s*\d{1,2}\b/g,
  // 2026년 9월 18일, 26년 9월
  /\b\d{2,4}\s*년\s*\d{1,2}\s*월(?:\s*\d{1,2}\s*일)?/g,
  // 9/18/2026, 18.09.26 — day/month order varies, year last
  /\b\d{1,2}[/.]\d{1,2}[/.](?:19|20)?\d{2}\b/g,
  // 2026-09 (year-month only)
  /\b(?:19|20)\d{2}[-./]\d{1,2}\b(?![-./]\d)/g,
  // English month names, which the model writes even when the findings used
  // digits: "September 16, 2025", "16 Sep 2025", "Sept. 2025"
  new RegExp(`\\b(?:\\d{1,2}\\s+)?${MONTH}\\.?(?:\\s+\\d{1,2}(?:st|nd|rd|th)?)?,?\\s+(?:19|20)\\d{2}\\b`, "gi"),
];

// Six or more digits in a row is never a measurement in a report; it is a
// registration number, accession number, or compact date (20260918).
const ID_PATTERN = /\b\d{6,}\b/g;

// "서울대병원", "OO 의원", "Samsung Medical Center", "outside hospital" is kept
// because it identifies nobody.
const HOSPITAL_PATTERNS: RegExp[] = [
  /[가-힣A-Za-z]{2,}\s?(?:대학교\s?)?(?:병원|의원|의료원|병의원|메디컬센터|의료센터)/g,
  /\b(?:[A-Z][A-Za-z.&-]+\s){1,4}(?:Hospital|Medical Center|Clinic|Infirmary)\b/g,
];

const GENERIC_HOSPITAL = /^(?:outside|other|local|referring|타|외부|타\s?병원|본)\s?/i;

export function deidentify(inputs: string[]): DeidentifyResult {
  const maps = {
    date: new Map<string, string>(),
    id: new Map<string, string>(),
    hospital: new Map<string, string>(),
  };
  const replaced = { date: 0, id: 0, hospital: 0 };

  const placeholder = (kind: keyof typeof maps, label: string, raw: string) => {
    const key = raw.replace(/\s+/g, "").toLowerCase();
    let tag = maps[kind].get(key);
    if (!tag) {
      tag = `[${label}${maps[kind].size + 1}]`;
      maps[kind].set(key, tag);
    }
    replaced[kind]++;
    return tag;
  };

  const texts = inputs.map((input) => {
    let text = input;
    for (const re of DATE_PATTERNS) {
      text = text.replace(re, (m) => placeholder("date", "DATE", m));
    }
    text = text.replace(ID_PATTERN, (m) => placeholder("id", "ID", m));
    for (const re of HOSPITAL_PATTERNS) {
      text = text.replace(re, (m) =>
        GENERIC_HOSPITAL.test(m) ? m : placeholder("hospital", "HOSPITAL", m)
      );
    }
    return text;
  });

  return { texts, replaced };
}
