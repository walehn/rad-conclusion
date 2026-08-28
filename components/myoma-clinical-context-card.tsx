"use client";

import * as React from "react";
import type { MyomaStructuredInput } from "@/lib/prompts/disease-templates/myoma-serializer";
import {
  MYOMA_INDICATIONS,
  MYOMA_MENOPAUSAL_STATUS,
  MYOMA_PRIOR_TREATMENTS,
  MYOMA_PURPOSES,
} from "@/lib/prompts/disease-templates/myoma-fields";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  SegmentedControl,
  toSegmentedOptions,
} from "@/components/ui/segmented-control";
import {
  CheckboxGroup,
  DateInput,
  FieldRow,
} from "@/components/myoma-form-fields";

interface MyomaClinicalContextCardProps {
  value: MyomaStructuredInput;
  onChange: (next: MyomaStructuredInput) => void;
}

/**
 * Section 1 — Clinical context.
 *
 * Alongside the free-text history this card collects the two inputs that
 * change how the rest of the form behaves:
 *   - `purpose` gates the purpose-conditional fields (UAE enhancement
 *     requirement, HIFU acoustic-window block, Funaki reference) downstream.
 *   - `menopausalStatus` feeds the sarcoma red-flag tally (interval growth
 *     after menopause is its own flag).
 */
export function MyomaClinicalContextCard({
  value,
  onChange,
}: MyomaClinicalContextCardProps) {
  const id = (suffix: string) => `myoma-clinical-${suffix}`;

  return (
    <Card className="shadow-sm ring-1 ring-border/50">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-3 text-lg font-bold tracking-tight text-foreground">
          <span
            aria-hidden="true"
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground shadow-sm"
          >
            1
          </span>
          Clinical context
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-x-6 gap-y-5 md:grid-cols-3">
          <div className="rounded-lg border border-border p-3 flex flex-col gap-2 md:col-span-2">
            <label
              htmlFor={id("info")}
              className="text-[0.9375rem] font-bold tracking-tight text-foreground"
            >
              Clinical information
              <span className="ml-1 text-xs font-normal text-muted-foreground">
                (optional)
              </span>
            </label>
            <textarea
              id={id("info")}
              rows={3}
              value={value.clinicalInformation ?? ""}
              onChange={(e) =>
                onChange({
                  ...value,
                  clinicalInformation: e.target.value || undefined,
                })
              }
              placeholder="Symptoms, parity, prior surgery, referring question..."
              className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y"
            />
          </div>

          <DateInput
            id={id("study-date")}
            label="Study date"
            value={value.studyDate}
            onChange={(v) => onChange({ ...value, studyDate: v })}
            optional
          />

          <CheckboxGroup
            id={id("indications")}
            legend="Indication"
            hint="의뢰 사유 (복수 선택)"
            options={MYOMA_INDICATIONS}
            selected={value.indications}
            onChange={(next) =>
              onChange({
                ...value,
                indications: next.length > 0 ? next : undefined,
              })
            }
            className="md:col-span-2"
          />

          <FieldRow label="Menopausal status" hint="폐경 여부">
            <SegmentedControl
              name={id("menopause")}
              ariaLabel="Menopausal status"
              value={value.menopausalStatus}
              options={toSegmentedOptions(MYOMA_MENOPAUSAL_STATUS)}
              onChange={(opt) =>
                onChange({ ...value, menopausalStatus: opt })
              }
            />
          </FieldRow>

          <CheckboxGroup
            id={id("prior-treatments")}
            legend="Prior treatment"
            hint="이전 치료력 (복수 선택)"
            options={MYOMA_PRIOR_TREATMENTS}
            selected={value.priorTreatments}
            onChange={(next) =>
              onChange({
                ...value,
                priorTreatments: next.length > 0 ? next : undefined,
              })
            }
            className="md:col-span-3"
          />

          {/* Referral purpose drives conditional requirements downstream, so a
              deselect must also clear the purpose-specific study-level fields:
              stale acoustic-window answers from an earlier HIFU selection
              would otherwise silently ship in a myomectomy prompt. */}
          <FieldRow
            label="Referral purpose"
            hint="의뢰 목적 — 선택 시 관련 필드가 추가됩니다"
            className="md:col-span-3"
          >
            <div className="flex flex-wrap items-center gap-2">
              <SegmentedControl
                name={id("purpose")}
                ariaLabel="Referral purpose"
                value={value.purpose}
                options={toSegmentedOptions(MYOMA_PURPOSES)}
                onChange={(opt) => onChange({ ...value, purpose: opt })}
              />
              {value.purpose !== undefined && (
                <button
                  type="button"
                  onClick={() =>
                    onChange({
                      ...value,
                      purpose: undefined,
                      skinToLesionCm: undefined,
                      abdominalWallScar: undefined,
                      bowelInterposition: undefined,
                      ovarianArterySupply: undefined,
                    })
                  }
                  className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                >
                  선택 해제
                </button>
              )}
            </div>
          </FieldRow>

          {value.purpose === "Follow-up" && (
            <DateInput
              id={id("comparison-date")}
              label="Comparison study date"
              value={value.comparisonStudyDate}
              onChange={(v) =>
                onChange({ ...value, comparisonStudyDate: v })
              }
              optional
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
