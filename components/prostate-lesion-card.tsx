"use client";

import * as React from "react";
import { AlertTriangle, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DCE_RESULT_OPTIONS,
  EPE_RISK_OPTIONS,
  NVB_INVOLVEMENT_OPTIONS,
  PIRADS_SCORE_OPTIONS,
  PRIOR_MRI_COMPARISON_OPTIONS,
  PROSTATE_SECTOR_CODES_SIMPLIFIED,
  ZONE_OPTIONS,
  type DceResult,
  type EpeRisk,
  type NvbInvolvement,
  type PiradsScore,
  type PriorMriComparison,
  type Zone,
} from "@/lib/prompts/disease-templates/prostate-fields";
import {
  deriveCraniocaudalLevelFromSectors,
  deriveLateralityFromSectors,
  derivePiradsCategory,
  type ProstateLesion,
} from "@/lib/prompts/disease-templates/prostate-serializer";
import { Button } from "@/components/ui/button";
import {
  SegmentedControl,
  toSegmentedOptions,
  type SegmentedControlOption,
} from "@/components/ui/segmented-control";
import {
  ChipToggle,
  Disclosure,
  InlineField,
  NumberInput,
  Row,
  compactTextareaClass,
} from "@/components/compact-form";

// ---------------------------------------------------------------------------
// Option labels — short Korean labels so each group fits one row
// ---------------------------------------------------------------------------

const ZONE_LABEL: Record<Zone, string> = {
  peripheral_zone_PZ: "PZ",
  transition_zone_TZ: "TZ",
  central_zone_CZ: "CZ",
  anterior_fibromuscular_stroma_AFMS: "AFMS",
};

const DCE_LABEL: Record<DceResult, string> = {
  negative: "음성",
  positive: "양성",
  not_performed_bpMRI: "미시행 (bpMRI)",
};

const NVB_LABEL: Record<NvbInvolvement, string> = {
  none: "없음",
  abutment: "인접",
  encasement: "침범",
};

const PRIOR_MRI_LABEL: Record<PriorMriComparison, string> = {
  new_lesion: "신생",
  unchanged: "변화 없음",
  decreased: "감소",
  increased_size_only: "크기만 증가",
  increased_score: "점수 증가",
  not_visible_on_prior: "이전에 없음",
};

const EPE_RISK_LABEL: Record<EpeRisk, string> = {
  "0_no_features": "0 없음",
  "1_curvilinear_or_bulge": "1 접촉·융기",
  "2_both_features": "2 둘 다",
  "3_frank_breach": "3 피막 돌파",
};

function toLabeledOptions<T extends string>(
  values: ReadonlyArray<T>,
  labels: Record<T, string>
): SegmentedControlOption<T>[] {
  return values.map((v) => ({ value: v, label: labels[v] }));
}

/** Badge colour by overall PI-RADS category. */
const PIRADS_TONE: Record<PiradsScore, string> = {
  "1": "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
  "2": "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
  "3": "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
  "4": "bg-orange-100 text-orange-800 dark:bg-orange-950/50 dark:text-orange-300",
  "5": "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300",
};

// ---------------------------------------------------------------------------
// Sector picker — 6 simplified chips, plus the 38-sector map laid out as a
// level × region grid per side so a code is found by position, not by
// reading a flat list of 38 tokens.
// ---------------------------------------------------------------------------

const SECTOR_LEVELS = [
  { key: "base", label: "Base" },
  { key: "mid", label: "Mid" },
  { key: "apex", label: "Apex" },
] as const;
const SECTOR_REGIONS = ["PZpl", "PZpm", "PZa", "TZa", "TZp", "CZ"] as const;
const SECTOR_MIDLINE = [
  "AFMS-apex",
  "AFMS-mid",
  "AFMS-base",
  "SV-R",
  "SV-L",
  "Membranous-urethra",
] as const;
const SIMPLIFIED_SET = new Set<string>(PROSTATE_SECTOR_CODES_SIMPLIFIED);

interface SectorPickerProps {
  id: string;
  selected: string[];
  onChange: (next: string[]) => void;
}

