"use client";

import * as React from "react";
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
} from "@/lib/prompts/disease-templates/rcc-fields";
import type { RccStructuredInput } from "@/lib/prompts/disease-templates/rcc-serializer";
import { Select } from "@/components/ui/select";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface RccStructuredFormProps {
  value: RccStructuredInput;
  onChange: (next: RccStructuredInput) => void;
  error?: string;
}

// ---------------------------------------------------------------------------
// Internal sub-components
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

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function RccStructuredForm({
  value,
  onChange,
  error,
}: RccStructuredFormProps) {
  const isSolid = value.massType === "Solid";
  const showThrombusDetails =
    value.thrombusKind === "Renal vein" || value.thrombusKind === "IVC";

  return (
    <div className="flex flex-col gap-6">
      {error && (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 1. Side */}
        <RadioGroup
          id="side"
          legend="Side"
          options={RCC_SIDES}
          selected={value.side}
          onSelect={(opt) => onChange({ ...value, side: opt })}
        />

        {/* 2. Mass size */}
        <NumberField
          id="massSizeCm"
          label="Mass size"
          value={value.massSizeCm}
          onChange={(v) => onChange({ ...value, massSizeCm: v })}
          unit="cm"
        />

        {/* 3. Growth rate */}
        <NumberField
          id="growthRate"
          label="Growth rate"
          value={value.growthRate}
          onChange={(v) => onChange({ ...value, growthRate: v })}
          optional
        />

        {/* 4. Mass type */}
        <RadioGroup
          id="massType"
          legend="Mass type"
          options={RCC_MASS_TYPES}
          selected={value.massType}
          onSelect={(opt) => onChange({ ...value, massType: opt })}
        />

        {/* 5. Bosniak — disabled when mass type is Solid */}
        <RadioGroup
          id="bosniak"
          legend="Bosniak"
          options={RCC_BOSNIAK}
          selected={value.bosniak}
          onSelect={(opt) => onChange({ ...value, bosniak: opt })}
          disabled={isSolid}
          disabledNote="Not applicable (solid mass)"
        />

        {/* 6. Macroscopic fat */}
        <RadioGroup
          id="macroFat"
          legend="Macroscopic fat"
          options={RCC_PRESENT_ABSENT_INDET}
          selected={value.macroFat}
          onSelect={(opt) => onChange({ ...value, macroFat: opt })}
        />

        {/* 7. Solid enhancement */}
        <RadioGroup
          id="solidEnhancement"
          legend="Solid enhancement"
          options={RCC_PRESENT_ABSENT_INDET}
          selected={value.solidEnhancement}
          onSelect={(opt) => onChange({ ...value, solidEnhancement: opt })}
        />

        {/* 8. Axial location */}
        <RadioGroup
          id="axial"
          legend="Axial location"
          options={RCC_AXIAL}
          selected={value.axial}
          onSelect={(opt) => onChange({ ...value, axial: opt })}
        />

        {/* 9. Cranio-caudal location */}
        <RadioGroup
          id="cranio"
          legend="Cranio-caudal location"
          options={RCC_CRANIO}
          selected={value.cranio}
          onSelect={(opt) => onChange({ ...value, cranio: opt })}
        />

        {/* 10. Margins */}
        <RadioGroup
          id="margins"
          legend="Margins"
          options={RCC_MARGINS}
          selected={value.margins}
          onSelect={(opt) => onChange({ ...value, margins: opt })}
        />

        {/* 11. Exophytic ratio */}
        <RadioGroup
          id="exophytic"
          legend="Exophytic ratio"
          options={RCC_EXOPHYTIC}
          selected={value.exophytic}
          onSelect={(opt) => onChange({ ...value, exophytic: opt })}
        />

        {/* 12. Distance to collecting system */}
        <NumberField
          id="distanceCm"
          label="Distance to collecting system"
          value={value.distanceCm}
          onChange={(v) => onChange({ ...value, distanceCm: v })}
          unit="cm"
        />

        {/* 13. Venous tumor thrombus kind */}
        <RadioGroup
          id="thrombusKind"
          legend="Venous tumor thrombus kind"
          options={RCC_THROMBUS_KINDS}
          selected={value.thrombusKind}
          onSelect={(opt) => {
            // Clear thrombus detail fields when set to None
            if (opt === "None") {
              onChange({
                ...value,
                thrombusKind: opt,
                thrombusLevel: undefined,
                blandThrombus: undefined,
              });
            } else {
              onChange({ ...value, thrombusKind: opt });
            }
          }}
        />

        {/* 14. Neves-Mayo Level — conditional on thrombusKind */}
        {showThrombusDetails && (
          <div className="rounded-lg border border-border p-3 flex flex-col gap-2">
            <Select
              id="thrombusLevel"
              label="Neves-Mayo Level"
              value={value.thrombusLevel ?? ""}
              onChange={(e) => {
                const v = e.target.value as RccStructuredInput["thrombusLevel"];
                onChange({ ...value, thrombusLevel: v || undefined });
              }}
            >
              <option value="">— select level —</option>
              {RCC_NEVES_MAYO.map((lvl) => (
                <option key={lvl} value={lvl}>
                  {lvl}
                </option>
              ))}
            </Select>
          </div>
        )}

        {/* 15. Bland (non-tumor) thrombus — conditional on thrombusKind */}
        {showThrombusDetails && (
          <RadioGroup
            id="blandThrombus"
            legend="Bland (non-tumor) thrombus"
            options={RCC_PRESENT_ABSENT}
            selected={value.blandThrombus}
            onSelect={(opt) => onChange({ ...value, blandThrombus: opt })}
          />
        )}
      </div>
    </div>
  );
}
