"use client";

import * as React from "react";
import { AlertTriangle, ChevronDown, ChevronUp, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CRANIOCAUDAL_LEVEL_OPTIONS,
  DCE_RESULT_OPTIONS,
  EPE_RISK_OPTIONS,
  LATERALITY_OPTIONS,
  NVB_INVOLVEMENT_OPTIONS,
  PIRADS_SCORE_OPTIONS,
  PRIOR_MRI_COMPARISON_OPTIONS,
  PROSTATE_SECTOR_CODES_FULL,
  PROSTATE_SECTOR_CODES_SIMPLIFIED,
  RELATION_TO_APEX_OPTIONS,
  RELATION_TO_URETHRA_OPTIONS,
  SVI_SUSPICION_OPTIONS,
  ZONE_OPTIONS,
  type CraniocaudalLevel,
  type DceResult,
  type EpeRisk,
  type Laterality,
  type NvbInvolvement,
  type PiradsScore,
  type PriorMriComparison,
  type RelationToApex,
  type RelationToUrethra,
  type SviSuspicion,
  type Zone,
} from "@/lib/prompts/disease-templates/prostate-fields";
import {
  derivePiradsCategory,
  type ProstateLesion,
} from "@/lib/prompts/disease-templates/prostate-serializer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  SegmentedControl,
  toSegmentedOptions,
  type SegmentedControlOption,
} from "@/components/ui/segmented-control";
import {
  RadioCardGroup,
  type RadioCardOption,
  type SemanticTone,
} from "@/components/ui/radio-card-group";

// ---------------------------------------------------------------------------
// File-local helpers (mirror rcc-mass-card.tsx for visual rhythm parity)
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
  step = "0.1",
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

// ---------------------------------------------------------------------------
// Bilingual option labels
// ---------------------------------------------------------------------------

const ZONE_LABEL: Record<Zone, string> = {
  peripheral_zone_PZ: "PZ · 말초대",
  transition_zone_TZ: "TZ · 이행대",
  central_zone_CZ: "CZ · 중심대",
  anterior_fibromuscular_stroma_AFMS: "AFMS · 전섬유근간질",
};

const CRANIOCAUDAL_LABEL: Record<CraniocaudalLevel, string> = {
  base: "Base · 기저부",
  mid_gland: "Mid · 중간",
  apex: "Apex · 첨부",
};

const LATERALITY_LABEL: Record<Laterality, string> = {
  right: "Right · 우측",
  left: "Left · 좌측",
  midline_bilateral: "Midline / Bilateral · 중앙/양측",
};

const DCE_LABEL: Record<DceResult, string> = {
  negative: "Negative · 음성",
  positive: "Positive · 양성",
  not_performed_bpMRI: "bpMRI (DCE 미수행)",
};

const SVI_SUSPICION_LABEL: Record<SviSuspicion, string> = {
  none: "None · 없음",
  suspected: "Suspected · 의심",
  definite: "Definite · 확실",
};

const NVB_LABEL: Record<NvbInvolvement, string> = {
  none: "None · 없음",
  abutment: "Abutment · 인접",
  encasement: "Encasement · 침범",
};

const RELATION_APEX_LABEL: Record<RelationToApex, string> = {
  apex: "Apex",
  mid: "Mid",
  base: "Base",
  apex_to_mid: "Apex → Mid",
  mid_to_base: "Mid → Base",
  whole_gland: "Whole gland",
};

const RELATION_URETHRA_LABEL: Record<RelationToUrethra, string> = {
  not_abutting: "Not abutting · 인접 없음",
  abutting: "Abutting · 인접",
  involving: "Involving · 침범",
};

const PRIOR_MRI_LABEL: Record<PriorMriComparison, string> = {
  new_lesion: "New lesion · 신생 병변",
  unchanged: "Unchanged · 변화 없음",
  decreased: "Decreased · 감소",
  increased_size_only: "Increased size only · 크기만 증가",
  increased_score: "Increased score · 점수 증가",
  not_visible_on_prior: "Not visible on prior · 이전 영상에 없음",
};

