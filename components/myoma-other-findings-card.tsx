"use client";

import * as React from "react";
import type { MyomaStructuredInput } from "@/lib/prompts/disease-templates/myoma-serializer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface MyomaOtherFindingsCardProps {
  value: MyomaStructuredInput;
  onChange: (next: MyomaStructuredInput) => void;
  /** Section number shown in the header badge (shifts when planning card hides). */
  sectionNumber: number;
}

/**
 * Final section — Other findings (free text).
 *
 * Multi-line content is preserved verbatim by the serializer and the system
 * prompt instructs the model to weave each entry into FINDINGS (mirrors the
 * RCC other-findings card).
 */
export function MyomaOtherFindingsCard({
  value,
  onChange,
  sectionNumber,
}: MyomaOtherFindingsCardProps) {
  const id = "myoma-other-findings-text";

  return (
    <Card className="shadow-sm ring-1 ring-border/50">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-3 text-lg font-bold tracking-tight text-foreground">
          <span
            aria-hidden="true"
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground shadow-sm"
          >
            {sectionNumber}
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
            placeholder="예) Right adnexal cyst (2 cm, likely functional) / Degenerative change of visualized spine / 구조화 필드가 다루지 않는 소견을 기록하세요."
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y"
          />
        </div>
      </CardContent>
    </Card>
  );
}
