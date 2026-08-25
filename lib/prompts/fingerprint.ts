// lib/prompts/fingerprint.ts
// Server-only: hashes the rendered conclusion prompts so a text edit is
// detectable without diffing source. Kept apart from revisions.ts because
// that module is imported by client components and this one uses node:crypto.

import { createHash } from "node:crypto";
import { buildSystemPrompt, buildUserPrompt } from "./system-prompt";
import type {
  ConclusionLang,
  ConclusionStyle,
  PromptVersion,
} from "./system-prompt";
import { PROMPT_REVISIONS, UNREGISTERED_REVISION_ID } from "./revisions";

const VERSIONS: readonly PromptVersion[] = ["v1", "v2"];
const LANGS: readonly ConclusionLang[] = ["ko", "en", "mixed"];
const STYLES: readonly ConclusionStyle[] = ["numbered", "short", "urgent-first"];

// Fixed inputs: the fingerprint must track the prompt text, not the caller's
// title or findings.
const SAMPLE_TITLE = "Conclusion";
const SAMPLE_FINDINGS = "SAMPLE FINDINGS";

/** Hex characters kept from the sha256. Long enough to be collision-free here. */
export const PROMPT_HASH_LENGTH = 12;

/**
 * Renders every prompt this module can produce, in a fixed order.
 *
 * All lang/style combinations are included so an edit to LANG_INSTRUCTIONS or
 * STYLE_INSTRUCTIONS changes the fingerprint too, not just the two builders.
 */
function renderAllPrompts(): string {
  const parts: string[] = [];
  for (const version of VERSIONS) {
    for (const lang of LANGS) {
      for (const style of STYLES) {
        parts.push(
          `${version}|${lang}|${style}\n${buildSystemPrompt({
            version,
            lang,
            style,
            title: SAMPLE_TITLE,
          })}`
        );
      }
    }
  }
  parts.push(
    `user\n${buildUserPrompt({
      findings: SAMPLE_FINDINGS,
      title: SAMPLE_TITLE,
    })}`
  );
  // Separator marks the boundary between rendered prompts so that moving text
  // from one prompt into another still changes the hash.
  return parts.join("\n<<<>>>\n");
}

let cachedFingerprint: string | null = null;

/** Short sha256 of the live prompt text. Computed once per process. */
export function computePromptFingerprint(): string {
  if (cachedFingerprint) return cachedFingerprint;
  cachedFingerprint = createHash("sha256")
    .update(renderAllPrompts())
    .digest("hex")
    .slice(0, PROMPT_HASH_LENGTH);
  return cachedFingerprint;
}

let warnedHash: string | null = null;

/**
 * The revision id to stamp on a generation row.
 *
 * Matches the live prompt text against the registry rather than trusting
 * CURRENT_PROMPT_REVISION: if someone edits the prompt without registering a
 * revision, rows are stamped `unregistered` instead of being mislabelled as
 * the previous revision. The hash is recorded either way, so those rows can
 * still be grouped and identified after the fact.
 */
export function resolveActivePromptRevision(): {
  revisionId: string;
  promptHash: string;
} {
  const promptHash = computePromptFingerprint();
  const match = PROMPT_REVISIONS.find((r) => r.fingerprint === promptHash);
  if (match) return { revisionId: match.id, promptHash };

  if (warnedHash !== promptHash) {
    warnedHash = promptHash;
    console.warn(
      `[prompts] prompt text (${promptHash}) matches no entry in ` +
        "lib/prompts/revisions.ts - generations are recorded as " +
        `"${UNREGISTERED_REVISION_ID}". Run: npm run prompt:revision`
    );
  }
  return { revisionId: UNREGISTERED_REVISION_ID, promptHash };
}
