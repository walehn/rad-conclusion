"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import type { ProstateStructuredInput } from "@/lib/prompts/disease-templates/prostate-serializer";
import { FormSection, Row, compactTextareaClass } from "@/components/compact-form";

interface ProstateOtherFindingsCardProps {
  value: ProstateStructuredInput;
  onChange: (next: ProstateStructuredInput) => void;
}

type FreeTextKey = "incidentalFindings" | "bonyAbnormalities" | "recommendations";

/**
 * Section 4 — Other findings (free-text, prostate variant).
 *
 * Three free-text fields that the prostate serializer round-trips verbatim
 * under the `OTHER FINDINGS` block (multi-line preserved). Each stays a
 * one-word button until opened; a field that holds text is always shown.
 * Soft length caps via `maxLength` keep the prompt within budget; the
 * serializer itself does not truncate.
 */
const FIELDS: ReadonlyArray<{
  key: FreeTextKey;
  label: string;
  maxLength: number;
  placeholder: string;
}> = [
  {
    key: "incidentalFindings",
    label: "우연 소견",
    maxLength: 1000,
    placeholder:
      "예) Right adrenal nodule (1 cm, likely adenoma) / Mild hip joint degenerative changes",
  },
  {
    key: "bonyAbnormalities",
    label: "골 소견",
    maxLength: 500,
    placeholder: "예) L4-5 mild facet arthropathy",
  },
  {
    key: "recommendations",
    label: "권고사항",
    maxLength: 500,
    placeholder: "예) MRI-targeted biopsy of lesion #1; PSMA-PET if equivocal bone",
  },
];

export function ProstateOtherFindingsCard({
  value,
  onChange,
}: ProstateOtherFindingsCardProps) {
  const id = (suffix: string) => `prostate-other-${suffix}`;
  const [opened, setOpened] = React.useState<ReadonlySet<FreeTextKey>>(
    () => new Set()
  );
  const isShown = (key: FreeTextKey) => opened.has(key) || Boolean(value[key]);
  const shown = FIELDS.filter((f) => isShown(f.key));
  const hidden = FIELDS.filter((f) => !isShown(f.key));

  return (
    <FormSection
      id="prostate-section-other"
      step={4}
      title="기타 소견"
      summary="입력한 문장 그대로 리포트에 들어갑니다"
      actions={hidden.map((f) => (
        <button
          key={f.key}
          type="button"
          onClick={() => setOpened((prev) => new Set(prev).add(f.key))}
          className="inline-flex h-7 items-center gap-1 rounded-md border border-border px-2 text-xs text-foreground/80 hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          {f.label}
        </button>
      ))}
    >
      {shown.length > 0
        ? shown.map((f) => (
            <Row key={f.key} label={f.label} htmlFor={id(f.key)} align="start">
              <textarea
                id={id(f.key)}
                rows={2}
                maxLength={f.maxLength}
                autoFocus={opened.has(f.key) && !value[f.key]}
                value={value[f.key] ?? ""}
                onChange={(e) =>
                  onChange({ ...value, [f.key]: e.target.value || undefined })
                }
                placeholder={f.placeholder}
                className={compactTextareaClass}
              />
            </Row>
          ))
        : undefined}
    </FormSection>
  );
}