const EPE_RISK_LABEL: Record<EpeRisk, string> = {
  "0_no_features": "0 · No features",
  "1_curvilinear_or_bulge": "1 · Curvilinear / bulge",
  "2_both_features": "2 · Both features",
  "3_frank_breach": "3 · Frank breach",
};

const EPE_RISK_SUBLABEL: Record<EpeRisk, string> = {
  "0_no_features": "특징 없음",
  "1_curvilinear_or_bulge": "곡선상 음영 또는 융기",
  "2_both_features": "두 가지 모두",
  "3_frank_breach": "명백한 피막 침범",
};

const EPE_RISK_TONE: Record<EpeRisk, SemanticTone> = {
  "0_no_features": "success",
  "1_curvilinear_or_bulge": "warning",
  "2_both_features": "orange",
  "3_frank_breach": "destructive",
};

function toLabeledOptions<T extends string>(
  values: ReadonlyArray<T>,
  labels: Record<T, string>
): SegmentedControlOption<T>[] {
  return values.map((v) => ({ value: v, label: labels[v] }));
}

const EPE_RISK_RADIO_OPTIONS: ReadonlyArray<RadioCardOption<EpeRisk>> =
  EPE_RISK_OPTIONS.map((v) => ({
    value: v,
    label: EPE_RISK_LABEL[v],
    sublabel: EPE_RISK_SUBLABEL[v],
    tone: EPE_RISK_TONE[v],
  }));

// ---------------------------------------------------------------------------
// Sector picker — multi-select toggle row (simplified) + disclosure for full
// 38-sector PI-RADS v2.1 map.
// ---------------------------------------------------------------------------

interface SectorPickerProps {
  /** Per-card unique id prefix (sector input names). */
  id: string;
  selected: string[];
  onChange: (next: string[]) => void;
}

function SectorPicker({ id, selected, onChange }: SectorPickerProps) {
  const [showFull, setShowFull] = React.useState<boolean>(false);

  const toggle = (code: string) => {
    if (selected.includes(code)) {
      onChange(selected.filter((c) => c !== code));
    } else {
      onChange([...selected, code]);
    }
  };

  const renderChip = (code: string) => {
    const active = selected.includes(code);
    return (
      <button
        key={code}
        type="button"
        role="checkbox"
        aria-checked={active}
        onClick={() => toggle(code)}
        className={cn(
          "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
          active
            ? "bg-primary/15 ring-2 ring-primary/40 border-primary text-foreground"
            : "border-border bg-background text-foreground/80 hover:bg-muted/50"
        )}
      >
        {code}
      </button>
    );
  };

  return (
    <fieldset
      aria-labelledby={`${id}-legend`}
      className="rounded-lg border border-border p-3 flex flex-col gap-3 md:col-span-2"
    >
      <legend
        id={`${id}-legend`}
        className="px-1 text-[0.9375rem] font-bold tracking-tight text-foreground"
      >
        Sector map location · 분획 위치
        <span className="ml-1 text-xs font-normal text-muted-foreground">
          (≥1 required)
        </span>
      </legend>

      {/* Simplified 6-sector picker — default visible */}
      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium text-muted-foreground">
          Simplified (6 sectors)
        </span>
        <div className="flex flex-wrap gap-2">
          {PROSTATE_SECTOR_CODES_SIMPLIFIED.map(renderChip)}
        </div>
      </div>

      {/* Disclosure trigger for full 38-sector picker */}
      <button
        type="button"
        onClick={() => setShowFull((prev) => !prev)}
        aria-expanded={showFull}
        className="self-start inline-flex items-center gap-1 rounded-md border border-border bg-muted/30 px-3 py-1 text-xs font-medium text-foreground/80 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {showFull ? (
          <ChevronUp className="h-3 w-3" aria-hidden="true" />
        ) : (
          <ChevronDown className="h-3 w-3" aria-hidden="true" />
        )}
        🔍 PI-RADS v2.1 38-sector 상세 입력 보기
      </button>

      {showFull && (
        <div className="flex flex-col gap-2 border-t border-border/60 pt-3">
          <span className="text-xs font-medium text-muted-foreground">
            Full 38-sector map (Turkbey 2019)
          </span>
          <div className="flex flex-wrap gap-2">
            {PROSTATE_SECTOR_CODES_FULL.map(renderChip)}
          </div>
        </div>
      )}

      {selected.length === 0 && (
        <p className="text-xs text-muted-foreground">
          최소 1개 분획을 선택하세요. (Select at least one sector.)
        </p>
      )}
    </fieldset>
  );
}

