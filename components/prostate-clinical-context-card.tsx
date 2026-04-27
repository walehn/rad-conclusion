"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  CLINICAL_INDICATION_OPTIONS,
  PRIOR_BIOPSY_STATUS_OPTIONS,
  DIGITAL_RECTAL_EXAM_OPTIONS,
  type ClinicalIndication,
  type PriorBiopsyStatus,
  type DigitalRectalExam,
} from "@/lib/prompts/disease-templates/prostate-fields";
import type { ProstateStructuredInput } from "@/lib/prompts/disease-templates/prostate-serializer";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  SegmentedControl,
  type SegmentedControlOption,
} from "@/components/ui/segmented-control";

// ---------------------------------------------------------------------------
// File-local helpers — mirror the FieldRow / NumberField / DateInput trio used
// by rcc-clinical-context-card.tsx and rcc-mass-card.tsx so the prostate form
// preserves visual rhythm with the RCC form (SPEC-UI-001 typographic parity).
// ---------------------------------------------------------------------------

function FieldRow({
  label,
  optional,
  children,
  className,
}: {
  label: string;
  optional?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border p-3 flex flex-col gap-2",
        className
      )}
    >
      <span className="px-1 text-[0.9375rem] font-bold tracking-tight text-foreground">
        {label}
        {optional && (
          <span className="ml-1 text-xs font-normal text-muted-foreground">
            (optional)
          </span>
        )}
      </span>
      {children}
    </div>
  );
}

function NumberField({
  id,
  label,
  value,
  onChange,
  unit,
  optional = false,
  step = "1",
  min,
  max,
  className,
}: {
  id: string;
  label: string;
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  unit?: string;
  optional?: boolean;
  step?: string;
  min?: string;
  max?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border p-3 flex flex-col gap-2",
        className
      )}
    >
      <label
        htmlFor={id}
        className="text-[0.9375rem] font-bold tracking-tight text-foreground"
      >
        {label}
        {optional && (
          <span className="ml-1 text-xs font-normal text-muted-foreground">
            (optional)
          </span>
        )}
      </label>
      <div className="flex items-center gap-2">
        <input
          id={id}
          type="number"
          step={step}
          min={min}
          max={max}
          value={value ?? ""}
          onChange={(e) => {
            const v =
              e.target.value === "" ? undefined : parseFloat(e.target.value);
            onChange(v);
          }}
          className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        {unit && (
          <span className="shrink-0 text-sm text-muted-foreground">{unit}</span>
        )}
      </div>
    </div>
  );
}

function DateInput({
  id,
  label,
  value,
  onChange,
  optional = false,
  className,
}: {
  id: string;
  label: string;
  value: string | undefined;
  onChange: (v: string | undefined) => void;
  optional?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border p-3 flex flex-col gap-2",
        className
      )}
    >
      <label
        htmlFor={id}
        className="text-[0.9375rem] font-bold tracking-tight text-foreground"
      >
        {label}
        {optional && (
          <span className="ml-1 text-xs font-normal text-muted-foreground">
            (optional)
          </span>
        )}
      </label>
      <input
        id={id}
        type="date"
        value={value ?? ""}
        onChange={(e) => {
          const v = e.target.value === "" ? undefined : e.target.value;
          onChange(v);
        }}
        className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bilingual option labels (Korean primary + English subtitle, RCC parity)
// ---------------------------------------------------------------------------

const CLINICAL_INDICATION_LABEL: Record<ClinicalIndication, string> = {
  pre_biopsy_initial: "Pre-biopsy (initial) · 초기 진단",
  pre_biopsy_repeat_after_negative:
    "Pre-biopsy (repeat after negative) · 음성 후 재검",
  staging_after_diagnosis: "Staging after diagnosis · 진단 후 병기설정",
};

