"use client";

import * as React from "react";
import { Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  BONE_INVOLVEMENT_OPTIONS,
  CLINICAL_M_OPTIONS,
  CLINICAL_N_OPTIONS,
  CLINICAL_T_OPTIONS,
  LOCAL_INVOLVEMENT_OPTIONS,
  OTHER_DISTANT_METS_OPTIONS,
  PIQUAL_DCE_SUBSCORE_OPTIONS,
  PIQUAL_OVERALL_OPTIONS,
  PIQUAL_T2W_DWI_SUBSCORE_OPTIONS,
  SVI_WHOLE_GLAND_OPTIONS,
  type BoneInvolvement,
  type ClinicalM,
  type ClinicalN,
  type ClinicalT,
  type LocalInvolvement,
  type OtherDistantMets,
  type PiQualDceSubscore,
  type PiQualOverall,
  type PiQualT2WDwiSubscore,
  type SviWholeGland,
} from "@/lib/prompts/disease-templates/prostate-fields";
import {
  deriveClinicalM,
  deriveClinicalN,
  deriveClinicalT,
  deriveEauRiskGroup,
  deriveProstateVolume,
  derivePsaDensity,
  type ProstateLymphNode,
  type ProstateStructuredInput,
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
// File-local helpers (mirror rcc-study-level-card.tsx for visual rhythm parity)
// ---------------------------------------------------------------------------

function FieldRow({
  label,
  optional,
  required,
  children,
  className,
}: {
  label: string;
  optional?: boolean;
  /** Marks the field as required for the Generate-report gate. */
  required?: boolean;
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
        {required && (
          <>
            <span
              aria-hidden="true"
              className="ml-1 font-bold text-destructive"
            >
              *
            </span>
            <span className="sr-only"> (required)</span>
          </>
        )}
        {!required && optional && (
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
  required = false,
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
  required?: boolean;
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
        {required && (
          <>
            <span
              aria-hidden="true"
              className="ml-1 font-bold text-destructive"
            >
              *
            </span>
            <span className="sr-only"> (required)</span>
          </>
        )}
        {!required && optional && (
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

const SVI_WHOLE_GLAND_LABEL: Record<SviWholeGland, string> = {
  none: "None · 없음",
  right: "Right · 우측",
  left: "Left · 좌측",
  bilateral: "Bilateral · 양측",
};

const LOCAL_INVOLVEMENT_LABEL: Record<LocalInvolvement, string> = {
  none: "None · 없음",
  abutment: "Abutment · 인접",
  invasion: "Invasion · 침범",
};

const BONE_INVOLVEMENT_LABEL: Record<BoneInvolvement, string> = {
  none: "None · 없음",
  equivocal: "Equivocal · 모호",
  definite: "Definite · 확실",
};

const OTHER_DISTANT_METS_LABEL: Record<OtherDistantMets, string> = {
  none: "None · 없음",
  lung: "Lung · 폐",
  liver: "Liver · 간",
  other: "Other · 기타",
};

const PIQUAL_OVERALL_LABEL: Record<PiQualOverall, string> = {
  "1_inadequate": "1 · Inadequate",
  "2_acceptable": "2 · Acceptable",
  "3_optimal": "3 · Optimal",
};

const PIQUAL_OVERALL_SUBLABEL: Record<PiQualOverall, string> = {
  "1_inadequate": "부적합",
  "2_acceptable": "양호",
  "3_optimal": "우수",
};

const PIQUAL_OVERALL_TONE: Record<PiQualOverall, SemanticTone> = {
  "1_inadequate": "destructive",
  "2_acceptable": "warning",
  "3_optimal": "success",
};

const PIQUAL_DCE_LABEL: Record<PiQualDceSubscore, string> = {
  "+": "+ (Adequate)",
  "-": "- (Inadequate)",
  not_applicable: "N/A · 미수행",
};

const PIQUAL_OVERALL_RADIO_OPTIONS: ReadonlyArray<
  RadioCardOption<PiQualOverall>
> = PIQUAL_OVERALL_OPTIONS.map((v) => ({
  value: v,
  label: PIQUAL_OVERALL_LABEL[v],
  sublabel: PIQUAL_OVERALL_SUBLABEL[v],
  tone: PIQUAL_OVERALL_TONE[v],
}));

function toLabeledOptions<T extends string>(
  values: ReadonlyArray<T>,
  labels: Record<T, string>
): SegmentedControlOption<T>[] {
  return values.map((v) => ({ value: v, label: labels[v] }));
}

// ---------------------------------------------------------------------------
// Bone lesion location chips (S-2)
// ---------------------------------------------------------------------------

const BONE_LESION_LOCATIONS = [
  { value: "pelvis", label: "Pelvis · 골반" },
  { value: "lumbar_spine", label: "Lumbar spine · 요추" },
  { value: "sacrum", label: "Sacrum · 천골" },
  { value: "femur_R", label: "Femur (R) · 우측 대퇴" },
  { value: "femur_L", label: "Femur (L) · 좌측 대퇴" },
  { value: "other", label: "Other · 기타" },
] as const;

function BoneLesionLocationsPicker({
  id,
  selected,
  onChange,
}: {
  id: string;
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const toggle = (code: string) => {
    if (selected.includes(code)) {
      onChange(selected.filter((c) => c !== code));
    } else {
      onChange([...selected, code]);
    }
  };

  return (
    <fieldset
      aria-labelledby={`${id}-legend`}
      className="md:col-span-2 rounded-lg border border-border p-3 flex flex-col gap-2"
    >
      <legend
        id={`${id}-legend`}
        className="px-1 text-[0.9375rem] font-bold tracking-tight text-foreground"
      >
        Bone lesion locations · 골 병변 위치
        <span className="ml-1 text-xs font-normal text-muted-foreground">
          (≥1 required)
        </span>
      </legend>
      <div className="flex flex-wrap gap-2">
        {BONE_LESION_LOCATIONS.map((opt) => {
          const active = selected.includes(opt.value);
          return (
            <button
              key={opt.value}
              type="button"
              role="checkbox"
              aria-checked={active}
              onClick={() => toggle(opt.value)}
              className={cn(
                "rounded-md border px-3 py-1 text-xs font-medium transition-colors",
                active
                  ? "bg-primary/15 ring-2 ring-primary/40 border-primary text-foreground"
                  : "border-border bg-background text-foreground/80 hover:bg-muted/50"
              )}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

// ---------------------------------------------------------------------------
// Lymph-node sub-card (regional + non-regional share the same shape; the
// `kind` prop swaps the station/location label appropriately).
// ---------------------------------------------------------------------------

interface LymphNodeSubCardProps {
  idPrefix: string;
  kind: "regional" | "non_regional";
  nodes: ProstateLymphNode[];
  onChange: (next: ProstateLymphNode[]) => void;
}

function LymphNodeSubCard({
  idPrefix,
  kind,
  nodes,
  onChange,
}: LymphNodeSubCardProps) {
  const isRegional = kind === "regional";
  const heading = isRegional
    ? "Regional lymph nodes · 국소 림프절"
    : "Non-regional lymph nodes · 비국소 림프절";
  const stationFieldLabel = isRegional
    ? "Station · 위치 (e.g. obturator, internal_iliac)"
    : "Location · 위치 (e.g. retroperitoneal)";

  const handleAdd = () => {
    onChange([...nodes, { shortAxisMm: 0 }]);
  };

  const handleRemove = (idx: number) => {
    onChange(nodes.filter((_, i) => i !== idx));
  };

  const handleNodeChange = (idx: number, next: ProstateLymphNode) => {
    onChange(nodes.map((n, i) => (i === idx ? next : n)));
  };

  return (
    <fieldset
      aria-labelledby={`${idPrefix}-legend`}
      className="md:col-span-2 rounded-lg border border-border p-3 flex flex-col gap-3"
    >
      <legend
        id={`${idPrefix}-legend`}
        className="px-1 text-[0.9375rem] font-bold tracking-tight text-foreground"
      >
        {heading}
      </legend>

      {nodes.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          림프절이 평가되지 않았습니다. 추가하려면 아래 버튼을 누르세요.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {nodes.map((node, idx) => {
            const fieldId = (suffix: string) =>
              `${idPrefix}-${idx}-${suffix}`;
            const stationValue = isRegional
              ? (node.station ?? "")
              : (node.location ?? "");
            return (
              <div
                key={idx}
                className="rounded-md border border-border/60 bg-muted/20 p-3 flex flex-col gap-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-foreground">
                    Node{" "}
                    <span className="text-primary font-extrabold">
                      #{idx + 1}
                    </span>
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemove(idx)}
                    aria-label={`Remove ${
                      isRegional ? "regional" : "non-regional"
                    } node #${idx + 1}`}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                <div className="grid gap-x-6 gap-y-3 md:grid-cols-2">
                  {/* Station / Location free-text */}
                  <div className="rounded-md border border-border bg-background p-2 flex flex-col gap-1">
                    <label
                      htmlFor={fieldId("station")}
                      className="text-xs font-bold tracking-tight text-foreground"
                    >
                      {stationFieldLabel}
                    </label>
                    <input
                      id={fieldId("station")}
                      type="text"
                      maxLength={80}
                      value={stationValue}
                      onChange={(e) => {
                        const v = e.target.value || undefined;
                        if (isRegional) {
                          handleNodeChange(idx, { ...node, station: v });
                        } else {
                          handleNodeChange(idx, { ...node, location: v });
                        }
                      }}
                      className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </div>

                  {/* Short-axis size (mm) */}
                  <div className="rounded-md border border-border bg-background p-2 flex flex-col gap-1">
                    <label
                      htmlFor={fieldId("shortAxis")}
                      className="text-xs font-bold tracking-tight text-foreground"
                    >
                      Short axis · 단축 (mm)
                    </label>
                    <input
                      id={fieldId("shortAxis")}
                      type="number"
                      step="1"
                      min="0"
                      max="100"
                      value={node.shortAxisMm}
                      onChange={(e) => {
                        const v =
                          e.target.value === ""
                            ? 0
                            : parseFloat(e.target.value);
                        handleNodeChange(idx, { ...node, shortAxisMm: v });
                      }}
                      className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </div>

                  {/* Morphology */}
                  <div className="rounded-md border border-border bg-background p-2 flex flex-col gap-1 md:col-span-2">
                    <span className="text-xs font-bold tracking-tight text-foreground">
                      Morphology · 형태 (optional)
                    </span>
                    <SegmentedControl<"round" | "oval" | "lobulated">
                      name={fieldId("morphology")}
                      ariaLabel="Morphology"
                      value={node.morphology}
                      options={[
                        { value: "round", label: "Round · 원형" },
                        { value: "oval", label: "Oval · 타원형" },
                        { value: "lobulated", label: "Lobulated · 분엽" },
                      ]}
                      onChange={(next) =>
                        handleNodeChange(idx, { ...node, morphology: next })
                      }
                    />
                  </div>

                  {/* Suspicious features — comma-separated free-text */}
                  <div className="rounded-md border border-border bg-background p-2 flex flex-col gap-1 md:col-span-2">
                    <label
                      htmlFor={fieldId("features")}
                      className="text-xs font-bold tracking-tight text-foreground"
                    >
                      Suspicious features · 의심 소견
                      <span className="ml-1 text-xs font-normal text-muted-foreground">
                        (comma-separated, optional)
                      </span>
                    </label>
                    <input
                      id={fieldId("features")}
                      type="text"
                      maxLength={200}
                      value={(node.suspiciousFeatures ?? []).join(", ")}
                      onChange={(e) => {
                        const raw = e.target.value;
                        const parts = raw
                          .split(",")
                          .map((s) => s.trim())
                          .filter((s) => s.length > 0);
                        handleNodeChange(idx, {
                          ...node,
                          suspiciousFeatures: parts.length > 0 ? parts : undefined,
                        });
                      }}
                      placeholder="예) necrosis, irregular_border"
                      className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAdd}
          className="w-full sm:w-auto"
        >
          <Plus className="mr-2 h-4 w-4" />
          {isRegional
            ? "Add regional lymph node"
            : "Add non-regional lymph node"}
        </Button>
      </div>
    </fieldset>
  );
}

// ---------------------------------------------------------------------------
// Public component
// ---------------------------------------------------------------------------

interface ProstateStudyLevelCardProps {
  value: ProstateStructuredInput;
  onChange: (next: ProstateStructuredInput) => void;
}

export function ProstateStudyLevelCard({
  value,
  onChange,
}: ProstateStudyLevelCardProps) {
  const id = (suffix: string) => `prostate-study-${suffix}`;

  // Derived staging values.
  const derivedT = deriveClinicalT(value);
  const derivedN = deriveClinicalN(value);
  const derivedM = deriveClinicalM(value);
  const eauRiskGroup = deriveEauRiskGroup(value);
  const derivedVolumeMl = deriveProstateVolume(
    value.prostateWidthMm,
    value.prostateHeightMm,
    value.prostateAPMm
  );
  const psaDensity = derivePsaDensity(value.psaNgPerMl, value.prostateVolumeMl);

  /**
   * Apply a single dimension change. The new dimensions are run through
   * `deriveProstateVolume` so that `prostateVolumeMl` (the canonical field
   * consumed by PSA density and the serializer) stays in lockstep with the
   * three orthogonal measurements. When any dimension is missing, we set
   * volume back to 0 — the same sentinel `createEmptyProstateInput()` uses
   * for "not entered" — so the submission gate continues to work correctly.
   */
  const handleDimensionChange = (
    next: Pick<
      ProstateStructuredInput,
      "prostateWidthMm" | "prostateHeightMm" | "prostateAPMm"
    >
  ) => {
    const merged = { ...value, ...next };
    const computed = deriveProstateVolume(
      merged.prostateWidthMm,
      merged.prostateHeightMm,
      merged.prostateAPMm
    );
    onChange({ ...merged, prostateVolumeMl: computed ?? 0 });
  };

  const overridden = value.isStagingOverridden === true;

  // When auto-derive is active (overridden=false), keep the stored
  // clinicalT/N/M synced to the canonical derivation. This guarantees
  // consumers reading the structured input see consistent staging values
  // without having to call the derive helpers themselves.
  React.useEffect(() => {
    if (overridden) return;
    if (
      value.clinicalT !== derivedT ||
      value.clinicalN !== derivedN ||
      value.clinicalM !== derivedM
    ) {
      onChange({
        ...value,
        clinicalT: derivedT,
        clinicalN: derivedN,
        clinicalM: derivedM,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overridden, derivedT, derivedN, derivedM]);

  const handleStagingOverrideToggle = () => {
    if (overridden) {
      // Off: revert to canonical derivation.
      onChange({
        ...value,
        isStagingOverridden: false,
        clinicalT: derivedT,
        clinicalN: derivedN,
        clinicalM: derivedM,
      });
    } else {
      // On: seed override values from current derivation.
      onChange({
        ...value,
        isStagingOverridden: true,
        clinicalT: derivedT,
        clinicalN: derivedN,
        clinicalM: derivedM,
      });
    }
  };

  // Bone involvement handler — clear `boneLesionLocations` when reverting to
  // 'none' so the serializer never emits stale locations.
  const handleBoneInvolvementChange = (next: BoneInvolvement) => {
    if (next === "none") {
      onChange({
        ...value,
        boneInvolvement: next,
        boneLesionLocations: undefined,
      });
    } else {
      onChange({ ...value, boneInvolvement: next });
    }
  };

  const showEauRisk = value.clinicalIndication === "staging_after_diagnosis";

  return (
    <Card className="shadow-sm ring-1 ring-border/50">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-3 text-lg font-bold tracking-tight text-foreground">
          <span
            aria-hidden="true"
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground shadow-sm"
          >
            3
          </span>
          Whole-gland &amp; Staging
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-x-6 gap-y-5 md:grid-cols-2">
          {/* 1. Prostate dimensions (W × H × AP) → ellipsoid-derived volume.
                Three orthogonal measurements in mm; volume is auto-computed
                via V = W × H × AP × 0.52 / 1000 (ellipsoid approximation,
                where 0.52 ≈ π/6) and written back into `prostateVolumeMl`
                so PSA density and the downstream serializer continue to
                consume a single canonical value. */}
          <div className="md:col-span-2 grid gap-x-6 gap-y-5 sm:grid-cols-2 md:grid-cols-3">
            <NumberField
              id={id("width")}
              label="Width (TR) · 좌우"
              value={value.prostateWidthMm}
              onChange={(w) =>
                handleDimensionChange({ prostateWidthMm: w })
              }
              unit="mm"
              min="10"
              max="100"
              step="0.1"
              required
            />
            <NumberField
              id={id("height")}
              label="Height (CC) · 상하"
              value={value.prostateHeightMm}
              onChange={(h) =>
                handleDimensionChange({ prostateHeightMm: h })
              }
              unit="mm"
              min="10"
              max="100"
              step="0.1"
              required
            />
            <NumberField
              id={id("ap")}
              label="AP · 전후"
              value={value.prostateAPMm}
              onChange={(ap) =>
                handleDimensionChange({ prostateAPMm: ap })
              }
              unit="mm"
              min="10"
              max="100"
              step="0.1"
              required
            />
          </div>

          <div className="md:col-span-2 grid gap-x-6 gap-y-5 md:grid-cols-2">
            {/* Prostate volume — auto-derived from W/H/AP, read-only */}
            <div className="rounded-lg border border-border p-3 flex flex-col gap-1">
              <span className="text-[0.9375rem] font-bold tracking-tight text-foreground">
                Prostate volume · 전립선 부피
                <span className="ml-1 text-xs font-normal text-muted-foreground">
                  (auto-derived)
                </span>
              </span>
              <p className="text-sm text-card-foreground">
                {derivedVolumeMl !== undefined ? `${derivedVolumeMl} mL` : "—"}
              </p>
              <p className="text-xs text-muted-foreground">
                Ellipsoid approximation: W × H × AP × 0.52 / 1000.
              </p>
            </div>

            {/* PSA density — auto-displayed read-only (E-6, N-6) */}
            <div className="rounded-lg border border-border p-3 flex flex-col gap-1">
              <span className="text-[0.9375rem] font-bold tracking-tight text-foreground">
                PSA density · PSA 밀도
                <span className="ml-1 text-xs font-normal text-muted-foreground">
                  (auto-derived)
                </span>
              </span>
              <p className="text-sm text-card-foreground">
                {psaDensity !== undefined
                  ? `${psaDensity} ng/mL/cc`
                  : "—"}
              </p>
              <p className="text-xs text-muted-foreground">
                PSA ÷ prostate volume, 1 dp.
              </p>
            </div>
          </div>

          {/* 2. SVI (whole gland) */}
          <FieldRow
            label="Seminal vesicle invasion (whole gland) · 정낭 침범"
            className="md:col-span-2"
          >
            <SegmentedControl<SviWholeGland>
              name={id("sviWhole")}
              ariaLabel="Seminal vesicle invasion (whole gland)"
              value={value.seminalVesicleInvasionWholeGland}
              options={toLabeledOptions(
                SVI_WHOLE_GLAND_OPTIONS,
                SVI_WHOLE_GLAND_LABEL
              )}
              onChange={(next) =>
                onChange({ ...value, seminalVesicleInvasionWholeGland: next })
              }
            />
          </FieldRow>

          {/* 4. Local extension (4 fields) — grouped in a single sub-section
              so the radiologist sees the four organ-level invasion fields as
              a coherent block (T4 driver). */}
          <fieldset className="md:col-span-2 rounded-lg border border-border p-3 flex flex-col gap-3">
            <legend className="px-1 text-[0.9375rem] font-bold tracking-tight text-foreground">
              Local extension · 국소 침범
            </legend>
            <div className="grid gap-x-6 gap-y-5 md:grid-cols-2">
              <FieldRow label="Bladder neck · 방광경부">
                <SegmentedControl<LocalInvolvement>
                  name={id("bladder")}
                  ariaLabel="Bladder neck involvement"
                  value={value.bladderNeckInvolvement}
                  options={toLabeledOptions(
                    LOCAL_INVOLVEMENT_OPTIONS,
                    LOCAL_INVOLVEMENT_LABEL
                  )}
                  onChange={(next) =>
                    onChange({ ...value, bladderNeckInvolvement: next })
                  }
                />
              </FieldRow>

              <FieldRow label="External sphincter · 외요도괄약근">
                <SegmentedControl<LocalInvolvement>
                  name={id("sphincter")}
                  ariaLabel="External sphincter involvement"
                  value={value.externalSphincterInvolvement}
                  options={toLabeledOptions(
                    LOCAL_INVOLVEMENT_OPTIONS,
                    LOCAL_INVOLVEMENT_LABEL
                  )}
                  onChange={(next) =>
                    onChange({ ...value, externalSphincterInvolvement: next })
                  }
                />
              </FieldRow>

              <FieldRow label="Rectum · 직장">
                <SegmentedControl<LocalInvolvement>
                  name={id("rectal")}
                  ariaLabel="Rectal involvement"
                  value={value.rectalInvolvement}
                  options={toLabeledOptions(
                    LOCAL_INVOLVEMENT_OPTIONS,
                    LOCAL_INVOLVEMENT_LABEL
                  )}
                  onChange={(next) =>
                    onChange({ ...value, rectalInvolvement: next })
                  }
                />
              </FieldRow>

              <FieldRow label="Pelvic sidewall · 골반측벽">
                <SegmentedControl<LocalInvolvement>
                  name={id("sidewall")}
                  ariaLabel="Pelvic sidewall involvement"
                  value={value.pelvicSidewallInvolvement}
                  options={toLabeledOptions(
                    LOCAL_INVOLVEMENT_OPTIONS,
                    LOCAL_INVOLVEMENT_LABEL
                  )}
                  onChange={(next) =>
                    onChange({ ...value, pelvicSidewallInvolvement: next })
                  }
                />
              </FieldRow>
            </div>
          </fieldset>

          {/* 5. Regional lymph nodes — repeatable */}
          <LymphNodeSubCard
            idPrefix={id("regionalLN")}
            kind="regional"
            nodes={value.regionalLymphNodes ?? []}
            onChange={(next) =>
              onChange({
                ...value,
                regionalLymphNodes: next.length > 0 ? next : undefined,
              })
            }
          />

          {/* 6. Non-regional lymph nodes — repeatable */}
          <LymphNodeSubCard
            idPrefix={id("nonRegionalLN")}
            kind="non_regional"
            nodes={value.nonRegionalLymphNodes ?? []}
            onChange={(next) =>
              onChange({
                ...value,
                nonRegionalLymphNodes: next.length > 0 ? next : undefined,
              })
            }
          />

          {/* 7. Bone involvement (S-2 conditional) */}
          <FieldRow label="Bone involvement · 골 침범" className="md:col-span-2">
            <SegmentedControl<BoneInvolvement>
              name={id("bone")}
              ariaLabel="Bone involvement"
              value={value.boneInvolvement}
              options={toLabeledOptions(
                BONE_INVOLVEMENT_OPTIONS,
                BONE_INVOLVEMENT_LABEL
              )}
              onChange={handleBoneInvolvementChange}
            />
          </FieldRow>

          {/* 7a. Bone lesion locations — only when bone involvement !== 'none' */}
          {value.boneInvolvement !== "none" && (
            <BoneLesionLocationsPicker
              id={id("boneLocations")}
              selected={value.boneLesionLocations ?? []}
              onChange={(next) =>
                onChange({
                  ...value,
                  boneLesionLocations: next.length > 0 ? next : undefined,
                })
              }
            />
          )}

          {/* 8. Other distant metastasis */}
          <FieldRow
            label="Other distant metastasis · 기타 원격 전이"
            className="md:col-span-2"
          >
            <SegmentedControl<OtherDistantMets>
              name={id("otherMets")}
              ariaLabel="Other distant metastasis"
              value={value.otherDistantMetastasis}
              options={toLabeledOptions(
                OTHER_DISTANT_METS_OPTIONS,
                OTHER_DISTANT_METS_LABEL
              )}
              onChange={(next) =>
                onChange({ ...value, otherDistantMetastasis: next })
              }
            />
          </FieldRow>

          {/* 9. Auto-derived staging block (cT / cN / cM) with override */}
          <fieldset className="md:col-span-2 rounded-lg border border-border p-3 flex flex-col gap-3">
            <legend
              id={`${id("staging")}-legend`}
              className="px-1 text-[0.9375rem] font-bold tracking-tight text-foreground"
            >
              AJCC 8th clinical staging · 임상 병기
              <span className="ml-1 text-xs font-normal text-muted-foreground">
                (auto-derived)
              </span>
            </legend>

            <div className="grid gap-x-6 gap-y-3 md:grid-cols-3">
              {!overridden ? (
                <>
                  <div className="rounded-md border border-border bg-muted/20 p-2">
                    <span className="text-xs font-medium text-muted-foreground">
                      cT
                    </span>
                    <p className="text-sm font-semibold text-foreground">
                      {derivedT}
                    </p>
                  </div>
                  <div className="rounded-md border border-border bg-muted/20 p-2">
                    <span className="text-xs font-medium text-muted-foreground">
                      cN
                    </span>
                    <p className="text-sm font-semibold text-foreground">
                      {derivedN}
                    </p>
                  </div>
                  <div className="rounded-md border border-border bg-muted/20 p-2">
                    <span className="text-xs font-medium text-muted-foreground">
                      cM
                    </span>
                    <p className="text-sm font-semibold text-foreground">
                      {derivedM}
                    </p>
                  </div>
                </>
              ) : (
                <>
                  {/* Manual override editors */}
                  <div className="rounded-md border border-border p-2 flex flex-col gap-1">
                    <label
                      htmlFor={id("ctOverride")}
                      className="text-xs font-bold tracking-tight text-foreground"
                    >
                      cT (override)
                    </label>
                    <select
                      id={id("ctOverride")}
                      value={value.clinicalT ?? derivedT}
                      onChange={(e) =>
                        onChange({
                          ...value,
                          clinicalT: e.target.value as ClinicalT,
                        })
                      }
                      className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {CLINICAL_T_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="rounded-md border border-border p-2 flex flex-col gap-1">
                    <label
                      htmlFor={id("cnOverride")}
                      className="text-xs font-bold tracking-tight text-foreground"
                    >
                      cN (override)
                    </label>
                    <select
                      id={id("cnOverride")}
                      value={value.clinicalN ?? derivedN}
                      onChange={(e) =>
                        onChange({
                          ...value,
                          clinicalN: e.target.value as ClinicalN,
                        })
                      }
                      className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {CLINICAL_N_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="rounded-md border border-border p-2 flex flex-col gap-1">
                    <label
                      htmlFor={id("cmOverride")}
                      className="text-xs font-bold tracking-tight text-foreground"
                    >
                      cM (override)
                    </label>
                    <select
                      id={id("cmOverride")}
                      value={value.clinicalM ?? derivedM}
                      onChange={(e) =>
                        onChange({
                          ...value,
                          clinicalM: e.target.value as ClinicalM,
                        })
                      }
                      className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {CLINICAL_M_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}
            </div>

            <div>
              <Button
                type="button"
                variant={overridden ? "default" : "outline"}
                size="sm"
                onClick={handleStagingOverrideToggle}
                aria-pressed={overridden}
              >
                {overridden ? "자동값으로 되돌리기" : "수동 override"}
              </Button>
            </div>
          </fieldset>

          {/* 10. EAU risk group — only when clinicalIndication = staging_after_diagnosis (S-1) */}
          {showEauRisk && (
            <div className="md:col-span-2 rounded-lg border border-border p-3 flex flex-col gap-1">
              <span className="text-[0.9375rem] font-bold tracking-tight text-foreground">
                EAU risk group · EAU 위험 분류
                <span className="ml-1 text-xs font-normal text-muted-foreground">
                  (auto-derived, EAU 2025/2026)
                </span>
              </span>
              <p className="text-sm font-semibold text-foreground">
                {eauRiskGroup}
              </p>
              <p className="text-xs text-muted-foreground">
                Cornford 2025 — staging-after-diagnosis only.
              </p>
            </div>
          )}

          {/* 11. PI-QUAL block (required submission gate, U-7) */}
          <fieldset className="md:col-span-2 rounded-lg border border-border p-3 flex flex-col gap-3">
            <legend className="px-1 text-[0.9375rem] font-bold tracking-tight text-foreground">
              PI-QUAL v2 · 영상 품질 평가
            </legend>

            <div className="grid gap-x-6 gap-y-5 md:grid-cols-2">
              {/* Overall — RadioCardGroup with semantic tones */}
              <FieldRow
                label="PI-QUAL overall · 종합 점수"
                className="md:col-span-2"
                required
              >
                <RadioCardGroup<PiQualOverall>
                  name={id("piqualOverall")}
                  ariaLabel="PI-QUAL overall"
                  value={value.piQualOverall}
                  options={PIQUAL_OVERALL_RADIO_OPTIONS}
                  onChange={(next) =>
                    onChange({ ...value, piQualOverall: next })
                  }
                  columns={3}
                />
              </FieldRow>

              {/* T2W subscore (1–4) */}
              <FieldRow label="T2W subscore">
                <SegmentedControl<PiQualT2WDwiSubscore>
                  name={id("piqualT2W")}
                  ariaLabel="PI-QUAL T2W subscore"
                  value={value.piQualT2WSubscore}
                  options={toSegmentedOptions(
                    PIQUAL_T2W_DWI_SUBSCORE_OPTIONS
                  )}
                  onChange={(next) =>
                    onChange({ ...value, piQualT2WSubscore: next })
                  }
                />
              </FieldRow>

              {/* DWI subscore (1–4) */}
              <FieldRow label="DWI subscore">
                <SegmentedControl<PiQualT2WDwiSubscore>
                  name={id("piqualDWI")}
                  ariaLabel="PI-QUAL DWI subscore"
                  value={value.piQualDWISubscore}
                  options={toSegmentedOptions(
                    PIQUAL_T2W_DWI_SUBSCORE_OPTIONS
                  )}
                  onChange={(next) =>
                    onChange({ ...value, piQualDWISubscore: next })
                  }
                />
              </FieldRow>

              {/* DCE subscore (+ / - / N/A) — optional */}
              <FieldRow
                label="DCE subscore · 동적조영 점수"
                optional
                className="md:col-span-2"
              >
                <SegmentedControl<PiQualDceSubscore>
                  name={id("piqualDCE")}
                  ariaLabel="PI-QUAL DCE subscore"
                  value={value.piQualDCESubscore}
                  options={toLabeledOptions(
                    PIQUAL_DCE_SUBSCORE_OPTIONS,
                    PIQUAL_DCE_LABEL
                  )}
                  onChange={(next) =>
                    onChange({ ...value, piQualDCESubscore: next })
                  }
                />
              </FieldRow>
            </div>
          </fieldset>
        </div>
      </CardContent>
    </Card>
  );
}
