"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  RCC_SIDES,
  RCC_MASS_TYPES,
  RCC_PRESENT_ABSENT_INDET,
  RCC_AXIAL,
  RCC_CRANIO,
  RCC_MARGINS,
  RCC_EXOPHYTIC,
  RCC_THROMBUS_KINDS,
  RCC_NEVES_MAYO,
  RCC_PRESENT_ABSENT,
  type RccNevesMayo,
} from "@/lib/prompts/disease-templates/rcc-fields";

// ---------------------------------------------------------------------------
// File-local constants
// ---------------------------------------------------------------------------

/**
 * Short human-readable description for each Neves-Mayo level.
 * Source: Neves & Zincke (Mayo Clinic) classification of IVC tumor thrombus
 * extent in renal cell carcinoma.
 */
const NEVES_MAYO_DESCRIPTIONS: Record<RccNevesMayo, string> = {
  "0": "Renal vein only",
  I: "IVC, ≤2 cm above renal vein",
  II: "IVC, infrahepatic (>2 cm)",
  III: "IVC, retro-/intrahepatic",
  IV: "Supradiaphragmatic / right atrium",
};
import type { RccMass } from "@/lib/prompts/disease-templates/rcc-serializer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import {
  SegmentedControl,
  toSegmentedOptions,
} from "@/components/ui/segmented-control";
import { RadioCardGroup } from "@/components/ui/radio-card-group";
import {
  RCC_BOSNIAK_RADIO_OPTIONS,
  RCC_TRAJECTORY_RADIO_OPTIONS,
} from "@/lib/ui/rcc-options-meta";

// ---------------------------------------------------------------------------
// File-local field-row helper
// ---------------------------------------------------------------------------

/**
 * FieldRow — uniform vertical wrapper that renders a label above any control
 * (SegmentedControl, RadioCardGroup, or arbitrary children). Replaces the
 * legacy fieldset/legend wrapper from the previous local RadioGroup helper so
 * the new SegmentedControl/RadioCardGroup keep the same visual rhythm with
 * NumberField / DateInput inside the same grid cell.
 */
function FieldRow({
  label,
  children,
  className,
}: {
  label: string;
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
      <span className="px-1 text-sm font-medium text-foreground">{label}</span>
      {children}
    </div>
  );
}

interface NumberFieldProps {
  id: string;
  label: string;
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  unit?: string;
  optional?: boolean;
}

