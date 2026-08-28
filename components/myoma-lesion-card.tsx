"use client";

import * as React from "react";
import { X } from "lucide-react";
import {
  MYOMA_DEGENERATIONS,
  MYOMA_DIFFUSION,
  MYOMA_ENHANCEMENTS,
  MYOMA_FIGO_TYPES,
  MYOMA_LAYERS,
  MYOMA_MARGINS,
  MYOMA_MYOMETRIAL_FRACTIONS,
  MYOMA_OTHER_SITE_WALLS,
  MYOMA_T2_SIGNALS,
  MYOMA_WALLS,
  deriveFigoType,
  deriveFunakiType,
  distortsCavity,
  type MyomaFigoType,
} from "@/lib/prompts/disease-templates/myoma-fields";
import type { MyomaPurpose } from "@/lib/prompts/disease-templates/myoma-fields";
import type { MyomaLesion } from "@/lib/prompts/disease-templates/myoma-serializer";
import { resolveLesionFigo } from "@/lib/prompts/disease-templates/myoma-serializer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import {
  SegmentedControl,
  toSegmentedOptions,
} from "@/components/ui/segmented-control";
import { RadioCardGroup } from "@/components/ui/radio-card-group";
import {
  MYOMA_T2_REFERENCE_RADIO_OPTIONS,
  MYOMA_TRAJECTORY_RADIO_OPTIONS,
} from "@/lib/ui/myoma-options-meta";
import {
  CheckboxGroup,
  DateInput,
  FieldRow,
  NumberField,
  YesNoControl,
} from "@/components/myoma-form-fields";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** True when the wall is FIGO type 8 territory regardless of layer. */
function isOtherSiteWall(wall: MyomaLesion["wall"]): boolean {
  return (
    wall !== undefined &&
    (MYOMA_OTHER_SITE_WALLS as readonly string[]).includes(wall)
  );
}

/**
 * Interval-growth hint: "+2.5 cm / 14 months". Returns null unless both sizes
 * and both dates are present and parseable. Display-only — the rapid-growth
 * call itself stays a manual checkbox, because no single cm/yr threshold is
 * universally accepted.
 */
