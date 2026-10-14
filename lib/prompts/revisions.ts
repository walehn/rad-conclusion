// lib/prompts/revisions.ts
// Change history for the conclusion prompts in lib/prompts/system-prompt.ts.
//
// Every generation row records the revision that produced it, so a later
// review can tell whether two conclusions came from the same prompt text.
// This file is the single source of truth for that history and is rendered
// as-is on the /review screen.
//
// HOW TO ADD A REVISION (do this in the same commit as the prompt edit):
//   1. Edit lib/prompts/system-prompt.ts.
//   2. Run `npm run prompt:revision` — it prints the new fingerprint.
//   3. Append an entry below with that fingerprint, today's date, and what
//      changed. Never edit or delete an existing entry: old generation rows
//      point at it.
//   4. `npm test` fails until the registry matches the prompt text, so a
//      silent prompt drift cannot reach production.
//
// This module must stay free of Node built-ins — the review client imports it.

export interface PromptRevision {
  /** Stable id recorded on every generation row. Sequential: r1, r2, ... */
  id: string;
  /** Date the revision took effect (YYYY-MM-DD). */
  date: string;
  /** One-line summary, shown in the review screen. */
  summary: string;
  /** What changed against the previous revision. Empty for the base. */
  changes: string[];
  /**
   * Short sha256 over every prompt this revision renders (both versions, all
   * lang/style combinations, plus the user-prompt wrapper). Produced by
   * `npm run prompt:revision`.
   */
  fingerprint: string;
}

/** Recorded when the live prompt text matches no registered revision. */
export const UNREGISTERED_REVISION_ID = "unregistered";

/** Oldest first. The last entry is the active revision. */
export const PROMPT_REVISIONS: readonly PromptRevision[] = [
  {
    id: "r1",
    date: "2026-08-25",
    summary: "베이스 프롬프트 — 버전 추적 시작 시점의 v1/v2 원문",
    changes: [],
    fingerprint: "54ffaf17bb8c",
  },
  {
    id: "r2",
    date: "2026-10-14",
    summary: "v1을 서명 판독문 문체(house style) 프롬프트로 교체 — v2와 A/B 비교",
    changes: [
      "v1 'Basic' 프롬프트를 house style로 교체 (A/B에서 v1 채택률 5%)",
      "임상 질문에 먼저 답하고 배경 소견은 생략, 음성 소견은 주 항목에 붙임, 1~3개 항목",
      "little change / probably / suspicion of 사용, 권고 최소화, 세미콜론·대시 사용 안 함",
      "비교 근거 없는 변화 표현 금지를 맨 앞 NEVER 섹션으로",
      "재현 시험(앱 없이 쓴 서명 판독 220건): 유사도 +0.045 (95% CI 0.033–0.058), 근거 없는 변화 표현 0.9% vs 4.5%",
      "v2는 변경 없음",
    ],
    fingerprint: "c58badde21ff",
  },
];

/** The revision the code currently renders, assuming no uncommitted drift. */
export const CURRENT_PROMPT_REVISION: PromptRevision =
  PROMPT_REVISIONS[PROMPT_REVISIONS.length - 1];

/** Lookup for the review screen, which receives only the recorded id. */
export function findPromptRevision(
  id: string | null | undefined
): PromptRevision | undefined {
  if (!id) return undefined;
  return PROMPT_REVISIONS.find((r) => r.id === id);
}