function NumberField({
  id,
  label,
  value,
  onChange,
  unit,
  optional = false,
}: NumberFieldProps) {
  return (
    <div className="rounded-lg border border-border p-3 flex flex-col gap-2">
      <label
        htmlFor={id}
        className="text-sm font-medium text-foreground"
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
          step="0.1"
          min="0"
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

interface DateInputProps {
  id: string;
  label: string;
  value: string | undefined;
  onChange: (v: string | undefined) => void;
  optional?: boolean;
}

function DateInput({
  id,
  label,
  value,
  onChange,
  optional = false,
}: DateInputProps) {
  return (
    <div className="rounded-lg border border-border p-3 flex flex-col gap-2">
      <label
        htmlFor={id}
        className="text-sm font-medium text-foreground"
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
// Public component
// ---------------------------------------------------------------------------

interface RccMassCardProps {
  value: RccMass;
  onChange: (next: RccMass) => void;
  onRemove?: () => void;
  index: number;
  removable: boolean;
}

export function RccMassCard({
  value,
  onChange,
  onRemove,
  index,
  removable,
}: RccMassCardProps) {
  const isCystic = value.massType === "Cystic";
  const showThrombusDetails =
    value.thrombusKind === "Renal vein" || value.thrombusKind === "IVC";

  // Per-card unique ids prevent radio-group name collisions across multiple cards.
  const fieldId = (suffix: string) => `mass-${index}-${suffix}`;

  return (
    <Card className="shadow-sm ring-1 ring-border/50">
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <CardTitle className="text-base font-semibold">
          Mass {index + 1}
        </CardTitle>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={!removable}
          onClick={onRemove}
          aria-label={`Remove Mass ${index + 1}`}
        >
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* 1. Side */}
          <FieldRow label="Side">
            <SegmentedControl
              name={fieldId("side")}
              ariaLabel="Side"
              value={value.side}
              options={toSegmentedOptions(RCC_SIDES)}
              onChange={(opt) => onChange({ ...value, side: opt })}
            />
          </FieldRow>

          {/* 2. Mass size */}
          <NumberField
            id={fieldId("massSizeCm")}
            label="Mass size"
            value={value.massSizeCm}
            onChange={(v) => onChange({ ...value, massSizeCm: v })}
            unit="cm"
          />

          {/* 2a. Size comparison — prior size (cm) */}
          <NumberField
            id={fieldId("priorMassSizeCm")}
            label="Prior size"
            value={value.priorMassSizeCm}
            onChange={(v) => onChange({ ...value, priorMassSizeCm: v })}
            unit="cm"
            optional
          />

          {/* 2b. Size comparison — prior study date */}
          <DateInput
            id={fieldId("priorStudyDate")}
            label="Prior study date"
            value={value.priorStudyDate}
            onChange={(v) => onChange({ ...value, priorStudyDate: v })}
            optional
          />

          {/* 2c. Size comparison — trajectory */}
          <FieldRow label="Trajectory">
            <RadioCardGroup
              name={fieldId("trajectory")}
              ariaLabel="Trajectory"
              value={value.trajectory}
              options={RCC_TRAJECTORY_RADIO_OPTIONS}
              onChange={(opt) => onChange({ ...value, trajectory: opt })}
              columns={2}
            />
          </FieldRow>

          {/* 3. Growth rate */}
          <NumberField
            id={fieldId("growthRate")}
            label="Growth rate"
            value={value.growthRate}
            onChange={(v) => onChange({ ...value, growthRate: v })}
            optional
          />

          {/* 4. Mass type */}
          <FieldRow label="Mass type">
            <SegmentedControl
              name={fieldId("massType")}
              ariaLabel="Mass type"
              value={value.massType}
              options={toSegmentedOptions(RCC_MASS_TYPES)}
              onChange={(opt) => {
                // Cystic → Solid transition: auto-clear cysticPredominant so a
                // later switch back to Cystic starts fresh (standard alignment
                // with Bosniak v2019 binary classification).
                if (opt === "Solid" && value.massType === "Cystic") {
                  onChange({
                    ...value,
                    massType: opt,
                    cysticPredominant: undefined,
                  });
                } else {
                  onChange({ ...value, massType: opt });
                }
              }}
            />
          </FieldRow>

          {/* 5. Bosniak — only rendered when mass type is not Solid (Bosniak v2019
              applies exclusively to cystic masses; for Solid, the field is omitted
              from the UI and from the serialized prompt to avoid noise). */}
          {isCystic && (
            <FieldRow label="Bosniak">
              <RadioCardGroup
                name={fieldId("bosniak")}
                ariaLabel="Bosniak"
                value={value.bosniak}
                options={RCC_BOSNIAK_RADIO_OPTIONS}
                onChange={(opt) => onChange({ ...value, bosniak: opt })}
                columns={3}
              />
            </FieldRow>
          )}

          {/* 5a. Predominantly cystic — only rendered when mass type is not Solid.
              Same rationale as Bosniak: a "predominantly cystic" indicator is
              meaningless for a Solid mass. */}
          {isCystic && (
            <fieldset className="rounded-lg border border-border p-3 flex flex-col gap-2">
              <legend
                id={`${fieldId("cysticPredominant")}-legend`}
                className="px-1 text-sm font-medium text-foreground"
              >
                Predominantly cystic
              </legend>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  id={fieldId("cysticPredominant")}
                  type="checkbox"
                  checked={value.cysticPredominant === true}
                  onChange={(e) =>
                    onChange({
                      ...value,
                      cysticPredominant: e.target.checked ? true : false,
                    })
                  }
                  className="h-4 w-4 text-primary"
                  aria-labelledby={`${fieldId("cysticPredominant")}-legend`}
                />
                <span className="text-sm">Yes</span>
              </label>
            </fieldset>
          )}

          {/* 6. Macroscopic fat */}
          <FieldRow label="Macroscopic fat">
            <SegmentedControl
              name={fieldId("macroFat")}
              ariaLabel="Macroscopic fat"
              value={value.macroFat}
              options={toSegmentedOptions(RCC_PRESENT_ABSENT_INDET)}
              onChange={(opt) => onChange({ ...value, macroFat: opt })}
            />
          </FieldRow>

          {/* 7. Solid enhancement */}
          <FieldRow label="Solid enhancement">
            <SegmentedControl
              name={fieldId("solidEnhancement")}
              ariaLabel="Solid enhancement"
              value={value.solidEnhancement}
              options={toSegmentedOptions(RCC_PRESENT_ABSENT_INDET)}
              onChange={(opt) => onChange({ ...value, solidEnhancement: opt })}
            />
          </FieldRow>

          {/* 8. Axial location */}
          <FieldRow label="Axial location">
            <SegmentedControl
              name={fieldId("axial")}
              ariaLabel="Axial location"
              value={value.axial}
              options={toSegmentedOptions(RCC_AXIAL)}
              onChange={(opt) => onChange({ ...value, axial: opt })}
            />
          </FieldRow>

          {/* 9. Cranio-caudal location */}
          <FieldRow label="Cranio-caudal location">
            <SegmentedControl
              name={fieldId("cranio")}
              ariaLabel="Cranio-caudal location"
              value={value.cranio}
              options={toSegmentedOptions(RCC_CRANIO)}
              onChange={(opt) => onChange({ ...value, cranio: opt })}
            />
          </FieldRow>

          {/* 10. Margins */}
          <FieldRow label="Margins">
            <SegmentedControl
              name={fieldId("margins")}
              ariaLabel="Margins"
              value={value.margins}
              options={toSegmentedOptions(RCC_MARGINS)}
              onChange={(opt) => onChange({ ...value, margins: opt })}
            />
          </FieldRow>

          {/* 11. Exophytic ratio */}
          <FieldRow label="Exophytic ratio">
            <SegmentedControl
              name={fieldId("exophytic")}
              ariaLabel="Exophytic ratio"
              value={value.exophytic}
              options={toSegmentedOptions(RCC_EXOPHYTIC)}
              onChange={(opt) => onChange({ ...value, exophytic: opt })}
            />
          </FieldRow>

          {/* 12. Distance to collecting system */}
          <NumberField
            id={fieldId("distanceCm")}
            label="Distance to collecting system"
            value={value.distanceCm}
            onChange={(v) => onChange({ ...value, distanceCm: v })}
            unit="cm"
          />

          {/* 13. Venous tumor thrombus kind */}
          <FieldRow label="Venous tumor thrombus kind">
            <SegmentedControl
              name={fieldId("thrombusKind")}
              ariaLabel="Venous tumor thrombus kind"
              value={value.thrombusKind}
              options={toSegmentedOptions(RCC_THROMBUS_KINDS)}
              onChange={(opt) => {
                if (opt === "None") {
                  // Clear all thrombus detail fields when set to None
                  onChange({
                    ...value,
                    thrombusKind: opt,
                    thrombusLevel: undefined,
                    blandThrombus: undefined,
                  });
                } else if (opt === "Renal vein") {
                  // Renal vein thrombus is by definition Neves-Mayo Level 0.
                  // Auto-set the level so the data model stays consistent.
                  onChange({
                    ...value,
                    thrombusKind: opt,
                    thrombusLevel: "0",
                  });
                } else {
                  // IVC: clear a stale Level 0 (only valid for renal vein) so
                  // the user is forced to pick an IVC-extent level (I–IV).
                  onChange({
                    ...value,
                    thrombusKind: opt,
                    thrombusLevel:
                      value.thrombusLevel === "0"
                        ? undefined
                        : value.thrombusLevel,
                  });
                }
              }}
            />
          </FieldRow>

          {/* 14. Neves-Mayo Level — Renal vein: auto Level 0 (info only).
                                     IVC: user-selected I–IV. */}
          {value.thrombusKind === "Renal vein" && (
            <div className="rounded-lg border border-border p-3 flex flex-col gap-1">
              <span className="text-sm font-medium text-foreground">
                Neves-Mayo Level
              </span>
              <p className="text-sm text-card-foreground">
                Level 0 — Renal vein only
              </p>
              <p className="text-xs text-muted-foreground">
                Automatically set; renal vein thrombus is Level 0 by definition.
              </p>
            </div>
          )}
          {value.thrombusKind === "IVC" && (
            <div className="rounded-lg border border-border p-3 flex flex-col gap-2">
              <Select
                id={fieldId("thrombusLevel")}
                label="Neves-Mayo Level"
                value={value.thrombusLevel ?? ""}
                onChange={(e) => {
                  const v = e.target.value as RccMass["thrombusLevel"];
                  onChange({ ...value, thrombusLevel: v || undefined });
                }}
              >
                <option value="">— select level —</option>
                {RCC_NEVES_MAYO.filter((lvl) => lvl !== "0").map((lvl) => (
                  <option key={lvl} value={lvl}>
                    Level {lvl} — {NEVES_MAYO_DESCRIPTIONS[lvl]}
                  </option>
                ))}
              </Select>
              <p className="text-xs text-muted-foreground">
                Mayo classification of IVC tumor thrombus extent
              </p>
            </div>
          )}

          {/* 15. Bland (non-tumor) thrombus — conditional on thrombusKind */}
          {showThrombusDetails && (
            <FieldRow label="Bland (non-tumor) thrombus">
              <SegmentedControl
                name={fieldId("blandThrombus")}
                ariaLabel="Bland (non-tumor) thrombus"
                value={value.blandThrombus}
                options={toSegmentedOptions(RCC_PRESENT_ABSENT)}
                onChange={(opt) => onChange({ ...value, blandThrombus: opt })}
              />
            </FieldRow>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