function SectorPicker({ id, selected, onChange }: SectorPickerProps) {
  const detailed = selected.filter((code) => !SIMPLIFIED_SET.has(code));
  const [showFull, setShowFull] = React.useState(detailed.length > 0);

  const toggle = (code: string) => {
    onChange(
      selected.includes(code)
        ? selected.filter((c) => c !== code)
        : [...selected, code]
    );
  };

  const cellChip = (code: string, text: string) => {
    const active = selected.includes(code);
    return (
      <button
        key={code}
        type="button"
        role="checkbox"
        aria-checked={active}
        aria-label={code}
        title={code}
        onClick={() => toggle(code)}
        className={cn(
          "h-6 w-full rounded border text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          active
            ? "border-primary bg-primary text-primary-foreground"
            : "border-border bg-background text-foreground/70 hover:bg-muted/60"
        )}
      >
        {text}
      </button>
    );
  };

  const sideGrid = (side: "R" | "L") => (
    <div
      role="group"
      aria-label={side === "R" ? "우측 분획" : "좌측 분획"}
      className="grid grid-cols-[2.5rem_repeat(6,2.6rem)] gap-1"
    >
      <span className="text-[11px] font-semibold text-foreground/70">
        {side === "R" ? "우 R" : "좌 L"}
      </span>
      {SECTOR_REGIONS.map((r) => (
        <span
          key={r}
          aria-hidden="true"
          className="text-center text-[10px] text-muted-foreground"
        >
          {r}
        </span>
      ))}
      {SECTOR_LEVELS.map((lvl) => (
        <React.Fragment key={lvl.key}>
          <span className="self-center text-[11px] text-muted-foreground">
            {lvl.label}
          </span>
          {SECTOR_REGIONS.map((r) =>
            // CZ exists at the base only.
            r === "CZ" && lvl.key !== "base" ? (
              <span key={r} aria-hidden="true" />
            ) : (
              cellChip(`${side}-${lvl.key}-${r}`, r)
            )
          )}
        </React.Fragment>
      ))}
    </div>
  );

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <div
        role="group"
        aria-label="분획 위치 (Sector map location)"
        className="flex flex-wrap items-center gap-1.5"
      >
        {PROSTATE_SECTOR_CODES_SIMPLIFIED.map((code) => (
          <ChipToggle
            key={code}
            active={selected.includes(code)}
            onClick={() => toggle(code)}
          >
            {code}
          </ChipToggle>
        ))}
        <button
          type="button"
          aria-expanded={showFull}
          aria-controls={`${id}-full`}
          onClick={() => setShowFull((v) => !v)}
          className="h-7 rounded-md px-1.5 text-xs text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {showFull ? "38분획 닫기" : "38분획 상세"}
        </button>
        {!showFull && detailed.length > 0 && (
          <span className="text-xs text-muted-foreground">
            {detailed.join(", ")}
          </span>
        )}
      </div>
      {showFull && (
        <div id={`${id}-full`} className="flex flex-col gap-2 pt-1">
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {sideGrid("R")}
            {sideGrid("L")}
          </div>
          <div
            role="group"
            aria-label="정중부 분획"
            className="flex flex-wrap gap-1"
          >
            {SECTOR_MIDLINE.map((code) => (
              <ChipToggle
                key={code}
                active={selected.includes(code)}
                onClick={() => toggle(code)}
              >
                {code}
              </ChipToggle>
            ))}
          </div>
        </div>
      )}
    </div>
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
  const lesionName = `병변 #${index + 1}`;
  const [open, setOpen] = React.useState(true);

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

  const sectors = lesion.sectorMapLocation;
  const headerSummary = [
    ZONE_LABEL[lesion.zone],
    sectors.length > 0
      ? sectors.length > 3
        ? `${sectors.slice(0, 3).join(", ")} 외 ${sectors.length - 3}`
        : sectors.join(", ")
      : "위치 미입력",
    lesion.sizeMaxAxialMm > 0 ? `${lesion.sizeMaxAxialMm} mm` : "크기 미입력",
  ].join(" · ");

  const extraSummary =
    [
      lesion.adcMeanValue !== undefined && `ADC ${lesion.adcMeanValue}`,
      parentPriorMRIDate &&
        lesion.priorMRIComparison &&
        `이전 MRI: ${PRIOR_MRI_LABEL[lesion.priorMRIComparison]}`,
    ]
      .filter(Boolean)
      .join(" · ") ||
    (parentPriorMRIDate ? "ADC · 이전 MRI 비교" : "ADC");

  return (
    <div className="rounded-md border border-border bg-background">
      <div className="flex items-center gap-1 px-2 py-1">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={fieldId("body")}
          onClick={() => setOpen((v) => !v)}
          className="flex min-w-0 flex-1 items-center gap-2 rounded px-1 py-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronRight
            aria-hidden="true"
            className={cn(
              "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform",
              open && "rotate-90"
            )}
          />
          <span className="shrink-0 text-[13px] font-semibold text-foreground">
            {lesionName}
          </span>
          <span className="min-w-0 truncate text-xs text-muted-foreground">
            {headerSummary}
          </span>
          <span
            className={cn(
              "ml-auto shrink-0 rounded px-1.5 py-0.5 text-[11px] font-semibold",
              PIRADS_TONE[lesion.overallPiradsCategory]
            )}
          >
            PI-RADS {lesion.overallPiradsCategory}
          </span>
        </button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={onRemove}
          aria-label={`Remove Lesion #${index + 1}`}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      {open && (
        <div id={fieldId("body")} className="@container border-t border-border/60 px-3 pt-1 pb-2">
          <Row label="구역">
            <SegmentedControl<Zone>
              name={fieldId("zone")}
              ariaLabel={`${lesionName} 구역 (Zone)`}
              size="xs"
              value={lesion.zone}
              options={toLabeledOptions(ZONE_OPTIONS, ZONE_LABEL)}
              onChange={(next) => onChange({ ...lesion, zone: next })}
            />
          </Row>

          {/* Sector codes encode laterality + craniocaudal level + zone in a
              single PI-RADS v2.1 token (e.g. "R-mid-PZpl"). The lesion's
              `laterality` and `craniocaudalLevel` fields are auto-derived
              from this list to keep the form aligned with the published
              sector map and to avoid contradictory dual entry. */}
          <Row label="위치" required align="start">
            <SectorPicker
              id={fieldId("sector")}
              selected={sectors}
              onChange={(next) => {
                const derivedLat = deriveLateralityFromSectors(next);
                const derivedLvl = deriveCraniocaudalLevelFromSectors(next);
                onChange({
                  ...lesion,
                  sectorMapLocation: next,
                  laterality: derivedLat ?? lesion.laterality,
                  craniocaudalLevel: derivedLvl ?? lesion.craniocaudalLevel,
                });
              }}
            />
          </Row>

          <Row label="크기">
            <InlineField label="최대" htmlFor={fieldId("sizeMax")}>
              <NumberInput
                id={fieldId("sizeMax")}
                value={lesion.sizeMaxAxialMm}
                onChange={(v) => onChange({ ...lesion, sizeMaxAxialMm: v ?? 0 })}
                unit="mm"
                min="1"
                max="80"
                widthClass="w-16"
                emptyWhenZero
              />
            </InlineField>
            <InlineField label="직교" htmlFor={fieldId("sizeOrtho")}>
              <NumberInput
                id={fieldId("sizeOrtho")}
                value={lesion.sizeOrthogonalAxialMm}
                onChange={(v) =>
                  onChange({ ...lesion, sizeOrthogonalAxialMm: v })
                }
                unit="mm"
                min="1"
                max="80"
                widthClass="w-16"
              />
            </InlineField>
            <InlineField label="상하" htmlFor={fieldId("sizeCC")}>
              <NumberInput
                id={fieldId("sizeCC")}
                value={lesion.sizeCraniocaudalMm}
                onChange={(v) => onChange({ ...lesion, sizeCraniocaudalMm: v })}
                unit="mm"
                min="1"
                max="80"
                widthClass="w-16"
              />
            </InlineField>
          </Row>

          <Row
            label={
              <>
                점수{" "}
                <span className="text-[11px] font-normal text-muted-foreground">
                  {usesPzRubric ? "PZ 기준" : "TZ 기준"}
                </span>
              </>
            }
            required
          >
            <InlineField label="T2W">
              <SegmentedControl<PiradsScore>
                name={fieldId("t2w")}
                ariaLabel={`${lesionName} T2W score`}
                size="xs"
                value={lesion.t2wScore}
                options={toSegmentedOptions(PIRADS_SCORE_OPTIONS)}
                onChange={(next) => onChange({ ...lesion, t2wScore: next })}
              />
            </InlineField>
            <InlineField label="DWI">
              <SegmentedControl<PiradsScore>
                name={fieldId("dwi")}
                ariaLabel={`${lesionName} DWI score`}
                size="xs"
                value={lesion.dwiScore}
                options={toSegmentedOptions(PIRADS_SCORE_OPTIONS)}
                onChange={(next) => onChange({ ...lesion, dwiScore: next })}
              />
            </InlineField>
          </Row>

          {/* DCE not performed (bpMRI) suppresses the PZ 3→4 upgrade. */}
          <Row label="DCE">
            <SegmentedControl<DceResult>
              name={fieldId("dce")}
              ariaLabel={`${lesionName} DCE result`}
              size="xs"
              value={lesion.dceResult}
              options={toLabeledOptions(DCE_RESULT_OPTIONS, DCE_LABEL)}
              onChange={(next) => onChange({ ...lesion, dceResult: next })}
            />
          </Row>

          <Row label="PI-RADS">
            <span className="text-[13px] text-foreground">
              자동 <span className="font-semibold">{derived}</span>
              {lesion.isPiradsOverridden && (
                <span className="ml-2 text-muted-foreground">
                  → 수동 {lesion.overallPiradsCategory}
                </span>
              )}
            </span>
            <button
              type="button"
              onClick={handleOverrideToggle}
              aria-pressed={lesion.isPiradsOverridden}
              className="text-xs text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {lesion.isPiradsOverridden ? "자동값으로 되돌리기" : "수동 수정"}
            </button>
          </Row>

          {lesion.isPiradsOverridden && (
            <Row label="수동 PI-RADS" align="start">
              <div className="flex w-full flex-col gap-1.5">
                <SegmentedControl<PiradsScore>
                  name={fieldId("piradsOverride")}
                  ariaLabel="Manual PI-RADS override"
                  size="xs"
                  className="self-start"
                  value={lesion.overallPiradsCategory}
                  options={toSegmentedOptions(PIRADS_SCORE_OPTIONS)}
                  onChange={(next) =>
                    onChange({ ...lesion, overallPiradsCategory: next })
                  }
                />
                <textarea
                  id={fieldId("overrideJust")}
                  aria-label="Override justification · 수정 사유"
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
                  placeholder="수정 사유 — 예) MR-pathology mismatch, biopsy ISUP 3 despite PI-RADS 2"
                  className={compactTextareaClass}
                />
              </div>
            </Row>
          )}

          <Row label="EPE 위험">
            <SegmentedControl<EpeRisk>
              name={fieldId("epe")}
              ariaLabel={`${lesionName} EPE risk (Mehralivand)`}
              size="xs"
              value={lesion.epeRiskMehralivand}
              options={toLabeledOptions(EPE_RISK_OPTIONS, EPE_RISK_LABEL)}
              onChange={(next) =>
                onChange({ ...lesion, epeRiskMehralivand: next })
              }
            />
          </Row>

          <Row label="신경혈관다발">
            <SegmentedControl<NvbInvolvement>
              name={fieldId("nvb")}
              ariaLabel={`${lesionName} neurovascular bundle involvement`}
              size="xs"
              value={lesion.neurovascularBundleInvolvement}
              options={toLabeledOptions(NVB_INVOLVEMENT_OPTIONS, NVB_LABEL)}
              onChange={(next) =>
                onChange({ ...lesion, neurovascularBundleInvolvement: next })
              }
            />
          </Row>

          <Row label="생검 대상" htmlFor={fieldId("biopsy")}>
            <label className="inline-flex cursor-pointer items-center gap-2 text-[13px]">
              <input
                id={fieldId("biopsy")}
                type="checkbox"
                checked={lesion.targetForBiopsy}
                onChange={(e) =>
                  onChange({ ...lesion, targetForBiopsy: e.target.checked })
                }
                className="h-4 w-4 accent-[var(--color-primary)]"
              />
              MRI 표적 생검 권고
            </label>
            {showBiopsyWarning && (
              <span
                role="note"
                className="inline-flex items-center gap-1 text-xs text-amber-700 dark:text-amber-300"
              >
                <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                PI-RADS ≥ 3인데 생검 대상이 아님
              </span>
            )}
          </Row>

          <Disclosure
            id={fieldId("extra")}
            label="추가 정보"
            summary={extraSummary}
            forceOpen={
              lesion.adcMeanValue !== undefined ||
              Boolean(parentPriorMRIDate && lesion.priorMRIComparison)
            }
          >
            <Row label="ADC 평균" htmlFor={fieldId("adc")}>
              <NumberInput
                id={fieldId("adc")}
                value={lesion.adcMeanValue}
                onChange={(v) => onChange({ ...lesion, adcMeanValue: v })}
                unit="×10⁻⁶ mm²/s"
                min="0"
                widthClass="w-20"
              />
            </Row>
            {parentPriorMRIDate && (
              <Row label="이전 MRI 비교">
                <SegmentedControl<PriorMriComparison>
                  name={fieldId("priorMRI")}
                  ariaLabel={`${lesionName} prior MRI comparison`}
                  size="xs"
                  value={lesion.priorMRIComparison}
                  options={toLabeledOptions(
                    PRIOR_MRI_COMPARISON_OPTIONS,
                    PRIOR_MRI_LABEL
                  )}
                  onChange={(next) =>
                    onChange({ ...lesion, priorMRIComparison: next })
                  }
                />
              </Row>
            )}
          </Disclosure>
        </div>
      )}
    </div>
  );
}