function growthHint(
  lesion: MyomaLesion,
  studyDate: string | undefined
): string | null {
  const { sizeCm, priorSizeCm, priorStudyDate } = lesion;
  if (
    sizeCm === undefined ||
    priorSizeCm === undefined ||
    priorStudyDate === undefined ||
    studyDate === undefined
  ) {
    return null;
  }
  const from = Date.parse(priorStudyDate);
  const to = Date.parse(studyDate);
  if (Number.isNaN(from) || Number.isNaN(to) || to <= from) return null;

  const deltaCm = sizeCm - priorSizeCm;
  const months = Math.round((to - from) / (1000 * 60 * 60 * 24 * 30.44));
  if (months < 1) return null;
  const sign = deltaCm >= 0 ? "+" : "";
  return `${sign}${deltaCm.toFixed(1)} cm / ${months}개월`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface MyomaLesionCardProps {
  value: MyomaLesion;
  onChange: (next: MyomaLesion) => void;
  onRemove?: () => void;
  index: number;
  removable: boolean;
  /** True when this lesion is currently the largest (the index lesion). */
  isIndex: boolean;
  /** Study-level "All myomas typical" — collapses untouched signal fields. */
  allTypical: boolean;
  purpose: MyomaPurpose | undefined;
  /** Study date, for the interval-growth hint. */
  studyDate: string | undefined;
}

export function MyomaLesionCard({
  value,
  onChange,
  onRemove,
  index,
  removable,
  isIndex,
  allTypical,
  purpose,
  studyDate,
}: MyomaLesionCardProps) {
  const fieldId = (suffix: string) => `myoma-lesion-${index}-${suffix}`;

  const derivedFigo = deriveFigoType(value);
  const effectiveFigo = resolveLesionFigo(value);
  const otherSite = isOtherSiteWall(value.wall);

  const showPedunculated =
    !otherSite &&
    (value.layer === "Submucosal" || value.layer === "Subserosal");
  const showFraction =
    !otherSite &&
    (value.layer === "Submucosal" || value.layer === "Subserosal") &&
    value.pedunculated !== true;
  const showEndometrialContact = !otherSite && value.layer === "Intramural";
  const showTransmural =
    !otherSite && value.layer === "Submucosal" && value.pedunculated !== true;

  const anySignalValue =
    value.t2Signal !== undefined ||
    value.degeneration !== undefined ||
    value.enhancement !== undefined ||
    value.diffusion !== undefined ||
    value.adcValue !== undefined ||
    value.margin !== undefined ||
    value.centralNecrosis !== undefined ||
    value.intratumoralHemorrhage !== undefined;

  // Signal block collapses only while the blanket "all typical" statement
  // covers this lesion; Mass characterization exposes it unconditionally
  // because the atypical-feature fields are the point of that referral.
  const signalAlwaysOpen = !allTypical || purpose === "Mass characterization";
  const [signalExpanded, setSignalExpanded] = React.useState(anySignalValue);
  const signalOpen = signalAlwaysOpen || signalExpanded || anySignalValue;

  const hint = growthHint(value, studyDate);

  return (
    <Card className="shadow-sm ring-1 ring-border/50">
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <CardTitle className="flex items-center gap-3 text-lg font-bold tracking-tight text-foreground">
          <span
            aria-hidden="true"
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground shadow-sm"
          >
            3
          </span>
          <span>Myoma</span>
          <span className="text-primary font-extrabold">#{index + 1}</span>
          {isIndex && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
              index (largest)
            </span>
          )}
        </CardTitle>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={!removable}
          onClick={onRemove}
          aria-label={`Remove Myoma #${index + 1}`}
        >
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent>
        <div className="grid gap-x-6 gap-y-5 md:grid-cols-2">
          {/* 1. Location (wall) */}
          <FieldRow label="Location" hint="자궁 벽/부위">
            <Select
              id={fieldId("wall")}
              aria-label={`Myoma #${index + 1} location`}
              value={value.wall ?? ""}
              onChange={(e) =>
                onChange({
                  ...value,
                  wall:
                    e.target.value === ""
                      ? undefined
                      : (e.target.value as MyomaLesion["wall"]),
                })
              }
            >
              <option value="">Select location...</option>
              {MYOMA_WALLS.map((wall) => (
                <option key={wall} value={wall}>
                  {wall}
                </option>
              ))}
            </Select>
            {otherSite && (
              <p className="text-xs text-muted-foreground">
                Cervical / broad ligament / parasitic — FIGO 8 regardless of
                layer.
              </p>
            )}
          </FieldRow>

          {/* 2. Layer */}
          <FieldRow label="Layer" hint="층">
            <SegmentedControl
              name={fieldId("layer")}
              ariaLabel={`Myoma #${index + 1} layer`}
              value={value.layer}
              options={toSegmentedOptions(MYOMA_LAYERS)}
              onChange={(opt) => {
                // Layer change invalidates the layer-specific geometry answers;
                // clearing them keeps the FIGO derivation honest instead of
                // reusing a fraction that belonged to another layer.
                onChange({
                  ...value,
                  layer: opt,
                  myometrialFraction: undefined,
                  endometrialContact: undefined,
                  pedunculated: undefined,
                  transmural: undefined,
                  serosalFraction: undefined,
                });
              }}
            />
          </FieldRow>

          {/* 2a. Pedunculated (submucosal -> FIGO 0, subserosal -> FIGO 7) */}
          {showPedunculated && (
            <fieldset className="rounded-lg border border-border p-3 flex flex-col gap-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  id={fieldId("pedunculated")}
                  type="checkbox"
                  checked={value.pedunculated === true}
                  onChange={(e) =>
                    onChange({
                      ...value,
                      pedunculated: e.target.checked ? true : undefined,
                      // A stalked lesion has no meaningful mural fraction.
                      myometrialFraction: e.target.checked
                        ? undefined
                        : value.myometrialFraction,
                      transmural: e.target.checked
                        ? undefined
                        : value.transmural,
                      serosalFraction: e.target.checked
                        ? undefined
                        : value.serosalFraction,
                    })
                  }
                  className="h-4 w-4 text-primary"
                />
                <span className="text-[0.9375rem] font-bold tracking-tight text-foreground">
                  Pedunculated
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    유경성 —{" "}
                    {value.layer === "Subserosal" ? "FIGO 7" : "FIGO 0"}
                  </span>
                </span>
              </label>
            </fieldset>
          )}

          {/* 2b. Myometrial fraction (FIGO 1 vs 2 / 5 vs 6) */}
          {showFraction && (
            <FieldRow
              label="Intramural fraction"
              hint={
                value.layer === "Submucosal"
                  ? "근층내 비율 — FIGO 1/2 결정"
                  : "근층내 비율 — FIGO 5/6 결정"
              }
            >
              <SegmentedControl
                name={fieldId("fraction")}
                ariaLabel={`Myoma #${index + 1} intramural fraction`}
                value={value.myometrialFraction}
                options={toSegmentedOptions(MYOMA_MYOMETRIAL_FRACTIONS)}
                onChange={(opt) =>
                  onChange({ ...value, myometrialFraction: opt })
                }
              />
            </FieldRow>
          )}

          {/* 2c. Endometrial contact (FIGO 3 vs 4) */}
          {showEndometrialContact && (
            <FieldRow
              label="Endometrial contact"
              hint="내막 접촉 — FIGO 3/4 결정"
            >
              <YesNoControl
                name={fieldId("contact")}
                ariaLabel={`Myoma #${index + 1} endometrial contact`}
                value={value.endometrialContact}
                onChange={(next) =>
                  onChange({ ...value, endometrialContact: next })
                }
              />
            </FieldRow>
          )}

          {/* 2d. Transmural (hybrid N-N) */}
          {showTransmural && (
            <fieldset className="rounded-lg border border-border p-3 flex flex-col gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  id={fieldId("transmural")}
                  type="checkbox"
                  checked={value.transmural === true}
                  onChange={(e) =>
                    onChange({
                      ...value,
                      transmural: e.target.checked ? true : undefined,
                      serosalFraction: e.target.checked
                        ? value.serosalFraction
                        : undefined,
                    })
                  }
                  className="h-4 w-4 text-primary"
                />
                <span className="text-[0.9375rem] font-bold tracking-tight text-foreground">
                  Transmural
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    내막~장막 관통 — hybrid 표기 (예: 2-5)
                  </span>
                </span>
              </label>
              {value.transmural === true && (
                <SegmentedControl
                  name={fieldId("serosal-fraction")}
                  ariaLabel={`Myoma #${index + 1} serosal component`}
                  value={value.serosalFraction ?? ">=50% intramural"}
                  options={toSegmentedOptions(MYOMA_MYOMETRIAL_FRACTIONS)}
                  onChange={(opt) =>
                    onChange({ ...value, serosalFraction: opt })
                  }
                />
              )}
            </fieldset>
          )}

          {/* 3. FIGO result + manual override */}
          <div
            className={cn(
              "md:col-span-2 rounded-lg border p-3 flex flex-wrap items-center gap-3",
              effectiveFigo !== undefined
                ? "border-primary/40 bg-primary/5"
                : "border-border"
            )}
          >
            <span className="text-[0.9375rem] font-bold tracking-tight text-foreground">
              FIGO type
            </span>
            <span
              data-testid={fieldId("figo-value")}
              className={cn(
                "inline-flex items-center rounded-md px-2.5 py-1 text-sm font-bold",
                effectiveFigo !== undefined
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {effectiveFigo ?? "미정 — 위 항목을 선택하세요"}
            </span>
            {effectiveFigo !== undefined && distortsCavity(effectiveFigo) && (
              <span className="rounded-full bg-warning/15 px-2 py-0.5 text-xs font-semibold text-warning">
                Cavity involvement
              </span>
            )}
            <div className="ml-auto flex items-center gap-2">
              <label
                htmlFor={fieldId("figo-override")}
                className="text-xs text-muted-foreground"
              >
                수동 지정
              </label>
              <Select
                id={fieldId("figo-override")}
                aria-label={`Myoma #${index + 1} FIGO override`}
                className="h-8 w-auto py-0"
                value={value.figoOverride ?? ""}
                onChange={(e) =>
                  onChange({
                    ...value,
                    figoOverride:
                      e.target.value === ""
                        ? undefined
                        : (e.target.value as MyomaFigoType),
                  })
                }
              >
                <option value="">
                  Auto{derivedFigo !== undefined ? ` (${derivedFigo})` : ""}
                </option>
                {MYOMA_FIGO_TYPES.map((figo) => (
                  <option key={figo} value={figo}>
                    {figo}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {/* 4. Size */}
          <NumberField
            id={fieldId("size")}
            label="Size (largest)"
            value={value.sizeCm}
            onChange={(v) => onChange({ ...value, sizeCm: v })}
            unit="cm"
          />
          <div className="grid grid-cols-2 gap-x-6">
            <NumberField
              id={fieldId("size2")}
              label="2nd axis"
              value={value.sizeCm2}
              onChange={(v) => onChange({ ...value, sizeCm2: v })}
              unit="cm"
              optional
            />
            <NumberField
              id={fieldId("size3")}
              label="3rd axis"
              value={value.sizeCm3}
              onChange={(v) => onChange({ ...value, sizeCm3: v })}
              unit="cm"
              optional
            />
          </div>

          {/* 5. Comparison with prior study (toggle-gated, mirrors RCC) */}
          <fieldset className="md:col-span-2 rounded-lg border border-border p-3 flex flex-col gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                id={fieldId("hasPriorStudy")}
                type="checkbox"
                checked={value.hasPriorStudy === true}
                onChange={(e) => {
                  if (e.target.checked) {
                    onChange({ ...value, hasPriorStudy: true });
                  } else {
                    onChange({
                      ...value,
                      hasPriorStudy: false,
                      priorSizeCm: undefined,
                      priorStudyDate: undefined,
                      trajectory: undefined,
                      rapidGrowth: undefined,
                    });
                  }
                }}
                className="h-4 w-4 text-primary"
              />
              <span className="text-[0.9375rem] font-bold tracking-tight text-foreground">
                Comparison with prior study available
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  이전 검사와 비교
                </span>
              </span>
            </label>

            {value.hasPriorStudy === true && (
              <div className="grid gap-x-6 gap-y-5 md:grid-cols-2 border-t border-border/60 pt-3">
                <NumberField
                  id={fieldId("priorSize")}
                  label="Prior size"
                  value={value.priorSizeCm}
                  onChange={(v) => onChange({ ...value, priorSizeCm: v })}
                  unit="cm"
                  optional
                />
                <DateInput
                  id={fieldId("priorDate")}
                  label="Prior study date"
                  value={value.priorStudyDate}
                  onChange={(v) => onChange({ ...value, priorStudyDate: v })}
                  optional
                />
                <FieldRow label="Trajectory" className="md:col-span-2">
                  <RadioCardGroup
                    name={fieldId("trajectory")}
                    ariaLabel={`Myoma #${index + 1} trajectory`}
                    value={value.trajectory}
                    options={MYOMA_TRAJECTORY_RADIO_OPTIONS}
                    onChange={(opt) => onChange({ ...value, trajectory: opt })}
                    columns={2}
                  />
                </FieldRow>
                <fieldset className="md:col-span-2 rounded-lg border border-border p-3 flex flex-col gap-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      id={fieldId("rapidGrowth")}
                      type="checkbox"
                      checked={value.rapidGrowth === true}
                      onChange={(e) =>
                        onChange({
                          ...value,
                          rapidGrowth: e.target.checked ? true : undefined,
                        })
                      }
                      className="h-4 w-4 text-primary"
                    />
                    <span className="text-[0.9375rem] font-bold tracking-tight text-foreground">
                      Rapid interval growth
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        급속 성장 — 육종 red flag로 집계됩니다
                      </span>
                    </span>
                  </label>
                  {hint && (
                    <p className="pl-6 text-xs text-muted-foreground">
                      계산된 변화: {hint}
                    </p>
                  )}
                </fieldset>
              </div>
            )}
          </fieldset>

          {/* 6. Signal / morphology */}
          <fieldset className="md:col-span-2 rounded-lg border border-border p-3 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-[0.9375rem] font-bold tracking-tight text-foreground">
                Signal / morphology
                {allTypical && (
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    "All typical" 적용 중 — 예외가 있는 병변만 입력
                  </span>
                )}
              </span>
              {!signalOpen && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSignalExpanded(true)}
                >
                  예외 소견 입력
                </Button>
              )}
            </div>

            {signalOpen && (
              <div className="grid gap-x-6 gap-y-5 md:grid-cols-2 border-t border-border/60 pt-3">
                <FieldRow label="T2 signal">
                  <SegmentedControl
                    name={fieldId("t2")}
                    ariaLabel={`Myoma #${index + 1} T2 signal`}
                    value={value.t2Signal}
                    options={toSegmentedOptions(MYOMA_T2_SIGNALS)}
                    onChange={(opt) => onChange({ ...value, t2Signal: opt })}
                  />
                </FieldRow>

                <FieldRow
                  label="Enhancement"
                  hint={
                    purpose === "Uterine artery embolization"
                      ? "UAE 의뢰 시 필수"
                      : undefined
                  }
                >
                  <SegmentedControl
                    name={fieldId("enhancement")}
                    ariaLabel={`Myoma #${index + 1} enhancement`}
                    value={value.enhancement}
                    options={toSegmentedOptions(MYOMA_ENHANCEMENTS)}
                    onChange={(opt) =>
                      onChange({ ...value, enhancement: opt })
                    }
                  />
                </FieldRow>

                <CheckboxGroup
                  id={fieldId("degeneration")}
                  legend="Degeneration"
                  hint="변성 (복수 선택)"
                  options={MYOMA_DEGENERATIONS}
                  selected={value.degeneration}
                  onChange={(next) =>
                    onChange({
                      ...value,
                      degeneration: next.length > 0 ? next : undefined,
                    })
                  }
                  className="md:col-span-2"
                />

                <FieldRow label="Diffusion">
                  <SegmentedControl
                    name={fieldId("diffusion")}
                    ariaLabel={`Myoma #${index + 1} diffusion`}
                    value={value.diffusion}
                    options={toSegmentedOptions(MYOMA_DIFFUSION)}
                    onChange={(opt) => {
                      onChange({
                        ...value,
                        diffusion: opt,
                        // ADC is asked to substantiate a restriction call;
                        // clearing it on "No restriction" avoids shipping a
                        // stale red-flag value.
                        adcValue:
                          opt === "Restricted" ? value.adcValue : undefined,
                      });
                    }}
                  />
                </FieldRow>

                {value.diffusion === "Restricted" && (
                  <NumberField
                    id={fieldId("adc")}
                    label="ADC value"
                    value={value.adcValue}
                    onChange={(v) => onChange({ ...value, adcValue: v })}
                    unit="×10⁻³ mm²/s"
                    optional
                  />
                )}

                <FieldRow label="Margin">
                  <SegmentedControl
                    name={fieldId("margin")}
                    ariaLabel={`Myoma #${index + 1} margin`}
                    value={value.margin}
                    options={toSegmentedOptions(MYOMA_MARGINS)}
                    onChange={(opt) => onChange({ ...value, margin: opt })}
                  />
                </FieldRow>

                <fieldset className="rounded-lg border border-border p-3 flex flex-col gap-2">
                  <legend className="px-1 text-[0.9375rem] font-bold tracking-tight text-foreground">
                    Atypical features
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      육종 red flag 집계 항목
                    </span>
                  </legend>
                  <label className="flex items-center gap-2 cursor-pointer text-sm">
                    <input
                      type="checkbox"
                      checked={value.centralNecrosis === true}
                      onChange={(e) =>
                        onChange({
                          ...value,
                          centralNecrosis: e.target.checked
                            ? true
                            : undefined,
                        })
                      }
                      className="h-4 w-4 text-primary"
                    />
                    <span>Central non-enhancing area (necrosis)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-sm">
                    <input
                      type="checkbox"
                      checked={value.intratumoralHemorrhage === true}
                      onChange={(e) =>
                        onChange({
                          ...value,
                          intratumoralHemorrhage: e.target.checked
                            ? true
                            : undefined,
                        })
                      }
                      className="h-4 w-4 text-primary"
                    />
                    <span>Intratumoral hemorrhage</span>
                  </label>
                </fieldset>
              </div>
            )}
          </fieldset>

          {/* 7. HIFU/MRgFUS: T2 reference -> Funaki type */}
          {purpose === "HIFU/MRgFUS" && (
            <FieldRow
              label="T2 relative to reference"
              hint={
                isIndex
                  ? "HIFU 의뢰 시 index 병변 필수 — Funaki type 산출"
                  : "Funaki type 산출"
              }
              className="md:col-span-2"
            >
              <RadioCardGroup
                name={fieldId("t2ref")}
                ariaLabel={`Myoma #${index + 1} T2 relative to reference`}
                value={value.t2Reference}
                options={MYOMA_T2_REFERENCE_RADIO_OPTIONS}
                onChange={(opt) => onChange({ ...value, t2Reference: opt })}
                columns={3}
              />
              {value.t2Reference !== undefined && (
                <p className="text-sm font-semibold text-foreground">
                  Funaki type: {deriveFunakiType(value.t2Reference)}
                </p>
              )}
            </FieldRow>
          )}

          {/* 8. Free-text note */}
          <div className="md:col-span-2 rounded-lg border border-border p-3 flex flex-col gap-2">
            <label
              htmlFor={fieldId("note")}
              className="text-[0.9375rem] font-bold tracking-tight text-foreground"
            >
              Note
              <span className="ml-1 text-xs font-normal text-muted-foreground">
                (optional)
              </span>
            </label>
            <input
              id={fieldId("note")}
              type="text"
              value={value.note ?? ""}
              onChange={(e) =>
                onChange({ ...value, note: e.target.value || undefined })
              }
              placeholder="이 병변에 대한 추가 메모"
              className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
