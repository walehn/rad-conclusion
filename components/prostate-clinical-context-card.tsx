"use client";

import * as React from "react";
import {
  CLINICAL_INDICATION_OPTIONS,
  CLINICAL_T_OPTIONS,
  PRIOR_BIOPSY_STATUS_OPTIONS,
  type ClinicalIndication,
  type ClinicalT,
  type PriorBiopsyStatus,
} from "@/lib/prompts/disease-templates/prostate-fields";
import type { ProstateStructuredInput } from "@/lib/prompts/disease-templates/prostate-serializer";
import {
  SegmentedControl,
  type SegmentedControlOption,
} from "@/components/ui/segmented-control";
import {
  DateInput,
  Disclosure,
  FormSection,
  InlineField,
  NumberInput,
  Row,
  compactInputClass,
  compactTextareaClass,
} from "@/components/compact-form";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Option labels — short Korean labels so each group fits one row
// ---------------------------------------------------------------------------

const CLINICAL_INDICATION_LABEL: Record<ClinicalIndication, string> = {
  pre_biopsy_initial: "생검 전 (초기)",
  pre_biopsy_repeat_after_negative: "생검 전 (음성 후 재검)",
  staging_after_diagnosis: "진단 후 병기",
};

const PRIOR_BIOPSY_STATUS_LABEL: Record<PriorBiopsyStatus, string> = {
  none: "없음",
  negative: "음성",
  positive_ISUP1: "ISUP 1",
  positive_ISUP2: "ISUP 2",
  positive_ISUP3: "ISUP 3",
  positive_ISUP4: "ISUP 4",
  positive_ISUP5: "ISUP 5",
  unknown: "미상",
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

  // ---------------------------------------------------------------------
  // PSA measurement date ↔ psaDateOffsetDays bridge.
  // The canonical structured field stays `psaDateOffsetDays` (0–365) so the
  // serializer and downstream prompts are untouched, but the UI exposes a
  // date picker that converts to/from the offset automatically. This avoids
  // forcing the radiologist to count days by hand. All math runs in UTC at
  // midnight to dodge DST half-day drift on `Date.parse`.
  // ---------------------------------------------------------------------
  const PSA_OFFSET_MAX_DAYS = 365;
  const MS_PER_DAY = 86_400_000;
  const toUTCMidnight = (iso: string): number | undefined => {
    // Expect "YYYY-MM-DD" from <input type="date">; reject anything else so
    // a malformed value never silently produces NaN math.
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    if (!m) return undefined;
    const ms = Date.UTC(
      Number.parseInt(m[1], 10),
      Number.parseInt(m[2], 10) - 1,
      Number.parseInt(m[3], 10)
    );
    return Number.isNaN(ms) ? undefined : ms;
  };
  const fromUTCMidnight = (ms: number): string => {
    return new Date(ms).toISOString().slice(0, 10);
  };

  const derivedPsaMeasurementDate = React.useMemo<string | undefined>(() => {
    if (!value.studyDate || value.psaDateOffsetDays === undefined)
      return undefined;
    const studyMs = toUTCMidnight(value.studyDate);
    if (studyMs === undefined) return undefined;
    return fromUTCMidnight(studyMs - value.psaDateOffsetDays * MS_PER_DAY);
  }, [value.studyDate, value.psaDateOffsetDays]);

  const psaDateMin = React.useMemo<string | undefined>(() => {
    if (!value.studyDate) return undefined;
    const studyMs = toUTCMidnight(value.studyDate);
    if (studyMs === undefined) return undefined;
    return fromUTCMidnight(studyMs - PSA_OFFSET_MAX_DAYS * MS_PER_DAY);
  }, [value.studyDate]);

  const handlePsaMeasurementDateChange = (next: string | undefined) => {
    if (next === undefined) {
      onChange({ ...value, psaDateOffsetDays: undefined });
      return;
    }
    if (!value.studyDate) return;
    const studyMs = toUTCMidnight(value.studyDate);
    const psaMs = toUTCMidnight(next);
    if (studyMs === undefined || psaMs === undefined) return;
    const diff = Math.round((studyMs - psaMs) / MS_PER_DAY);
    const clamped = Math.max(0, Math.min(PSA_OFFSET_MAX_DAYS, diff));
    onChange({ ...value, psaDateOffsetDays: clamped });
  };

  const psaOffsetNote =
    value.psaDateOffsetDays === undefined
      ? undefined
      : value.psaDateOffsetDays === 0
        ? "검사일과 같은 날"
        : `검사 ${value.psaDateOffsetDays}일 전`;

  const notes = value.additionalClinicalNotes?.trim();
  const extraSummary =
    [
      value.dreClinicalT && `DRE ${value.dreClinicalT}`,
      value.priorMRIDate && `이전 MRI ${value.priorMRIDate}`,
      notes && "임상 메모 있음",
    ]
      .filter(Boolean)
      .join(" · ") || "DRE · 이전 MRI 날짜 · 임상 메모";

  return (
    <FormSection id="prostate-section-clinical" step={1} title="임상 정보">
      <Row label="검사일" required htmlFor={id("studyDate")}>
        <DateInput
          id={id("studyDate")}
          value={value.studyDate || undefined}
          onChange={(v) => onChange({ ...value, studyDate: v ?? "" })}
        />
        <InlineField label="나이" htmlFor={id("age")}>
          <NumberInput
            id={id("age")}
            value={value.patientAgeYears}
            onChange={(v) => onChange({ ...value, patientAgeYears: v })}
            unit="세"
            min="40"
            max="100"
            widthClass="w-16"
          />
        </InlineField>
      </Row>

      <Row label="PSA" required htmlFor={id("psa")}>
        <NumberInput
          id={id("psa")}
          value={value.psaNgPerMl}
          onChange={(v) => onChange({ ...value, psaNgPerMl: v ?? 0 })}
          unit="ng/mL"
          min="0"
          max="500"
          step="0.1"
          emptyWhenZero
        />
        {/* PSA measurement date — restricted to [studyDate − 365, studyDate];
            disabled until a study date is entered. */}
        <InlineField label="측정일" htmlFor={id("psaDate")}>
          <DateInput
            id={id("psaDate")}
            value={derivedPsaMeasurementDate}
            onChange={handlePsaMeasurementDateChange}
            min={psaDateMin}
            max={value.studyDate || undefined}
            disabled={!value.studyDate}
          />
          {psaOffsetNote && (
            <span className="text-xs text-muted-foreground">
              {psaOffsetNote}
            </span>
          )}
        </InlineField>
      </Row>

      <Row label="적응증" labelId={id("indication-label")}>
        <SegmentedControl<ClinicalIndication>
          name={id("indication")}
          ariaLabel="임상 적응증 (Clinical indication)"
          size="xs"
          value={value.clinicalIndication}
          options={toLabeledOptions(
            CLINICAL_INDICATION_OPTIONS,
            CLINICAL_INDICATION_LABEL
          )}
          onChange={(next) => onChange({ ...value, clinicalIndication: next })}
        />
      </Row>

      <Row label="이전 생검" labelId={id("biopsy-label")}>
        <SegmentedControl<PriorBiopsyStatus>
          name={id("priorBiopsyStatus")}
          ariaLabel="이전 생검 결과 (Prior biopsy status)"
          size="xs"
          value={value.priorBiopsyStatus}
          options={toLabeledOptions(
            PRIOR_BIOPSY_STATUS_OPTIONS,
            PRIOR_BIOPSY_STATUS_LABEL
          )}
          onChange={handlePriorBiopsyStatusChange}
        />
        {value.priorBiopsyStatus !== "none" && (
          <InlineField label="생검일" htmlFor={id("priorBiopsyDate")}>
            <DateInput
              id={id("priorBiopsyDate")}
              value={value.priorBiopsyDate}
              onChange={(v) => onChange({ ...value, priorBiopsyDate: v })}
            />
          </InlineField>
        )}
      </Row>

      <Disclosure
        id={id("extra")}
        label="추가 정보"
        summary={extraSummary}
        forceOpen={Boolean(value.dreClinicalT || value.priorMRIDate || notes)}
      >
        <Row label="DRE (cT)" htmlFor={id("dreClinicalT")}>
          <select
            id={id("dreClinicalT")}
            value={value.dreClinicalT ?? ""}
            onChange={(e) =>
              onChange({
                ...value,
                dreClinicalT: (e.target.value || undefined) as ClinicalT | undefined,
              })
            }
            className={cn(compactInputClass, "w-auto pr-6")}
          >
            <option value="">제공 안 됨</option>
            {CLINICAL_T_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
          <span className="text-xs text-muted-foreground">
            의뢰의의 직장수지검사 결과. MRI 병기와 따로 표기됩니다.
          </span>
        </Row>
        <Row label="이전 MRI" htmlFor={id("priorMRIDate")}>
          <DateInput
            id={id("priorMRIDate")}
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
          />
          <span className="text-xs text-muted-foreground">
            입력하면 병변별 이전 MRI 비교 항목이 열립니다.
          </span>
        </Row>
        <Row label="임상 메모" htmlFor={id("notes")} align="start">
          <textarea
            id={id("notes")}
            rows={2}
            maxLength={500}
            value={value.additionalClinicalNotes ?? ""}
            onChange={(e) =>
              onChange({
                ...value,
                additionalClinicalNotes: e.target.value || undefined,
              })
            }
            placeholder="예) Family history, prior radiation therapy, anticoagulation"
            className={compactTextareaClass}
          />
        </Row>
      </Disclosure>
    </FormSection>
  );
}