const PRIOR_BIOPSY_STATUS_LABEL: Record<PriorBiopsyStatus, string> = {
  none: "None · 없음",
  negative: "Negative · 음성",
  positive_ISUP1: "Positive ISUP 1",
  positive_ISUP2: "Positive ISUP 2",
  positive_ISUP3: "Positive ISUP 3",
  positive_ISUP4: "Positive ISUP 4",
  positive_ISUP5: "Positive ISUP 5",
  unknown: "Unknown · 미상",
};

const DIGITAL_RECTAL_EXAM_LABEL: Record<DigitalRectalExam, string> = {
  not_performed: "Not performed",
  normal_T1c: "Normal (T1c)",
  palpable_unilateral_T2a_b: "Palpable unilateral (T2a/b)",
  palpable_bilateral_T2c: "Palpable bilateral (T2c)",
  extracapsular_T3: "Extracapsular (T3)",
  fixed_T4: "Fixed (T4)",
};

function toLabeledOptions<T extends string>(
  values: ReadonlyArray<T>,
  labels: Record<T, string>
): SegmentedControlOption<T>[] {
  return values.map((v) => ({ value: v, label: labels[v] }));
}

// ---------------------------------------------------------------------------
// Public component
// ---------------------------------------------------------------------------

interface ProstateClinicalContextCardProps {
  value: ProstateStructuredInput;
  onChange: (next: ProstateStructuredInput) => void;
}

