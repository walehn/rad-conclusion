/**
 * LLM-as-Judge evaluation prompt builder.
 * Used by the host worker script (scripts/evaluate-worker.sh) and
 * the /api/evaluate endpoint for context.
 */

export function buildJudgePrompt(
  findings: string,
  conclusion: string,
  promptVersion: string
): string {
  return `You are a senior radiologist evaluating an AI-generated radiology conclusion.

Below are the original Findings and the AI-generated Conclusion (prompt version: ${promptVersion}).

=== FINDINGS ===
${findings}

=== CONCLUSION ===
${conclusion}

=== EVALUATION CRITERIA ===
Score each criterion from 1 (worst) to 5 (best):

1. conciseness: Does the conclusion avoid unnecessary verbosity and imaging descriptors? A score of 5 means it distills only the clinical essentials (lesion count, location, size, interval change) and strips imaging-sequence language. A score of 1 means it copies Findings verbatim with full imaging descriptors.

2. intervalChange: If the Findings mention temporal change (increased, decreased, stable, new, resolved, unchanged, little change), is it accurately reflected in the Conclusion? Score 5 if every temporal marker is carried over. Score 1 if temporal information is dropped or contradicted. If no temporal data exists in Findings, score 5.

3. dxAppropriateness: Is diagnosis (Dx) or differential diagnosis (DDx) added only when genuinely needed? The finding name itself often IS the diagnosis (e.g., "leiomyoma" does not need "compatible with leiomyoma"). Pathognomonic appearances should not get DDx. Score 5 if Dx/DDx usage is selective and appropriate. Score 1 if every item gets redundant Dx labels.

4. redundancy: Are there repeated concepts expressed in different words within the same item? Common offenders: "stable, no interval change", "stable, unchanged", "stable, no significant change". Score 5 if no semantic redundancy exists. Score 1 if multiple items contain redundant phrasing.

5. hedgingAccuracy: Is confidence language appropriate for the certainty level? Over-hedging clear findings or under-hedging ambiguous ones both reduce the score. Score 5 if hedging matches diagnostic certainty throughout. Score 1 if hedging is systematically inappropriate.

6. clinicalPriority: Are findings ordered by clinical significance? The most important finding should be listed first. Score 5 if ordering is optimal. Score 1 if ordering is random or inverted.

=== OUTPUT INSTRUCTIONS ===
Output ONLY a valid JSON object. No markdown fences, no explanation, no text before or after the JSON.

{
  "scores": {
    "conciseness": <1-5>,
    "intervalChange": <1-5>,
    "dxAppropriateness": <1-5>,
    "redundancy": <1-5>,
    "hedgingAccuracy": <1-5>,
    "clinicalPriority": <1-5>
  },
  "issues": ["<criterion>: <specific issue description>", ...],
  "overallScore": <weighted average as float, 1 decimal place>
}

The overallScore is the arithmetic mean of all 6 scores, rounded to 1 decimal place.
If there are no issues, return an empty array for "issues".`;
}
