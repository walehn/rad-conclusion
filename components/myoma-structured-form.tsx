"use client";

import * as React from "react";
import { AlertTriangle, Info, Plus } from "lucide-react";
import {
  collectSarcomaRedFlags,
  resolveIndexLesionIndex,
  type MyomaLesion,
  type MyomaStructuredInput,
} from "@/lib/prompts/disease-templates/myoma-serializer";
import { SARCOMA_RED_FLAG_THRESHOLD } from "@/lib/prompts/disease-templates/myoma-fields";
import { Button } from "@/components/ui/button";
import { MyomaClinicalContextCard } from "@/components/myoma-clinical-context-card";
import { MyomaUterusCard } from "@/components/myoma-uterus-card";
import { MyomaLesionCard } from "@/components/myoma-lesion-card";
import { MyomaAdenomyosisCard } from "@/components/myoma-adenomyosis-card";
import { MyomaAssociatedFindingsCard } from "@/components/myoma-associated-findings-card";
import { MyomaTreatmentPlanningCard } from "@/components/myoma-treatment-planning-card";
import { MyomaOtherFindingsCard } from "@/components/myoma-other-findings-card";
import { genClientId } from "@/lib/utils";

interface MyomaStructuredFormProps {
  value: MyomaStructuredInput;
  onChange: (next: MyomaStructuredInput) => void;
  error?: string;
}

/**
 * Uterine myoma structured input form.
 *
 * Card order mirrors the serialized block order: clinical context, uterus,
 * one card per lesion, adenomyosis, associated findings, purpose-conditional
 * treatment planning, free-text other findings.
 *
 * The leiomyosarcoma red-flag banner is live: it re-tallies on every change
 * with the same `collectSarcomaRedFlags` the serializer uses, so what the
 * radiologist sees while filling the form is exactly what the prompt will
 * claim.
 */
export function MyomaStructuredForm({
  value,
  onChange,
  error,
}: MyomaStructuredFormProps) {
  const removable = value.lesions.length > 1;
  const indexIdx = resolveIndexLesionIndex(value.lesions);
  const redFlags = collectSarcomaRedFlags(value);
  const hasPlanningCard =
    value.purpose === "HIFU/MRgFUS" ||
    value.purpose === "Uterine artery embolization";

  const handleLesionChange = (idx: number, next: MyomaLesion) => {
    onChange({
      ...value,
      lesions: value.lesions.map((lesion, i) => (i === idx ? next : lesion)),
    });
  };

  const handleLesionRemove = (idx: number) => {
    onChange({
      ...value,
      lesions: value.lesions.filter((_, i) => i !== idx),
    });
  };

  const handleAddLesion = () => {
    onChange({
      ...value,
      lesions: [...value.lesions, { id: genClientId() }],
    });
  };

  return (
    <div className="flex flex-col gap-6">
      {/* SPEC-UI-001 R3 disclaimer banner: derived values (FIGO, Funaki,
          red-flag tally) are decision aids only. */}
      <div
        role="note"
        className="flex items-start gap-2 rounded-md border border-border/50 bg-muted/40 px-3 py-2 text-xs text-muted-foreground"
      >
        <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <p>
          FIGO type·Funaki type·red flag 집계는 입력값에서 자동 산출되는 보조
          지표이며, 진단·치료 결정은 영상의학 전문의의 판단을 따릅니다.
          <span className="sr-only">
            {" "}
            Derived FIGO/Funaki types and the red-flag tally are decision aids;
            clinical decisions are the radiologist&apos;s responsibility.
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

      {/* Live leiomyosarcoma red-flag banner. Threshold reached (>=2 flags on
          one lesion) escalates to destructive tone; flags below threshold stay
          informational so a single degenerative feature does not read as an
          alarm. */}
      {redFlags.flags.length > 0 && (
        <div
          role="status"
          aria-live="polite"
          className={
            redFlags.concerning
              ? "flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
              : "flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2.5 text-sm text-warning"
          }
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <div className="flex flex-col gap-1">
            <p className="font-semibold">
              {redFlags.concerning
                ? `육종 감별 필요 — 한 병변에 red flag ${redFlags.maxPerLesion}개 (임계값 ${SARCOMA_RED_FLAG_THRESHOLD}개 도달)`
                : `Red flag ${redFlags.flags.length}건 — 임계값(한 병변 ${SARCOMA_RED_FLAG_THRESHOLD}개) 미달`}
            </p>
            <ul className="list-disc pl-4 text-xs">
              {redFlags.flags.map((flag) => (
                <li key={flag}>{flag}</li>
              ))}
              {redFlags.contextFlags.map((flag) => (
                <li key={flag}>Study level: {flag}</li>
              ))}
            </ul>
            {redFlags.concerning && (
              <p className="text-xs">
                판독문 CLASSIFICATION/IMPRESSION에 악성 간엽성 종양 배제 불가
                소견과 조직 확진 또는 단기 추적 권고가 포함됩니다.
              </p>
            )}
          </div>
        </div>
      )}

      <MyomaClinicalContextCard value={value} onChange={onChange} />
      <MyomaUterusCard value={value} onChange={onChange} />

      <div className="flex flex-col gap-6">
        {value.lesions.map((lesion, idx) => (
          <MyomaLesionCard
            key={lesion.id ?? idx}
            value={lesion}
            onChange={(next) => handleLesionChange(idx, next)}
            onRemove={() => handleLesionRemove(idx)}
            index={idx}
            removable={removable}
            isIndex={value.lesions.length > 1 && idx === indexIdx}
            allTypical={value.allTypical === true}
            purpose={value.purpose}
            studyDate={value.studyDate}
          />
        ))}
      </div>

      <div>
        <Button
          type="button"
          variant="outline"
          onClick={handleAddLesion}
          className="gap-2"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          근종 추가
        </Button>
      </div>

      <MyomaAdenomyosisCard value={value} onChange={onChange} />
      <MyomaAssociatedFindingsCard value={value} onChange={onChange} />
      <MyomaTreatmentPlanningCard value={value} onChange={onChange} />
      <MyomaOtherFindingsCard
        value={value}
        onChange={onChange}
        sectionNumber={hasPlanningCard ? 7 : 6}
      />
    </div>
  );
}
