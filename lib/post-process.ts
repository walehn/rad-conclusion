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

function removeTitleLine(text: string, title: string, koTitle: string): string {
  // Build regex to match a title line like "Conclusion:" or "**Conclusion:**" at the start
  let titlesPat = escapeRegex(title);
  if (koTitle) {
    titlesPat = `(?:${titlesPat}|${escapeRegex(koTitle)})`;
  }
  // Remove title line (with optional bold markers) from beginning or anywhere
  const pattern = new RegExp(`^\\s*(?:\\*+)?${titlesPat}(?:\\*+)?:\\s*\\n?`, "gm");
  return text.replace(pattern, "");
}

export function postProcess(content: string, title: string): string {
  const koTitle = KO_ALIASES[title] || "";

  let result = content;

  // Handle thought block: extract content after "thought\n"
  if (result.startsWith("thought\n")) {
    result = result.slice("thought\n".length);
  }

  // Strip bold markers around title
  result = stripBold(result, title, koTitle);

  // Remove any title lines (e.g., "Conclusion:", "결론:")
  result = removeTitleLine(result, title, koTitle);

  return result.trim();
}
