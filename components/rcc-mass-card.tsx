"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  RCC_SIDES,
  RCC_MASS_TYPES,
  RCC_BOSNIAK,
  RCC_PRESENT_ABSENT_INDET,
  RCC_AXIAL,
  RCC_CRANIO,
  RCC_MARGINS,
  RCC_EXOPHYTIC,
  RCC_THROMBUS_KINDS,
  RCC_NEVES_MAYO,
  RCC_PRESENT_ABSENT,
  RCC_TRAJECTORY,
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

// ---------------------------------------------------------------------------
// Internal sub-components (file-local)
// ---------------------------------------------------------------------------

interface RadioGroupProps<T extends string> {
  id: string;
  legend: string;
  options: readonly T[];
  selected: T | undefined;
  onSelect: (opt: T) => void;
  disabled?: boolean;
  disabledNote?: string;
}

function RadioGroup<T extends string>({
  id,
  legend,
  options,
  selected,
  onSelect,
  disabled = false,
  disabledNote,
}: RadioGroupProps<T>) {
  return (
    <fieldset
      role="radiogroup"
      aria-labelledby={`${id}-legend`}
      aria-disabled={disabled ? "true" : undefined}
      className={cn(
        "rounded-lg border border-border p-3 flex flex-col gap-2",
        disabled && "opacity-50"
      )}
    >
      <legend
        id={`${id}-legend`}
        className="px-1 text-sm font-medium text-foreground"
      >
        {legend}
      </legend>

      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        {options.map((opt) => (
          <label
            key={opt}
            className={cn(
              "flex items-center gap-2",
              disabled ? "cursor-not-allowed" : "cursor-pointer"
            )}
          >
            <input
              type="radio"
              name={id}
              value={opt}
              checked={selected === opt}
              onChange={() => onSelect(opt)}
              disabled={disabled}
              className="h-4 w-4 text-primary"
            />
            <span className="text-sm">{opt}</span>
          </label>
        ))}
      </div>

      {disabled && disabledNote && (
        <p className="text-xs text-muted-foreground">{disabledNote}</p>
      )}
    </fieldset>
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
  const isSolid = value.massType === "Solid";
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
          <RadioGroup
            id={fieldId("side")}
            legend="Side"
            options={RCC_SIDES}
            selected={value.side}
            onSelect={(opt) => onChange({ ...value, side: opt })}
          />

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
          <RadioGroup
            id={fieldId("trajectory")}
            legend="Trajectory"
            options={RCC_TRAJECTORY}
            selected={value.trajectory}
            onSelect={(opt) => onChange({ ...value, trajectory: opt })}
          />

          {/* 3. Growth rate */}
          <NumberField
            id={fieldId("growthRate")}
            label="Growth rate"
            value={value.growthRate}
            onChange={(v) => onChange({ ...value, growthRate: v })}
            optional
          />

          {/* 4. Mass type */}
          <RadioGroup
            id={fieldId("massType")}
            legend="Mass type"
            options={RCC_MASS_TYPES}
            selected={value.massType}
            onSelect={(opt) => {
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

          {/* 5. Bosniak — disabled when mass type is Solid */}
          <RadioGroup
            id={fieldId("bosniak")}
            legend="Bosniak"
            options={RCC_BOSNIAK}
            selected={value.bosniak}
            onSelect={(opt) => onChange({ ...value, bosniak: opt })}
            disabled={isSolid}
            disabledNote="Not applicable (solid mass)"
          />

          {/* 5a. Predominantly cystic — disabled when mass type is Solid */}
          <fieldset
            aria-disabled={isSolid ? "true" : undefined}
            className={cn(
              "rounded-lg border border-border p-3 flex flex-col gap-2",
              isSolid && "opacity-50"
            )}
          >
            <legend
              id={`${fieldId("cysticPredominant")}-legend`}
              className="px-1 text-sm font-medium text-foreground"
            >
              Predominantly cystic
            </legend>

            <label
              className={cn(
                "flex items-center gap-2",
                isSolid ? "cursor-not-allowed" : "cursor-pointer"
              )}
            >
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
                disabled={isSolid}
                className="h-4 w-4 text-primary"
                aria-labelledby={`${fieldId("cysticPredominant")}-legend`}
              />
              <span className="text-sm">Yes</span>
            </label>

            {isSolid && (
              <p className="text-xs text-muted-foreground">
                Not applicable (solid mass)
              </p>
            )}
          </fieldset>

          {/* 6. Macroscopic fat */}
          <RadioGroup
            id={fieldId("macroFat")}
            legend="Macroscopic fat"
            options={RCC_PRESENT_ABSENT_INDET}
            selected={value.macroFat}
            onSelect={(opt) => onChange({ ...value, macroFat: opt })}
          />

          {/* 7. Solid enhancement */}
          <RadioGroup
            id={fieldId("solidEnhancement")}
            legend="Solid enhancement"
            options={RCC_PRESENT_ABSENT_INDET}
            selected={value.solidEnhancement}
            onSelect={(opt) => onChange({ ...value, solidEnhancement: opt })}
          />

          {/* 8. Axial location */}
          <RadioGroup
            id={fieldId("axial")}
            legend="Axial location"
            options={RCC_AXIAL}
            selected={value.axial}
            onSelect={(opt) => onChange({ ...value, axial: opt })}
          />

          {/* 9. Cranio-caudal location */}
          <RadioGroup
            id={fieldId("cranio")}
            legend="Cranio-caudal location"
            options={RCC_CRANIO}
            selected={value.cranio}
            onSelect={(opt) => onChange({ ...value, cranio: opt })}
          />

          {/* 10. Margins */}
          <RadioGroup
            id={fieldId("margins")}
            legend="Margins"
            options={RCC_MARGINS}
            selected={value.margins}
            onSelect={(opt) => onChange({ ...value, margins: opt })}
          />

          {/* 11. Exophytic ratio */}
          <RadioGroup
            id={fieldId("exophytic")}
            legend="Exophytic ratio"
            options={RCC_EXOPHYTIC}
            selected={value.exophytic}
            onSelect={(opt) => onChange({ ...value, exophytic: opt })}
          />

          {/* 12. Distance to collecting system */}
          <NumberField
            id={fieldId("distanceCm")}
            label="Distance to collecting system"
            value={value.distanceCm}
            onChange={(v) => onChange({ ...value, distanceCm: v })}
            unit="cm"
          />

          {/* 13. Venous tumor thrombus kind */}
          <RadioGroup
            id={fieldId("thrombusKind")}
            legend="Venous tumor thrombus kind"
            options={RCC_THROMBUS_KINDS}
            selected={value.thrombusKind}
            onSelect={(opt) => {
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
            <RadioGroup
              id={fieldId("blandThrombus")}
              legend="Bland (non-tumor) thrombus"
              options={RCC_PRESENT_ABSENT}
              selected={value.blandThrombus}
              onSelect={(opt) => onChange({ ...value, blandThrombus: opt })}
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
