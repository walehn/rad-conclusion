"use client";

// Rule checks shown under a finished conclusion: content the Findings do not
// support (a side, a number, a date, an interval-change word, an added
// recommendation) and output-format problems. Display only — the conclusion
// is never altered, so what the radiologist copies is what the model wrote.
//
// Same checks as `npm run eval -- rules` (lib/eval/rules.ts), run against the
// Findings the conclusion was generated from, not the current input.

import * as React from "react";
import { AlertTriangle } from "lucide-react";
import { useNotionPalette } from "@/components/notion-tone";
import { runRules, type RuleFlag, type RuleFlagKind } from "@/lib/eval/rules";

const LABELS: Record<RuleFlagKind, string> = {
  input_without_findings: "Findings contain no descriptive text",
  format_not_numbered: "Numbered list format",
  format_title_line: "Title line in output",
  format_filler_opener: "Filler opener",
  format_markdown: "Markdown in output",
  lang_hangul_in_english: "Korean text in an English conclusion",
  laterality_introduced: "Side not in Findings",
  number_not_in_findings: "Number not in Findings",
  date_not_in_findings: "Date not in Findings",
  interval_change_introduced: "Change word, but Findings state no prior",
  recommendation_added: "Recommendation not in Findings",
};

/** Most important first: content problems, then recommendations, then format. */
const ORDER: Record<RuleFlag["severity"], number> = { suspect: 0, info: 1, violation: 2 };

export function checkConclusion(input: {
  findings: string;
  conclusion: string;
  style: string;
  lang: string;
}): RuleFlag[] {
  if (!input.conclusion.trim()) return [];
  return [...runRules(input).flags].sort((a, b) => ORDER[a.severity] - ORDER[b.severity]);
}

interface ConclusionChecksProps {
  findings: string;
  conclusion: string;
  style: string;
  lang: string;
}

export function ConclusionChecks({ findings, conclusion, style, lang }: ConclusionChecksProps) {
  const { c } = useNotionPalette();
  const flags = React.useMemo(
    () => checkConclusion({ findings, conclusion, style, lang }),
    [findings, conclusion, style, lang]
  );
  if (flags.length === 0) return null;

  return (
    <div
      role="status"
      aria-label="Checks against the Findings"
      className="mt-3 rounded-lg border px-3 py-2.5 text-[13px]"
      style={{ background: c.warningTint, borderColor: c.warningBorder, color: c.warningText }}
    >
      <div className="flex items-center gap-1.5 font-medium">
        <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
        Check before signing
      </div>
      <ul className="mt-1.5 space-y-1">
        {flags.map((f, i) => (
          <li key={`${f.kind}-${i}`} className="flex flex-wrap gap-x-1.5">
            <span>{LABELS[f.kind]}</span>
            {f.detail && (
              <span className="font-mono text-[12px]" style={{ opacity: 0.85 }}>
                {f.detail}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
