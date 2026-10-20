"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import {
  createEmptyProstateLesion,
  type ProstateLesion,
  type ProstateStructuredInput,
} from "@/lib/prompts/disease-templates/prostate-serializer";
import { Button } from "@/components/ui/button";
import { ProstateClinicalContextCard } from "@/components/prostate-clinical-context-card";
import { ProstateLesionCard } from "@/components/prostate-lesion-card";
import { ProstateStudyLevelCard } from "@/components/prostate-study-level-card";
import { ProstateOtherFindingsCard } from "@/components/prostate-other-findings-card";
import { FormSection } from "@/components/compact-form";

// Re-export the initial-state factories from the serializer module so callers
// only need to import from this orchestrator file when wiring the form.
export {
  createEmptyProstateInput,
  createEmptyProstateLesion,
} from "@/lib/prompts/disease-templates/prostate-serializer";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * PI-RADS v2.1 supports up to 4 index lesions per scan; additional foci are
 * typically described as confluent or as part of an existing region rather
 * than as separate lesions. This UI cap mirrors the PI-RADS reporting
 * convention.
 */
const MAX_LESIONS = 4;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ProstateStructuredFormProps {
  value: ProstateStructuredInput;
  onChange: (next: ProstateStructuredInput) => void;
  /** Surfaced near the lesion-list header when present. */
  error?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ProstateStructuredForm({
  value,
  onChange,
  error,
}: ProstateStructuredFormProps) {
  const lesionCount = value.lesions.length;
  const canAddLesion = lesionCount < MAX_LESIONS;

  // Spread `value` first so that whole-gland fields (PI-QUAL, lymph nodes,
  // staging overrides, …) survive lesion-list mutations — same pattern as
  // rcc-structured-form.tsx for the masses array.
  const handleLesionChange = (idx: number, next: ProstateLesion) => {
    onChange({
      ...value,
      lesions: value.lesions.map((l, i) => (i === idx ? next : l)),
    });
  };

  const handleLesionRemove = (idx: number) => {
    onChange({
      ...value,
      lesions: value.lesions
        .filter((_, i) => i !== idx)
        // Re-index the remaining lesions so `lesionIndex` stays 1-based and
        // contiguous, matching the visible "#N" instance suffix on each card.
        .map((l, i) => ({ ...l, lesionIndex: i + 1 })),
    });
  };

  const handleAddLesion = () => {
    if (!canAddLesion) return;
    onChange({
      ...value,
      lesions: [...value.lesions, createEmptyProstateLesion(lesionCount + 1)],
    });
  };

  const negative = value.noSuspiciousLesion;

  return (
    <div className="flex flex-col gap-3">
      {/* SPEC-UI-001 R3 disclaimer, kept to one line: colour coding is a
          visual aid only; clinical decisions remain the radiologist's. */}
      <p role="note" className="text-xs text-muted-foreground">
        <span aria-hidden="true" className="font-bold text-destructive">
          *
        </span>{" "}
        필수 항목 · 색상 표기는 시각 보조이며 진단·치료 결정은 영상의학
        전문의의 판단을 따릅니다.
        <span className="sr-only">
          {" "}
          Fields marked with an asterisk are required. Color coding is a
          visual aid; clinical decisions are the radiologist&apos;s
          responsibility.
        </span>
      </p>

      {error && (
        <p
          role="alert"
          className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </p>
      )}

      {/* Section 1 */}
      <ProstateClinicalContextCard value={value} onChange={onChange} />

      {/* Section 2 — repeatable lesion cards. The "no suspicious lesion"
          toggle lives here, next to what it replaces: checking it treats the
          study as a negative MRI, clears the lesions and only collects
          whole-gland / PI-QUAL data downstream. */}
      <FormSection
        id="prostate-section-lesions"
        step={2}
        title="병변"
        summary={
          negative ? "음성 MRI" : `${lesionCount}/${MAX_LESIONS}`
        }
        actions={
          <>
            <label className="inline-flex cursor-pointer items-center gap-1.5 text-[13px] text-foreground/80">
              <input
                type="checkbox"
                id="prostate-clinical-noSuspiciousLesion"
                checked={negative}
                onChange={(e) => {
                  const checked = e.target.checked;
                  onChange({
                    ...value,
                    noSuspiciousLesion: checked,
                    lesions: checked ? [] : value.lesions,
                  });
                }}
                className="h-4 w-4 accent-[var(--color-primary)]"
              />
              의심 병변 없음 (PI-RADS ≤ 2)
            </label>
            {!negative && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={handleAddLesion}
                disabled={!canAddLesion}
                aria-label={
                  canAddLesion
                    ? "Add lesion"
                    : `Maximum ${MAX_LESIONS} lesions reached`
                }
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                병변 추가
              </Button>
            )}
          </>
        }
      >
        {negative ? (
          <p className="py-1 text-xs text-muted-foreground">
            음성 MRI 양식으로 작성됩니다. 병변 입력과 병기는 생략됩니다.
          </p>
        ) : value.lesions.length === 0 ? (
          <p className="py-1 text-xs text-muted-foreground">
            병변을 추가하세요. 의심 병변이 없으면 &lsquo;의심 병변 없음&rsquo;을
            체크합니다.
          </p>
        ) : (
          <div className="flex flex-col gap-2 pt-1">
            {value.lesions.map((lesion, idx) => (
              <ProstateLesionCard
                key={idx}
                lesion={lesion}
                index={idx}
                onChange={(next) => handleLesionChange(idx, next)}
                onRemove={() => handleLesionRemove(idx)}
                parentPriorMRIDate={value.priorMRIDate}
              />
            ))}
          </div>
        )}
      </FormSection>

      {/* Section 3 */}
      <ProstateStudyLevelCard value={value} onChange={onChange} />

      {/* Section 4 */}
      <ProstateOtherFindingsCard value={value} onChange={onChange} />
    </div>
  );
}
