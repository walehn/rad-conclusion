"use client";

import * as React from "react";
import { AlertTriangle, Plus, X } from "lucide-react";
import {
  BONE_INVOLVEMENT_OPTIONS,
  CLINICAL_M_OPTIONS,
  CLINICAL_N_OPTIONS,
  MRI_T_OPTIONS,
  LOCAL_INVOLVEMENT_OPTIONS,
  OTHER_DISTANT_METS_OPTIONS,
  PIQUAL_DCE_SUBSCORE_OPTIONS,
  PIQUAL_T2W_DWI_SUBSCORE_OPTIONS,
  SVI_WHOLE_GLAND_OPTIONS,
  type BoneInvolvement,
  type ClinicalM,
  type ClinicalN,
  type MriT,
  type EauRiskGroup,
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
  deriveMriT,
  deriveMriT2Laterality,
  deriveEauRiskGroup,
  deriveMriProtocol,
  derivePiQualOverall,
  deriveProstateVolume,
  derivePsaDensity,
  type MriT2Laterality,
  type ProstateLymphNode,
  type ProstateStructuredInput,
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
  FormSection,
  InlineField,
  NumberInput,
  Readout,
  Row,
  compactInputClass,
} from "@/components/compact-form";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Option labels — short Korean labels so each group fits one row
// ---------------------------------------------------------------------------

const SVI_WHOLE_GLAND_LABEL: Record<SviWholeGland, string> = {
  none: "없음",
  right: "우측",
  left: "좌측",
  bilateral: "양측",
};

const LOCAL_INVOLVEMENT_LABEL: Record<LocalInvolvement, string> = {
  none: "없음",
  abutment: "인접",
  invasion: "침범",
};

const BONE_INVOLVEMENT_LABEL: Record<BoneInvolvement, string> = {
  none: "없음",
  equivocal: "모호",
  definite: "확실",
};

const OTHER_DISTANT_METS_LABEL: Record<OtherDistantMets, string> = {
  none: "없음",
  lung: "폐",
  liver: "간",
  other: "기타",
};

const PIQUAL_OVERALL_LABEL: Record<PiQualOverall, string> = {
  "1_inadequate": "PI-QUAL 1 부적합",
  "2_acceptable": "PI-QUAL 2 양호",
  "3_optimal": "PI-QUAL 3 우수",
};

const PIQUAL_DCE_LABEL: Record<PiQualDceSubscore, string> = {
  "+": "+ 적절",
  "-": "− 부적절",
  not_applicable: "미시행",
};

const CLINICAL_M_LABEL: Record<ClinicalM, string> = {
  not_assessed: "Not assessed · 골반 MRI로 평가 안 함",
  M0: "M0",
  M1a: "M1a",
  M1b: "M1b",
  M1c: "M1c",
};

const T2_SIDE_LABEL: Record<MriT2Laterality, string> = {
  right: "우엽",
  left: "좌엽",
  both: "양엽",
};

const EAU_LABEL: Record<EauRiskGroup, string> = {
  low: "low",
  intermediate_favourable: "intermediate-favourable",
  intermediate_unfavourable: "intermediate-unfavourable",
  high: "high",
  metastatic: "metastatic",
  not_applicable: "not applicable",
};

function toLabeledOptions<T extends string>(
  values: ReadonlyArray<T>,
  labels: Record<T, string>
): SegmentedControlOption<T>[] {
  return values.map((v) => ({ value: v, label: labels[v] }));
}

/** The four extraprostatic structures sharing the none/abutment/invasion scale. */
const LOCAL_STRUCTURES = [
  { key: "bladderNeckInvolvement", label: "방광경부", aria: "Bladder neck involvement" },
  { key: "externalSphincterInvolvement", label: "외괄약근", aria: "External sphincter involvement" },
  { key: "rectalInvolvement", label: "직장", aria: "Rectal involvement" },
  { key: "pelvicSidewallInvolvement", label: "골반측벽", aria: "Pelvic sidewall involvement" },
] as const;