export function ProstateClinicalContextCard({
  value,
  onChange,
}: ProstateClinicalContextCardProps) {
  const id = (suffix: string) => `prostate-clinical-${suffix}`;

  // Prior-biopsy status handler — clear `priorBiopsyDate` when reverting to
  // 'none' so the serializer never emits a stale prior-biopsy date for a
  // patient with no prior biopsy on record (E-2 conditional clearing).
  const handlePriorBiopsyStatusChange = (next: PriorBiopsyStatus) => {
    if (next === "none") {
      onChange({
        ...value,
        priorBiopsyStatus: next,
        priorBiopsyDate: undefined,
      });
    } else {
      onChange({ ...value, priorBiopsyStatus: next });
    }
  };

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
        <div className="grid gap-x-6 gap-y-5 md:grid-cols-2">
          {/* 1. Study date — required, ISO YYYY-MM-DD */}
          <DateInput
            id={id("studyDate")}
            label="Study date · 검사일"
            value={value.studyDate || undefined}
            onChange={(v) =>
              onChange({ ...value, studyDate: v ?? "" })
            }
          />

          {/* 2. Patient age (years) — optional, 40–100 */}
          <NumberField
            id={id("age")}
            label="Patient age · 환자 나이"
            value={value.patientAgeYears}
            onChange={(v) => onChange({ ...value, patientAgeYears: v })}
            unit="years"
            optional
            min="40"
            max="100"
            step="1"
          />

          {/* 3. Prior MRI date — optional. Clearing this also clears each
              lesion's `priorMRIComparison` (E-1) — handled at form-orchestrator
              level by `prostate-structured-form.tsx`. */}
          <DateInput
            id={id("priorMRIDate")}
            label="Prior MRI date · 이전 MRI 날짜"
            value={value.priorMRIDate}
            onChange={(v) => {
              if (v === undefined) {
                // Cascade: clearing prior MRI date wipes any per-lesion
                // priorMRIComparison values to keep the data model coherent.
                onChange({
                  ...value,
                  priorMRIDate: undefined,
                  lesions: value.lesions.map((l) => ({
                    ...l,
                    priorMRIComparison: undefined,
                  })),
                });
              } else {
                onChange({ ...value, priorMRIDate: v });
              }
            }}
            optional
          />

          {/* 4. Clinical indication — required. Only 3 enum values exposed
              per N-2 (the field type still admits all 3 declared options). */}
          <FieldRow
            label="Clinical indication · 임상 적응증"
            className="md:col-span-2"
          >
            <SegmentedControl<ClinicalIndication>
              name={id("indication")}
              ariaLabel="Clinical indication"
              value={value.clinicalIndication}
              options={toLabeledOptions(
                CLINICAL_INDICATION_OPTIONS,
                CLINICAL_INDICATION_LABEL
              )}
              onChange={(next) =>
                onChange({ ...value, clinicalIndication: next })
              }
            />
          </FieldRow>

          {/* 5. PSA (ng/mL) — required, 0–500, 1 dp */}
          <NumberField
            id={id("psa")}
            label="PSA"
            value={value.psaNgPerMl}
            onChange={(v) =>
              onChange({ ...value, psaNgPerMl: v ?? 0 })
            }
            unit="ng/mL"
            min="0"
            max="500"
            step="0.1"
          />

          {/* 6. PSA date offset (days) — optional, 0–365 */}
          <NumberField
            id={id("psaOffset")}
            label="PSA date offset · PSA 측정일과 검사일 간격"
            value={value.psaDateOffsetDays}
            onChange={(v) => onChange({ ...value, psaDateOffsetDays: v })}
            unit="days"
            optional
            min="0"
            max="365"
            step="1"
          />

          {/* 7. Prior biopsy status — required (8 values).
              Spans both columns so the long enum labels (e.g. "Positive
              ISUP 1") are not crushed onto multiple lines. */}
          <FieldRow
            label="Prior biopsy status · 이전 생검 결과"
            className="md:col-span-2"
          >
            <SegmentedControl<PriorBiopsyStatus>
              name={id("priorBiopsyStatus")}
              ariaLabel="Prior biopsy status"
              value={value.priorBiopsyStatus}
              options={toLabeledOptions(
                PRIOR_BIOPSY_STATUS_OPTIONS,
                PRIOR_BIOPSY_STATUS_LABEL
              )}
              onChange={handlePriorBiopsyStatusChange}
            />
          </FieldRow>

          {/* 8. Prior biopsy date — conditional on priorBiopsyStatus !== 'none'
              (E-2). Cleared automatically when status reverts to 'none' via
              `handlePriorBiopsyStatusChange` above. */}
          {value.priorBiopsyStatus !== "none" && (
            <DateInput
              id={id("priorBiopsyDate")}
              label="Prior biopsy date · 이전 생검일"
              value={value.priorBiopsyDate}
              onChange={(v) => onChange({ ...value, priorBiopsyDate: v })}
              optional
              className="md:col-span-2"
            />
          )}

          {/* 9. Digital rectal exam — optional (6 values). T-stage hints
              embedded in the option labels (e.g. "Palpable bilateral (T2c)"). */}
          <FieldRow
            label="Digital rectal exam · 직장수지검사"
            optional
            className="md:col-span-2"
          >
            <SegmentedControl<DigitalRectalExam>
              name={id("dre")}
              ariaLabel="Digital rectal exam"
              value={value.digitalRectalExam}
              options={toLabeledOptions(
                DIGITAL_RECTAL_EXAM_OPTIONS,
                DIGITAL_RECTAL_EXAM_LABEL
              )}
              onChange={(next) =>
                onChange({ ...value, digitalRectalExam: next })
              }
            />
          </FieldRow>

          {/* 10. Additional clinical notes — optional, ≤500 chars */}
          <div className="rounded-lg border border-border p-3 flex flex-col gap-2 md:col-span-2">
            <label
              htmlFor={id("notes")}
              className="text-[0.9375rem] font-bold tracking-tight text-foreground"
            >
              Additional clinical notes · 추가 임상 정보
              <span className="ml-1 text-xs font-normal text-muted-foreground">
                (optional)
              </span>
            </label>
            <textarea
              id={id("notes")}
              rows={3}
              maxLength={500}
              value={value.additionalClinicalNotes ?? ""}
              onChange={(e) =>
                onChange({
                  ...value,
                  additionalClinicalNotes: e.target.value || undefined,
                })
              }
              placeholder="예) Family history, prior radiation therapy, anticoagulation"
              className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
