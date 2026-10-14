// lib/findings-check.ts
// Rejects input that contains no findings text, such as a pasted registration
// number or a stray keystroke. The model still writes a fluent conclusion for
// such input, entirely invented (generations #143-146, #482-483).
//
// Shared by the conclusion page, /api/generate and the eval rule
// `input_without_findings`, so all three use one definition.

/** Words of two or more letters (Latin or Hangul) in the findings. */
export function findingsWordCount(findings: string): number {
  return (findings.match(/[A-Za-z가-힣]{2,}/g) ?? []).length;
}

/** Error message when the findings cannot support a conclusion, else null. */
export function findingsProblem(findings: string): string | null {
  if (!findings.trim()) return "Please enter the Findings text.";
  if (findingsWordCount(findings) < 2) {
    return "The Findings contain no descriptive text (only numbers or a few characters). Paste the Findings, not an ID.";
  }
  return null;
}