// ---------------------------------------------------------------------------
// Public component
// ---------------------------------------------------------------------------

interface ProstateLesionCardProps {
  lesion: ProstateLesion;
  /** 0-based index; UI shows index+1 as the "#N" instance suffix. */
  index: number;
  onChange: (next: ProstateLesion) => void;
  onRemove: () => void;
  /**
   * Section-1 prior MRI date. When undefined, the per-lesion
   * `priorMRIComparison` field is hidden (E-1, O-3) and forced cleared by the
   * orchestrator-level cascade.
   */
  parentPriorMRIDate?: string;
}

export function ProstateLesionCard({
  lesion,
  index,
  onChange,
  onRemove,
  parentPriorMRIDate,
}: ProstateLesionCardProps) {
  const fieldId = (suffix: string) => `prostate-lesion-${index}-${suffix}`;

  // Auto-derive the overall PI-RADS category when override is OFF. Sync the
  // stored `overallPiradsCategory` to the derived value whenever any of the
  // four inputs change (zone / t2w / dwi / dce).
  const derived = derivePiradsCategory(
    lesion.zone,
    lesion.t2wScore,
    lesion.dwiScore,
    lesion.dceResult
  );

  React.useEffect(() => {
    if (!lesion.isPiradsOverridden && lesion.overallPiradsCategory !== derived) {
      onChange({ ...lesion, overallPiradsCategory: derived });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    lesion.isPiradsOverridden,
    lesion.zone,
    lesion.t2wScore,
    lesion.dwiScore,
    lesion.dceResult,
    derived,
  ]);

  const usesPzRubric =
    lesion.zone === "peripheral_zone_PZ" || lesion.zone === "central_zone_CZ";
  const rubricLabel = usesPzRubric ? "PZ rubric" : "TZ rubric";

  // E-5 soft warning: PI-RADS ≥ 3 lesion with biopsy unchecked.
  const showBiopsyWarning =
    !lesion.targetForBiopsy &&
    (lesion.overallPiradsCategory === "3" ||
      lesion.overallPiradsCategory === "4" ||
      lesion.overallPiradsCategory === "5");

  // Override toggle handler — flipping ON keeps the current derived value as
  // the seed; flipping OFF clears the justification field and re-anchors to
  // the canonical derived value.
  const handleOverrideToggle = () => {
    if (lesion.isPiradsOverridden) {
      onChange({
        ...lesion,
        isPiradsOverridden: false,
        overallPiradsCategory: derived,
        overallPiradsOverrideJustification: undefined,
      });
    } else {
      onChange({ ...lesion, isPiradsOverridden: true });
    }
  };

  return (
    <Card className="shadow-sm ring-1 ring-border/50">
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <CardTitle className="flex items-center gap-3 text-lg font-bold tracking-tight text-foreground">
          <span
            aria-hidden="true"
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground shadow-sm"
          >
            2
          </span>
          <span>Lesion</span>
          <span className="text-primary font-extrabold">#{index + 1}</span>
        </CardTitle>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onRemove}
          aria-label={`Remove Lesion #${index + 1}`}
        >
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent>
        <div className="grid gap-x-6 gap-y-5 md:grid-cols-2">
          {/* 1. Zone */}
          <FieldRow label="Zone · 분획" className="md:col-span-2">
            <SegmentedControl<Zone>
              name={fieldId("zone")}
              ariaLabel="Zone"
              value={lesion.zone}
              options={toLabeledOptions(ZONE_OPTIONS, ZONE_LABEL)}
              onChange={(next) => onChange({ ...lesion, zone: next })}
            />
          </FieldRow>

          {/* 2. Sector map location — multi-select with disclosure */}
          <SectorPicker
            id={fieldId("sector")}
            selected={lesion.sectorMapLocation}
            onChange={(next) =>
              onChange({ ...lesion, sectorMapLocation: next })
            }
          />

          {/* 3. Craniocaudal level */}
          <FieldRow label="Craniocaudal level · 상하 위치">
            <SegmentedControl<CraniocaudalLevel>
              name={fieldId("cranio")}
              ariaLabel="Craniocaudal level"
              value={lesion.craniocaudalLevel}
              options={toLabeledOptions(
                CRANIOCAUDAL_LEVEL_OPTIONS,
                CRANIOCAUDAL_LABEL
              )}
              onChange={(next) =>
                onChange({ ...lesion, craniocaudalLevel: next })
              }
            />
          </FieldRow>

          {/* 4. Laterality */}
          <FieldRow label="Laterality · 측면">
            <SegmentedControl<Laterality>
              name={fieldId("laterality")}
              ariaLabel="Laterality"
              value={lesion.laterality}
              options={toLabeledOptions(LATERALITY_OPTIONS, LATERALITY_LABEL)}
              onChange={(next) => onChange({ ...lesion, laterality: next })}
            />
          </FieldRow>

          {/* 5. Size — max axial (required) */}
          <NumberField
            id={fieldId("sizeMax")}
            label="Size (max axial) · 최대축 직경"
            value={lesion.sizeMaxAxialMm}
            onChange={(v) =>
              onChange({ ...lesion, sizeMaxAxialMm: v ?? 0 })
            }
            unit="mm"
            min="1"
            max="80"
            step="1"
          />

          {/* 6. Size — orthogonal axial (optional) */}
          <NumberField
            id={fieldId("sizeOrtho")}
            label="Size (orthogonal axial) · 직교축 직경"
            value={lesion.sizeOrthogonalAxialMm}
            onChange={(v) =>
              onChange({ ...lesion, sizeOrthogonalAxialMm: v })
            }
            unit="mm"
            optional
            min="1"
            max="80"
            step="1"
          />

          {/* 7. Size — craniocaudal (optional) */}
          <NumberField
            id={fieldId("sizeCC")}
            label="Size (craniocaudal) · 상하 직경"
            value={lesion.sizeCraniocaudalMm}
            onChange={(v) => onChange({ ...lesion, sizeCraniocaudalMm: v })}
            unit="mm"
            optional
            min="1"
            max="80"
            step="1"
          />

          {/* 8. T2W score — zone-adapted rubric hint */}
          <FieldRow label={`T2W score (${rubricLabel})`}>
            <SegmentedControl<PiradsScore>
              name={fieldId("t2w")}
              ariaLabel="T2W score"
              value={lesion.t2wScore}
              options={toSegmentedOptions(PIRADS_SCORE_OPTIONS)}
              onChange={(next) => onChange({ ...lesion, t2wScore: next })}
            />
          </FieldRow>

          {/* 9. DWI score */}
          <FieldRow label={`DWI score (${rubricLabel})`}>
            <SegmentedControl<PiradsScore>
              name={fieldId("dwi")}
              ariaLabel="DWI score"
              value={lesion.dwiScore}
              options={toSegmentedOptions(PIRADS_SCORE_OPTIONS)}
              onChange={(next) => onChange({ ...lesion, dwiScore: next })}
            />
          </FieldRow>

          {/* 10. DCE result + bpMRI suppression note */}
          <FieldRow label="DCE result · 동적조영" className="md:col-span-2">
            <SegmentedControl<DceResult>
              name={fieldId("dce")}
              ariaLabel="DCE result"
              value={lesion.dceResult}
              options={toLabeledOptions(DCE_RESULT_OPTIONS, DCE_LABEL)}
              onChange={(next) => onChange({ ...lesion, dceResult: next })}
            />
            <p className="text-xs text-muted-foreground">
              DCE 미수행 시 PZ score 3→4 upgrade rule 미적용.
              <span className="sr-only">
                {" "}
                When DCE is not performed (bpMRI), the PZ DCE 3→4 upgrade rule
                is suppressed.
              </span>
            </p>
          </FieldRow>

          {/* 11. Overall PI-RADS — auto-derived (locked) with override toggle.
              Spans both columns so the override row + justification text fit
              comfortably on desktop. */}
          <fieldset className="md:col-span-2 rounded-lg border border-border p-3 flex flex-col gap-3">
            <legend
              id={`${fieldId("pirads")}-legend`}
              className="px-1 text-[0.9375rem] font-bold tracking-tight text-foreground"
            >
              Overall PI-RADS category · 전체 PI-RADS 분류
            </legend>

            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm font-semibold text-foreground">
                Auto-derived: {derived}
              </span>
              <Button
                type="button"
                variant={lesion.isPiradsOverridden ? "default" : "outline"}
                size="sm"
                onClick={handleOverrideToggle}
                aria-pressed={lesion.isPiradsOverridden}
              >
                {lesion.isPiradsOverridden
                  ? "자동값으로 되돌리기"
                  : "수동 override"}
              </Button>
            </div>

            {lesion.isPiradsOverridden && (
              <div className="flex flex-col gap-2 border-t border-border/60 pt-3">
                <SegmentedControl<PiradsScore>
                  name={fieldId("piradsOverride")}
                  ariaLabel="Manual PI-RADS override"
                  value={lesion.overallPiradsCategory}
                  options={toSegmentedOptions(PIRADS_SCORE_OPTIONS)}
                  onChange={(next) =>
                    onChange({ ...lesion, overallPiradsCategory: next })
                  }
                />

                <label
                  htmlFor={fieldId("overrideJust")}
                  className="text-[0.9375rem] font-bold tracking-tight text-foreground"
                >
                  Override justification · 수정 사유
                  <span className="ml-1 text-xs font-normal text-muted-foreground">
                    (required when override active)
                  </span>
                </label>
                <textarea
                  id={fieldId("overrideJust")}
                  rows={2}
                  maxLength={500}
                  value={lesion.overallPiradsOverrideJustification ?? ""}
                  onChange={(e) =>
                    onChange({
                      ...lesion,
                      overallPiradsOverrideJustification:
                        e.target.value || undefined,
                    })
                  }
                  placeholder="예) MR-pathology mismatch — biopsy showed ISUP3 despite PI-RADS 2"
                  className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y"
                />
              </div>
            )}
          </fieldset>

          {/* 12. ADC mean value (optional) */}
          <NumberField
            id={fieldId("adc")}
            label="ADC mean value · ADC 평균값"
            value={lesion.adcMeanValue}
            onChange={(v) => onChange({ ...lesion, adcMeanValue: v })}
            unit="×10⁻⁶ mm²/s"
            optional
            min="0"
            step="1"
          />

          {/* 13. Biopsy target — checkbox */}
          <fieldset className="rounded-lg border border-border p-3 flex flex-col gap-2">
            <legend
              id={`${fieldId("biopsy")}-legend`}
              className="px-1 text-[0.9375rem] font-bold tracking-tight text-foreground"
            >
              Target for biopsy · 생검 대상
            </legend>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                id={fieldId("biopsy")}
                type="checkbox"
                checked={lesion.targetForBiopsy}
                onChange={(e) =>
                  onChange({ ...lesion, targetForBiopsy: e.target.checked })
                }
                className="h-4 w-4 text-primary"
                aria-labelledby={`${fieldId("biopsy")}-legend`}
              />
              <span className="text-sm">
                Yes — 생검 권고 (MRI-targeted biopsy)
              </span>
            </label>
          </fieldset>

          {/* E-5: soft warning when PI-RADS ≥3 but biopsy unchecked. Spans both
              columns and lives directly under the biopsy/score block so the
              radiologist sees the warning in the same scan-row. */}
          {showBiopsyWarning && (
            <div
              role="note"
              className="md:col-span-2 flex items-start gap-2 rounded-md border border-warning/60 bg-warning/10 px-3 py-2 text-xs text-foreground"
            >
              <AlertTriangle
                className="mt-0.5 h-4 w-4 shrink-0 text-warning"
                aria-hidden="true"
              />
              <p>
                PI-RADS ≥3 병변에 biopsy 권고 미체크 — 의도적이라면 무시.
                <span className="sr-only">
                  {" "}
                  PI-RADS 3 or higher lesion without biopsy target — ignore if
                  intentional.
                </span>
              </p>
            </div>
          )}

          {/* 14. EPE risk (Mehralivand) — RadioCardGroup with semantic tones */}
          <FieldRow
            label="EPE risk (Mehralivand) · 피막외 침범 위험"
            className="md:col-span-2"
          >
            <RadioCardGroup<EpeRisk>
              name={fieldId("epe")}
              ariaLabel="EPE risk (Mehralivand)"
              value={lesion.epeRiskMehralivand}
              options={EPE_RISK_RADIO_OPTIONS}
              onChange={(next) =>
                onChange({ ...lesion, epeRiskMehralivand: next })
              }
              columns={2}
            />
          </FieldRow>

          {/* 15. Seminal vesicle invasion suspicion */}
          <FieldRow label="Seminal vesicle invasion · 정낭 침범 의심">
            <SegmentedControl<SviSuspicion>
              name={fieldId("svi")}
              ariaLabel="Seminal vesicle invasion suspicion"
              value={lesion.seminalVesicleInvasionSuspicion}
              options={toLabeledOptions(
                SVI_SUSPICION_OPTIONS,
                SVI_SUSPICION_LABEL
              )}
              onChange={(next) =>
                onChange({ ...lesion, seminalVesicleInvasionSuspicion: next })
              }
            />
          </FieldRow>

          {/* 16. Neurovascular bundle involvement (optional) */}
          <FieldRow label="Neurovascular bundle · 신경혈관다발" optional>
            <SegmentedControl<NvbInvolvement>
              name={fieldId("nvb")}
              ariaLabel="Neurovascular bundle involvement"
              value={lesion.neurovascularBundleInvolvement}
              options={toLabeledOptions(
                NVB_INVOLVEMENT_OPTIONS,
                NVB_LABEL
              )}
              onChange={(next) =>
                onChange({ ...lesion, neurovascularBundleInvolvement: next })
              }
            />
          </FieldRow>

          {/* 17. Relation to apex (optional) */}
          <FieldRow
            label="Relation to apex · 첨부와의 관계"
            optional
            className="md:col-span-2"
          >
            <SegmentedControl<RelationToApex>
              name={fieldId("apex")}
              ariaLabel="Relation to apex"
              value={lesion.relationToApex}
              options={toLabeledOptions(
                RELATION_TO_APEX_OPTIONS,
                RELATION_APEX_LABEL
              )}
              onChange={(next) =>
                onChange({ ...lesion, relationToApex: next })
              }
            />
          </FieldRow>

          {/* 18. Relation to urethra (optional) */}
          <FieldRow label="Relation to urethra · 요도와의 관계" optional>
            <SegmentedControl<RelationToUrethra>
              name={fieldId("urethra")}
              ariaLabel="Relation to urethra"
              value={lesion.relationToUrethra}
              options={toLabeledOptions(
                RELATION_TO_URETHRA_OPTIONS,
                RELATION_URETHRA_LABEL
              )}
              onChange={(next) =>
                onChange({ ...lesion, relationToUrethra: next })
              }
            />
          </FieldRow>

          {/* 19. Prior MRI comparison — conditional on parentPriorMRIDate (E-1) */}
          {parentPriorMRIDate && (
            <FieldRow
              label="Prior MRI comparison · 이전 MRI 비교"
              className="md:col-span-2"
            >
              <SegmentedControl<PriorMriComparison>
                name={fieldId("priorMRI")}
                ariaLabel="Prior MRI comparison"
                value={lesion.priorMRIComparison}
                options={toLabeledOptions(
                  PRIOR_MRI_COMPARISON_OPTIONS,
                  PRIOR_MRI_LABEL
                )}
                onChange={(next) =>
                  onChange({ ...lesion, priorMRIComparison: next })
                }
              />
            </FieldRow>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
