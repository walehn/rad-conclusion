// lib/prompts/candidates.ts
// Prompts under offline evaluation (`npm run eval -- replay`).
//
// "v1" and "v2" render the live prompts unchanged. Any other entry is a draft:
// it is never served by /api/generate and does not affect the live prompt
// fingerprint. A draft that wins the replay is promoted by moving its text
// into system-prompt.ts and registering a revision in revisions.ts.
//
// Drafts hold style rules only. Real report text (few-shot examples) must not
// be written here: this repository is public.

import {
  LANG_INSTRUCTIONS,
  STYLE_INSTRUCTIONS,
  buildSystemPrompt,
  buildUserPrompt,
  type ConclusionLang,
  type ConclusionStyle,
} from "./system-prompt";

export interface CandidateOptions {
  style: ConclusionStyle;
  lang: ConclusionLang;
  title: string;
}

export interface PromptCandidate {
  id: string;
  description: string;
  /** Same switch /api/generate derives from the prompt version. */
  deepReasoning: boolean;
  /**
   * Replay only: turn the local model's thinking on through the chat
   * template. /api/generate keeps it off for latency (commit 120000b).
   */
  thinking?: boolean;
  buildSystem(options: CandidateOptions): string;
  buildUser(findings: string, title: string): string;
}

const user = (findings: string, title: string) => buildUserPrompt({ findings, title });

/**
 * House style measured on 1,051 signed conclusions (2026-08-25 ~ 10-14)
 * against 326 v2 outputs, as share of conclusions using the phrase:
 * "little change" 19.9% vs 0.6%, "stable"/"unchanged" 6.5%/2.8% vs
 * 16.9%/18.4%, "probably" 14.1% vs 1.2%, "consistent with" 3.9% vs 21.2%,
 * recommendations 3.2% vs 24.5%, em dash 2.2% vs 30.1%, semicolon 16.8% vs
 * 69.6%, an item starting with "No ..." 41.9% vs 27.3%.
 */
function buildR2Prompt({ title, lang, style }: CandidateOptions): string {
  return `You are a board-certified abdominal radiologist. Write the ${title} (Impression) section from the provided Findings in the house style described below.

=== CONTENT RULES ===
1. Distill — restate WHAT, WHERE, size when it matters, and HOW IT CHANGED. Leave imaging descriptors (signal, enhancement pattern, attenuation) in the Findings unless they carry the diagnosis.
2. Interval change — only when the Findings state a comparison with a prior study. Never add change words ("little change", "stable", "decreased", "new") for a study without a stated prior.
   House phrasing puts the change first:
   "Little change of 1.2 cm hepatic cyst in S6."
   "Little interval change of multiple small hepatic cysts."
   "Decreased extent of pelvic ascites."
   "Increased size of the left adrenal nodule, now 2.1 cm."
   Prefer "little change" to "stable" or "unchanged".
3. Prioritize — the most clinically significant finding first; background conditions last.
4. Coverage — give every abnormal finding its own item. Background conditions (liver cirrhosis, fatty liver, splenomegaly, BPH, uterine myoma, simple cysts, ascites) are brief items at the end; related ones may share an item ("Underlying liver cirrhosis with splenomegaly."). Omit normal structures, patent vessels, and tiny incidental lesions mentioned only in passing.
5. Surveillance and normal studies — when the Findings describe a post-treatment or follow-up study and explicitly report no recurrence or metastasis, state it as an item, for example:
   "No evidence of tumor recurrence."
   "No local tumor recurrence or distant metastasis."
   "No evidence of intra-abdominal distant metastasis."
   When the Findings report nothing abnormal: "No definite abnormal finding."
   Use these only when the Findings support them.
6. Certainty — keep the certainty the Findings express; never upgrade it. House terms:
   definite → name the diagnosis
   likely → "probably X" or "X, probably"
   uncertain → "suspicion of X" or "suspected X"
   differential → "X vs. Y", or "DDx: Y" after the main impression
   Avoid "consistent with", "compatible with", "suggestive of", and "most likely".
7. Recommendations — almost never. Add one only when a finding cannot be characterized and the next step would change management, as a short clause at the end of that item ("..., further evaluation with MRI"). Do not add clinical correlation, further evaluation, or follow-up imaging by default.
8. No fabrication — no measurement, location, laterality, date, or history that is not in the Findings. No patient identifiers.

=== STYLE ===
9. Telegram-style phrases: one finding per item, articles dropped where natural.
10. Plain punctuation: commas within an item; do not use semicolons or dashes.
11. Consistent terminology; no filler openers ("In summary", "Overall") and no closing remarks.

=== OUTPUT FORMAT ===
- Do not include a title line like "${title}:" or "Impression:" — output the conclusion content directly.
- When numbered style is requested, format each item as 1. ..., 2. ..., 3. ... (not (1) style, not bullets).
- No preamble, no postscript, no reasoning.

${LANG_INSTRUCTIONS[lang]}
${STYLE_INSTRUCTIONS[style]}`;
}


export const PROMPT_CANDIDATES: Record<string, PromptCandidate> = {
  v1: {
    id: "v1",
    description: "live v1 prompt (house style since revision r2)",
    deepReasoning: false,
    buildSystem: (o) => buildSystemPrompt({ ...o, version: "v1" }),
    buildUser: user,
  },
  v2: {
    id: "v2",
    description: "live v2 prompt",
    deepReasoning: true,
    buildSystem: (o) => buildSystemPrompt({ ...o, version: "v2" }),
    buildUser: user,
  },
  r2: {
    id: "r2",
    description: "v2 rewritten to the measured house style (2026-10-14 draft)",
    deepReasoning: true,
    buildSystem: buildR2Prompt,
    buildUser: user,
  },
  // Thinking on, same prompt text: does reasoning buy accuracy worth its latency?
  "v1-think": {
    id: "v1-think",
    description: "live v1 (house style) with thinking on",
    deepReasoning: false,
    thinking: true,
    buildSystem: (o) => buildSystemPrompt({ ...o, version: "v1" }),
    buildUser: user,
  },
  "v2-think": {
    id: "v2-think",
    description: "live v2 with thinking on",
    deepReasoning: true,
    thinking: true,
    buildSystem: (o) => buildSystemPrompt({ ...o, version: "v2" }),
    buildUser: user,
  },
  // Promoted to the live v1 slot in prompt revision r2 (2026-10-14); kept so
  // its stored replays stay addressable. Renders the same text as "v1".
  r3: {
    id: "r3",
    description: "house style, selective content (live v1 since revision r2)",
    deepReasoning: true,
    buildSystem: (o) => buildSystemPrompt({ ...o, version: "v1" }),
    buildUser: user,
  },
};
