/**
 * Post-process LLM output to extract the conclusion section.
 * Ported from the Python parser in rad_conclusion.sh.
 */

const KO_ALIASES: Record<string, string> = {
  Conclusion: "결론",
  Impression: "인상소견",
  Summary: "요약",
};

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stripBold(text: string, title: string, koTitle: string): string {
  // Remove bold markdown around title: **Title**: or **Title:**
  let result = text;
  result = result.replace(
    new RegExp(`\\*+${escapeRegex(title)}\\*+:`, "g"),
    `${title}:`
  );
  result = result.replace(
    new RegExp(`\\*+${escapeRegex(title)}:\\*+`, "g"),
    `${title}:`
  );
  if (koTitle) {
    result = result.replace(
      new RegExp(`\\*+${escapeRegex(koTitle)}\\*+:`, "g"),
      `${koTitle}:`
    );
    result = result.replace(
      new RegExp(`\\*+${escapeRegex(koTitle)}:\\*+`, "g"),
      `${koTitle}:`
    );
  }
  return result;
}

function extractFromLastTitle(
  text: string,
  pattern: RegExp,
  title: string,
  koTitle: string
): string | null {
  const matches = [...text.matchAll(pattern)];
  if (matches.length > 0) {
    const last = matches[matches.length - 1];
    const start = last.index ?? 0;
    return stripBold(text.slice(start), title, koTitle);
  }
  return null;
}

export function postProcess(content: string, title: string): string {
  const koTitle = KO_ALIASES[title] || "";

  // Build regex pattern matching title or Korean alias, with optional bold markers
  let titlesPat = escapeRegex(title);
  if (koTitle) {
    titlesPat = `(?:${titlesPat}|${escapeRegex(koTitle)})`;
  }
  const pattern = new RegExp(`(?:^|\\*+)${titlesPat}(?:\\*+)?:`, "gm");

  // 1) Try to find title in full content
  let result = extractFromLastTitle(content, pattern, title, koTitle);

  // 2) If not found and content starts with "thought\n", search inside thought block
  if (result === null && content.startsWith("thought\n")) {
    const rest = content.slice("thought\n".length);
    result = extractFromLastTitle(rest, pattern, title, koTitle);
    if (result === null) {
      result = rest; // best-effort: return everything after thought\n
    }
  }

  return (result ?? content).trim();
}
