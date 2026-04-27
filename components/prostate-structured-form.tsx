"use client";

import * as React from "react";
import { Info, Plus } from "lucide-react";
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

  return (
    <div className="flex flex-col gap-6">
      {/*
        SPEC-UI-001 R3 disclaimer banner — identical wording to the RCC form.
        Color-coded radio cards (EPE risk, PI-QUAL overall, soft warnings) are
        visual aids only; clinical decisions remain the radiologist's
        responsibility.
      */}
      <div
        role="note"
        className="flex items-start gap-2 rounded-md border border-border/50 bg-muted/40 px-3 py-2 text-xs text-muted-foreground"
      >
        <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <p>
          색상 표기는 시각 보조이며, 진단·치료 결정은 영상의학 전문의의 판단을
          따릅니다.
          <span className="sr-only">
            {" "}
            Color coding is a visual aid; clinical decisions are the
            radiologist&apos;s responsibility.
          </span>
        </p>
      </div>

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

      {/* Section 2 — repeatable lesion cards */}
      <div className="flex flex-col gap-6">
        {value.lesions.length === 0 ? (
          <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
            아직 등록된 병변이 없습니다. 아래 &quot;Add lesion&quot; 버튼을
            눌러 PI-RADS v2.1 병변을 추가하세요.
          </div>
        ) : (
          value.lesions.map((lesion, idx) => (
            <ProstateLesionCard
              key={idx}
              lesion={lesion}
              index={idx}
              onChange={(next) => handleLesionChange(idx, next)}
              onRemove={() => handleLesionRemove(idx)}
              parentPriorMRIDate={value.priorMRIDate}
            />
          ))
        )}
      </div>

      <div>
        <Button
          type="button"
          variant="outline"
          onClick={handleAddLesion}
          disabled={!canAddLesion}
          className="w-full sm:w-auto"
          aria-label={
            canAddLesion
              ? "Add lesion"
              : `Maximum ${MAX_LESIONS} lesions reached`
          }
        >
          <Plus className="mr-2 h-4 w-4" />
          {canAddLesion
            ? `Add lesion (${lesionCount}/${MAX_LESIONS})`
            : `Max ${MAX_LESIONS} lesions reached`}
        </Button>
      </div>

      {/* Section 3 */}
      <ProstateStudyLevelCard value={value} onChange={onChange} />

      {/* Section 4 */}
      <ProstateOtherFindingsCard value={value} onChange={onChange} />
    </div>
  );
}
