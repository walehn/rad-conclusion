"use client";

import * as React from "react";
import type { ProstateStructuredInput } from "@/lib/prompts/disease-templates/prostate-serializer";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface ProstateOtherFindingsCardProps {
  value: ProstateStructuredInput;
  onChange: (next: ProstateStructuredInput) => void;
}

/**
 * Section 4 — Other findings (free-text, prostate variant).
 *
 * Mirrors `RccOtherFindingsCard` (SPEC-UI-001 §4) verbatim in structure.
 * Surfaces three free-text fields that the prostate serializer round-trips
 * verbatim under the `OTHER FINDINGS` block (multi-line preserved):
 *  - incidentalFindings (≤1000 chars)
 *  - bonyAbnormalities  (≤500 chars)
 *  - recommendations    (≤500 chars)
 *
 * Soft length caps via `maxLength` keep the LLM-input prompt within budget;
 * the serializer itself does not truncate.
 */
export function ProstateOtherFindingsCard({
  value,
  onChange,
}: ProstateOtherFindingsCardProps) {
  const id = (suffix: string) => `prostate-other-${suffix}`;

  return (
    <Card className="shadow-sm ring-1 ring-border/50">
      <CardHeader className="pb-4">
        {/* Numbered section header (4/4) — mirrors RCC parity. */}
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
        <div className="grid gap-x-6 gap-y-5">
          {/* Incidental findings — verbatim multi-line preserved by serializer. */}
          <div className="rounded-lg border border-border p-3 flex flex-col gap-2">
            <label
              htmlFor={id("incidental")}
              className="text-[0.9375rem] font-bold tracking-tight text-foreground"
            >
              Incidental findings
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                우연히 발견된 소견 (선택사항)
              </span>
            </label>
            <textarea
              id={id("incidental")}
              rows={4}
              maxLength={1000}
              value={value.incidentalFindings ?? ""}
              onChange={(e) =>
                onChange({
                  ...value,
                  incidentalFindings: e.target.value || undefined,
                })
              }
              placeholder="예) Right adrenal nodule (1 cm, likely adenoma) / Mild hip joint degenerative changes"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y"
            />
          </div>

          {/* Bony abnormalities — separate block so the LLM can weave it into
              the bone-survey portion of FINDINGS without scrambling
              recommendations. */}
          <div className="rounded-lg border border-border p-3 flex flex-col gap-2">
            <label
              htmlFor={id("bony")}
              className="text-[0.9375rem] font-bold tracking-tight text-foreground"
            >
              Bony abnormalities
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                골격계 이상 소견 (선택사항)
              </span>
            </label>
            <textarea
              id={id("bony")}
              rows={3}
              maxLength={500}
              value={value.bonyAbnormalities ?? ""}
              onChange={(e) =>
                onChange({
                  ...value,
                  bonyAbnormalities: e.target.value || undefined,
                })
              }
              placeholder="예) L4-5 mild facet arthropathy"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y"
            />
          </div>

          {/* Recommendations — final IMPRESSION-adjacent free-text. */}
          <div className="rounded-lg border border-border p-3 flex flex-col gap-2">
            <label
              htmlFor={id("recommendations")}
              className="text-[0.9375rem] font-bold tracking-tight text-foreground"
            >
              Recommendations
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                권장사항 (선택사항)
              </span>
            </label>
            <textarea
              id={id("recommendations")}
              rows={3}
              maxLength={500}
              value={value.recommendations ?? ""}
              onChange={(e) =>
                onChange({
                  ...value,
                  recommendations: e.target.value || undefined,
                })
              }
              placeholder="예) MRI-targeted biopsy of lesion #1; PSMA-PET if equivocal bone"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
