"use client";

import * as React from "react";
import type { RccStructuredInput } from "@/lib/prompts/disease-templates/rcc-serializer";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface RccOtherFindingsCardProps {
  value: RccStructuredInput;
  onChange: (next: RccStructuredInput) => void;
}

/**
 * Section 4 — Other findings (free-text).
 *
 * Lets the radiologist append clinically relevant observations that the 13 SAR
 * Core feature fields do not cover (e.g., adrenal incidentaloma, vertebral
 * degenerative changes). The textarea content is wired into
 * `RccStructuredInput.otherFindings` and serialized as a verbatim
 * "Other findings:" block at the end of the prompt input — multi-line is
 * preserved (unlike `clinicalInformation` which is flattened).
 *
 * The system prompt (rcc.ts `=== OTHER FINDINGS HANDLING ===` + HARD rule 10)
 * instructs the LLM to weave each entry into the FINDINGS section.
 */
export function RccOtherFindingsCard({
  value,
  onChange,
}: RccOtherFindingsCardProps) {
  const id = "other-findings-text";

  return (
    <Card className="shadow-sm ring-1 ring-border/50">
      <CardHeader className="pb-4">
        {/* Numbered section header (4/4). Matches the typography + numbered
            badge used by the Clinical context (1), Mass (2), and Lymph nodes
            & Distant metastases (3) sections so the four top-level form
            sections read as a coherent series. */}
        <CardTitle className="flex items-center gap-3 text-lg font-bold tracking-tight text-foreground">
          <span
            aria-hidden="true"
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground shadow-sm"
          >
            4
          </span>
          Other findings
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-lg border border-border p-3 flex flex-col gap-2">
          <label
            htmlFor={id}
            className="text-[0.9375rem] font-bold tracking-tight text-foreground"
          >
            Additional findings or impressions
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              기타 소견 (선택사항)
            </span>
          </label>
          <textarea
            id={id}
            rows={5}
            value={value.otherFindings ?? ""}
            onChange={(e) =>
              onChange({
                ...value,
                otherFindings: e.target.value || undefined,
              })
            }
            placeholder="예) Right adrenal nodule (1 cm, likely adenoma) / Mild degenerative changes in visualized vertebrae / Note any incidental findings the structured fields do not cover."
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y"
          />
        </div>
      </CardContent>
    </Card>
  );
}