// ---------------------------------------------------------------------------
// Bone lesion location chips (S-2)
// ---------------------------------------------------------------------------

const BONE_LESION_LOCATIONS = [
  { value: "pelvis", label: "골반" },
  { value: "lumbar_spine", label: "요추" },
  { value: "sacrum", label: "천골" },
  { value: "femur_R", label: "우측 대퇴" },
  { value: "femur_L", label: "좌측 대퇴" },
  { value: "other", label: "기타" },
] as const;

// ---------------------------------------------------------------------------
// Lymph nodes — one line per node
// ---------------------------------------------------------------------------

function parseFeatures(raw: string): string[] {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

interface NodeRowProps {
  idPrefix: string;
  isRegional: boolean;
  node: ProstateLymphNode;
  onChange: (next: ProstateLymphNode) => void;
  onRemove: () => void;
  removeLabel: string;
}

function NodeRow({
  idPrefix,
  isRegional,
  node,
  onChange,
  onRemove,
  removeLabel,
}: NodeRowProps) {
  // The features box keeps its own text: rebuilding it from the parsed array
  // on every keystroke dropped a just-typed comma, so a second feature could
  // never be entered. The draft resyncs only when the stored list changes
  // from outside (e.g. a node above this one was removed).
  const stored = node.suspiciousFeatures ?? [];
  const [draft, setDraft] = React.useState(stored.join(", "));
  React.useEffect(() => {
    if (parseFeatures(draft).join("\u0000") !== stored.join("\u0000")) {
      setDraft(stored.join(", "));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stored.join("\u0000")]);

  const stationValue = isRegional ? (node.station ?? "") : (node.location ?? "");

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-md bg-muted/40 px-2 py-1.5">
      <input
        id={`${idPrefix}-station`}
        type="text"
        maxLength={80}
        aria-label={isRegional ? "Station · 위치" : "Location · 위치"}
        placeholder={isRegional ? "위치 (예: obturator)" : "위치 (예: retroperitoneal)"}
        value={stationValue}
        onChange={(e) => {
          const v = e.target.value || undefined;
          onChange(isRegional ? { ...node, station: v } : { ...node, location: v });
        }}
        className={cn(compactInputClass, "w-40")}
      />
      <InlineField label="단축" htmlFor={`${idPrefix}-shortAxis`}>
        <NumberInput
          id={`${idPrefix}-shortAxis`}
          value={node.shortAxisMm}
          onChange={(v) => onChange({ ...node, shortAxisMm: v ?? 0 })}
          unit="mm"
          min="0"
          max="100"
          widthClass="w-14"
          emptyWhenZero
        />
      </InlineField>
      <SegmentedControl<"round" | "oval" | "lobulated">
        name={`${idPrefix}-morphology`}
        ariaLabel="Morphology · 형태"
        size="xs"
        value={node.morphology}
        options={[
          { value: "round", label: "원형" },
          { value: "oval", label: "타원" },
          { value: "lobulated", label: "분엽" },
        ]}
        onChange={(next) => onChange({ ...node, morphology: next })}
      />
      <input
        id={`${idPrefix}-features`}
        type="text"
        maxLength={200}
        aria-label="Suspicious features · 의심 소견 (comma-separated)"
        placeholder="의심 소견 (쉼표로 구분)"
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          const parts = parseFeatures(e.target.value);
          onChange({
            ...node,
            suspiciousFeatures: parts.length > 0 ? parts : undefined,
          });
        }}
        className={cn(compactInputClass, "w-44 min-w-0 flex-1")}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={onRemove}
        aria-label={removeLabel}
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

function NodeList({
  idPrefix,
  kind,
  nodes,
  onChange,
}: {
  idPrefix: string;
  kind: "regional" | "non_regional";
  nodes: ProstateLymphNode[];
  onChange: (next: ProstateLymphNode[]) => void;
}) {
  const isRegional = kind === "regional";
  return (
    <div className="flex w-full flex-col gap-1.5">
      {nodes.map((node, idx) => (
        <NodeRow
          key={idx}
          idPrefix={`${idPrefix}-${idx}`}
          isRegional={isRegional}
          node={node}
          onChange={(next) => onChange(nodes.map((n, i) => (i === idx ? next : n)))}
          onRemove={() => onChange(nodes.filter((_, i) => i !== idx))}
          removeLabel={`Remove ${isRegional ? "regional" : "non-regional"} node #${idx + 1}`}
        />
      ))}
      <button
        type="button"
        onClick={() => onChange([...nodes, { shortAxisMm: 0 }])}
        className="inline-flex items-center gap-1 self-start text-xs text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
        림프절 추가
      </button>
    </div>
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
  const derivedT = deriveMriT(value);
  const derivedN = deriveClinicalN(value);
  const derivedM = deriveClinicalM(value);
  const eauRiskGroup = deriveEauRiskGroup(value);
  const derivedVolumeMl = deriveProstateVolume(
    value.prostateWidthMm,
    value.prostateHeightMm,
    value.prostateAPMm
  );
  const psaDensity = derivePsaDensity(value.psaNgPerMl, value.prostateVolumeMl);
  const piQualOverall = derivePiQualOverall(
    value.piQualT2WSubscore,
    value.piQualDWISubscore,
    value.piQualDCESubscore
  );
  // PI-QUAL v2 scores mpMRI with its DCE images: a lesion DCE result with
  // no DCE quality rating leaves the overall score on the no-contrast table.
  const dceUnrated =
    deriveMriProtocol(value) === "mpMRI" &&
    value.piQualDCESubscore !== "+" &&
    value.piQualDCESubscore !== "-";

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
  // mriT/clinicalN/M synced to the canonical derivation. This guarantees
  // consumers reading the structured input see consistent staging values
  // without having to call the derive helpers themselves.
  React.useEffect(() => {
    if (overridden) return;
    if (
      value.mriT !== derivedT ||
      value.clinicalN !== derivedN ||
      value.clinicalM !== derivedM
    ) {
      onChange({
        ...value,
        mriT: derivedT,
        clinicalN: derivedN,
        clinicalM: derivedM,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overridden, derivedT, derivedN, derivedM]);

  const handleStagingOverrideToggle = () => {
    // Both directions re-seed from the derivation: off reverts to it, on
    // starts the override from it.
    onChange({
      ...value,
      isStagingOverridden: !overridden,
      mriT: derivedT,
      clinicalN: derivedN,
      clinicalM: derivedM,
    });
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

  // Negative MRI suppresses AJCC/EAU staging UI per prostate.ts NEGATIVE CASE
  // HANDLING: the serializer emits "AJCC TNM staging: not applicable on
  // negative MRI" and the prompt forces the STAGING section to a single
  // "Not applicable" line, so the auto-derived T/N/M and the EAU risk group
  // would only confuse the radiologist.
  const showStaging = !value.noSuspiciousLesion;

  const regionalNodes = value.regionalLymphNodes ?? [];
  const nonRegionalNodes = value.nonRegionalLymphNodes ?? [];

  // One-line summary of the usually-negative block; anything non-default is
  // listed so a collapsed block still shows every recorded finding.
  const abnormal: string[] = [];
  if (value.seminalVesicleInvasionWholeGland !== "none") {
    abnormal.push(
      `정낭 ${SVI_WHOLE_GLAND_LABEL[value.seminalVesicleInvasionWholeGland]}`
    );
  }
  for (const s of LOCAL_STRUCTURES) {
    if (value[s.key] !== "none") {
      abnormal.push(`${s.label} ${LOCAL_INVOLVEMENT_LABEL[value[s.key]]}`);
    }
  }
  if (regionalNodes.length > 0) abnormal.push(`국소 림프절 ${regionalNodes.length}`);
  if (nonRegionalNodes.length > 0)
    abnormal.push(`비국소 림프절 ${nonRegionalNodes.length}`);
  if (value.boneInvolvement !== "none") {
    abnormal.push(`골 ${BONE_INVOLVEMENT_LABEL[value.boneInvolvement]}`);
  }
  if (value.otherDistantMetastasis !== "none") {
    abnormal.push(`원격 ${OTHER_DISTANT_METS_LABEL[value.otherDistantMetastasis]}`);
  }

  const shownM = overridden ? (value.clinicalM ?? derivedM) : derivedM;
  const t2Side = derivedT === "T2" ? deriveMriT2Laterality(value) : undefined;
  const stagingText = overridden
    ? undefined
    : `${derivedT ? `MRI ${derivedT}${t2Side ? ` (${T2_SIDE_LABEL[t2Side]})` : ""}` : "MRI T 없음"} · c${derivedN} · ${
        derivedM === "not_assessed" ? "cM 평가 안 함" : `c${derivedM}`
      }`;

  const sectionSummary = [
    derivedVolumeMl !== undefined && `${derivedVolumeMl} mL`,
    PIQUAL_OVERALL_LABEL[piQualOverall],
  ]
    .filter(Boolean)
    .join(" · ");

  const selectClass = cn(compactInputClass, "w-auto pr-6");
  const boneLocations = value.boneLesionLocations ?? [];

  return (
    <FormSection
      id="prostate-section-gland"
      step={3}
      title="전립선 · 병기"
      summary={sectionSummary}
    >
      {/* Prostate dimensions (W × H × AP) → ellipsoid-derived volume
          (V = W × H × AP × 0.52 / 1000), written back into
          `prostateVolumeMl` so PSA density and the serializer consume a
          single canonical value. */}
      <Row label="크기" required>
        <InlineField label="좌우" htmlFor={id("width")}>
          <NumberInput
            id={id("width")}
            value={value.prostateWidthMm}
            onChange={(w) => handleDimensionChange({ prostateWidthMm: w })}
            min="10"
            max="100"
            step="0.1"
            widthClass="w-16"
          />
        </InlineField>
        <InlineField label="상하" htmlFor={id("height")}>
          <NumberInput
            id={id("height")}
            value={value.prostateHeightMm}
            onChange={(h) => handleDimensionChange({ prostateHeightMm: h })}
            min="10"
            max="100"
            step="0.1"
            widthClass="w-16"
          />
        </InlineField>
        <InlineField label="전후" htmlFor={id("ap")}>
          <NumberInput
            id={id("ap")}
            value={value.prostateAPMm}
            onChange={(ap) => handleDimensionChange({ prostateAPMm: ap })}
            unit="mm"
            min="10"
            max="100"
            step="0.1"
            widthClass="w-16"
          />
        </InlineField>
        <span className="inline-flex flex-wrap gap-1.5">
          <Readout
            label="부피"
            value={derivedVolumeMl !== undefined ? `${derivedVolumeMl} mL` : "—"}
          />
          <Readout
            label="PSAD"
            value={psaDensity !== undefined ? `${psaDensity.toFixed(2)}` : "—"}
          />
        </span>
      </Row>

      {/* PI-QUAL v2: overall is auto-derived from T2W/DWI (de Rooij 2024) —
          max ≤ 2 → inadequate; both 4 → optimal; otherwise acceptable. */}
      <Row label="PI-QUAL" required>
        <InlineField label="T2W">
          <SegmentedControl<PiQualT2WDwiSubscore>
            name={id("piqualT2W")}
            ariaLabel="PI-QUAL T2W subscore"
            size="xs"
            value={value.piQualT2WSubscore}
            options={toSegmentedOptions(PIQUAL_T2W_DWI_SUBSCORE_OPTIONS)}
            onChange={(next) =>
              onChange({
                ...value,
                piQualT2WSubscore: next,
                piQualOverall: derivePiQualOverall(
                  next,
                  value.piQualDWISubscore,
                  value.piQualDCESubscore
                ),
              })
            }
          />
        </InlineField>
        <InlineField label="DWI">
          <SegmentedControl<PiQualT2WDwiSubscore>
            name={id("piqualDWI")}
            ariaLabel="PI-QUAL DWI subscore"
            size="xs"
            value={value.piQualDWISubscore}
            options={toSegmentedOptions(PIQUAL_T2W_DWI_SUBSCORE_OPTIONS)}
            onChange={(next) =>
              onChange({
                ...value,
                piQualDWISubscore: next,
                piQualOverall: derivePiQualOverall(
                  value.piQualT2WSubscore,
                  next,
                  value.piQualDCESubscore
                ),
              })
            }
          />
        </InlineField>
        <span title="+ : DCE 화질 기준 2개 모두 충족 · − : 1개 이하 충족 · 미시행 : DCE를 찍지 않음 (bpMRI, T2W·DWI만으로 판정)">
          <InlineField label="DCE">
            <SegmentedControl<PiQualDceSubscore>
              name={id("piqualDCE")}
              ariaLabel="PI-QUAL DCE subscore"
              size="xs"
              value={value.piQualDCESubscore}
              options={toLabeledOptions(PIQUAL_DCE_SUBSCORE_OPTIONS, PIQUAL_DCE_LABEL)}
              onChange={(next) =>
                onChange({
                  ...value,
                  piQualDCESubscore: next,
                  piQualOverall: derivePiQualOverall(
                    value.piQualT2WSubscore,
                    value.piQualDWISubscore,
                    next
                  ),
                })
              }
            />
          </InlineField>
        </span>
        <span role="status" aria-live="polite">
          <Readout
            label="종합"
            value={PIQUAL_OVERALL_LABEL[piQualOverall]}
            tone={
              piQualOverall === "3_optimal"
                ? "good"
                : piQualOverall === "2_acceptable"
                  ? "warn"
                  : "bad"
            }
          />
        </span>
        {dceUnrated && (
          <span
            role="note"
            className="inline-flex items-center gap-1 text-xs text-amber-700 dark:text-amber-300"
          >
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
            병변에 DCE 결과가 있습니다. DCE를 시행했다면 PI-QUAL DCE를 평가하세요.
          </span>
        )}
      </Row>

      <Disclosure
        id={id("extent")}
        label="침범 · 림프절 · 전이"
        summary={abnormal.length > 0 ? abnormal.join(" · ") : "모두 없음 (기본값)"}
        forceOpen={abnormal.length > 0}
      >
        <Row label="정낭">
          <SegmentedControl<SviWholeGland>
            name={id("sviWhole")}
            ariaLabel="Seminal vesicle invasion (whole gland)"
            size="xs"
            value={value.seminalVesicleInvasionWholeGland}
            options={toLabeledOptions(SVI_WHOLE_GLAND_OPTIONS, SVI_WHOLE_GLAND_LABEL)}
            onChange={(next) =>
              onChange({ ...value, seminalVesicleInvasionWholeGland: next })
            }
          />
        </Row>
        {LOCAL_STRUCTURES.map((s) => (
          <Row key={s.key} label={s.label}>
            <SegmentedControl<LocalInvolvement>
              name={id(s.key)}
              ariaLabel={s.aria}
              size="xs"
              value={value[s.key]}
              options={toLabeledOptions(LOCAL_INVOLVEMENT_OPTIONS, LOCAL_INVOLVEMENT_LABEL)}
              onChange={(next) => onChange({ ...value, [s.key]: next })}
            />
          </Row>
        ))}
        <Row label="국소 림프절" align="start">
          <NodeList
            idPrefix={id("regionalLN")}
            kind="regional"
            nodes={regionalNodes}
            onChange={(next) =>
              onChange({
                ...value,
                regionalLymphNodes: next.length > 0 ? next : undefined,
              })
            }
          />
        </Row>
        <Row label="비국소 림프절" align="start">
          <NodeList
            idPrefix={id("nonRegionalLN")}
            kind="non_regional"
            nodes={nonRegionalNodes}
            onChange={(next) =>
              onChange({
                ...value,
                nonRegionalLymphNodes: next.length > 0 ? next : undefined,
              })
            }
          />
        </Row>
        <Row label="골">
          <SegmentedControl<BoneInvolvement>
            name={id("bone")}
            ariaLabel="Bone involvement"
            size="xs"
            value={value.boneInvolvement}
            options={toLabeledOptions(BONE_INVOLVEMENT_OPTIONS, BONE_INVOLVEMENT_LABEL)}
            onChange={handleBoneInvolvementChange}
          />
          {value.boneInvolvement !== "none" && (
            <div
              role="group"
              aria-label="Bone lesion locations · 골 병변 위치"
              className="flex flex-wrap gap-1"
            >
              {BONE_LESION_LOCATIONS.map((opt) => (
                <ChipToggle
                  key={opt.value}
                  active={boneLocations.includes(opt.value)}
                  onClick={() => {
                    const next = boneLocations.includes(opt.value)
                      ? boneLocations.filter((c) => c !== opt.value)
                      : [...boneLocations, opt.value];
                    onChange({
                      ...value,
                      boneLesionLocations: next.length > 0 ? next : undefined,
                    });
                  }}
                >
                  {opt.label}
                </ChipToggle>
              ))}
            </div>
          )}
        </Row>
        <Row label="원격 전이">
          <SegmentedControl<OtherDistantMets>
            name={id("otherMets")}
            ariaLabel="Other distant metastasis"
            size="xs"
            value={value.otherDistantMetastasis}
            options={toLabeledOptions(OTHER_DISTANT_METS_OPTIONS, OTHER_DISTANT_METS_LABEL)}
            onChange={(next) => onChange({ ...value, otherDistantMetastasis: next })}
          />
        </Row>
      </Disclosure>

      {/* Auto-derived staging (MRI T / cN / cM) with override. Hidden on
          negative MRI: AJCC categorisation is replaced by the "Not
          applicable" line in the rendered STAGING section. */}
      {showStaging && (
        <div className="mt-1 border-t border-border/60 pt-1">
          <Row label={overridden ? "병기 (수동)" : "병기 (자동)"}>
            {stagingText && (
              <span className="text-[13px] font-semibold text-foreground">
                {stagingText}
              </span>
            )}
            {overridden && (
              <>
                <InlineField label="MRI T" htmlFor={id("mriTOverride")}>
                  <select
                    id={id("mriTOverride")}
                    value={value.mriT ?? derivedT ?? "T2"}
                    onChange={(e) =>
                      onChange({ ...value, mriT: e.target.value as MriT })
                    }
                    className={selectClass}
                  >
                    {MRI_T_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </InlineField>
                <InlineField label="cN" htmlFor={id("cnOverride")}>
                  <select
                    id={id("cnOverride")}
                    value={value.clinicalN ?? derivedN}
                    onChange={(e) =>
                      onChange({ ...value, clinicalN: e.target.value as ClinicalN })
                    }
                    className={selectClass}
                  >
                    {CLINICAL_N_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </InlineField>
                <InlineField label="cM" htmlFor={id("cmOverride")}>
                  <select
                    id={id("cmOverride")}
                    value={shownM}
                    onChange={(e) =>
                      onChange({ ...value, clinicalM: e.target.value as ClinicalM })
                    }
                    className={selectClass}
                  >
                    {CLINICAL_M_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {CLINICAL_M_LABEL[opt]}
                      </option>
                    ))}
                  </select>
                </InlineField>
              </>
            )}
            {/* EAU risk group — staging_after_diagnosis only (S-1). */}
            {showEauRisk && <Readout label="EAU" value={EAU_LABEL[eauRiskGroup]} />}
            <button
              type="button"
              onClick={handleStagingOverrideToggle}
              aria-pressed={overridden}
              className="text-xs text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {overridden ? "자동값으로 되돌리기" : "수동 수정"}
            </button>
          </Row>
        </div>
      )}
    </FormSection>
  );
}
