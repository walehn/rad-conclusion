"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  RCC_LN_M,
  RCC_LN_SITES,
  RCC_MET_SITES,
  type RccLnM,
  type RccLnSite,
  type RccMetSite,
} from "@/lib/prompts/disease-templates/rcc-fields";
import type { RccStructuredInput } from "@/lib/prompts/disease-templates/rcc-serializer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  SegmentedControl,
  toSegmentedOptions,
} from "@/components/ui/segmented-control";

// ---------------------------------------------------------------------------
// Internal sub-components (file-local)
// ---------------------------------------------------------------------------

/**
 * FieldRow — uniform vertical wrapper that renders a label above any control.
 * Mirrors the same helper in rcc-mass-card.tsx so the two cards keep visual
 * rhythm.
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

interface CheckboxGroupProps<T extends string> {
  id: string;
  legend: string;
  options: readonly T[];
  selected: readonly T[] | undefined;
  onChange: (next: T[]) => void;
  className?: string;
}

/**
 * CheckboxGroup<T> — multi-select chip toggle group.
 * Mirrors the legacy radio chip style but uses <input type="checkbox"> with an
 * array toggle handler. Multi-select semantics intentionally remain outside
 * SPEC-UI-001 scope.
 */
function CheckboxGroup<T extends string>({
  id,
  legend,
  options,
  selected,
  onChange,
  className,
}: CheckboxGroupProps<T>) {
  const current = selected ?? [];
  const toggle = (opt: T) => {
    if (current.includes(opt)) {
      onChange(current.filter((v) => v !== opt));
    } else {
      onChange([...current, opt]);
    }
  };

  return (
    <fieldset
      aria-labelledby={`${id}-legend`}
      className={cn(
        "rounded-lg border border-border p-3 flex flex-col gap-2",
        className
      )}
    >
      <legend
        id={`${id}-legend`}
        className="px-1 text-sm font-medium text-foreground"
      >
        {legend}
      </legend>

      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        {options.map((opt) => {
          const checked = current.includes(opt);
          return (
            <label
              key={opt}
              className={cn(
                "flex items-center gap-2 cursor-pointer rounded-md px-2 py-0.5 text-sm",
                checked && "bg-primary/10"
              )}
            >
              <input
                type="checkbox"
                name={id}
                value={opt}
                checked={checked}
                onChange={() => toggle(opt)}
                className="h-4 w-4 text-primary"
              />
              <span>{opt}</span>
            </label>
          );
        })}
      </div>
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
// Public component
// ---------------------------------------------------------------------------

interface RccStudyLevelCardProps {
  value: RccStructuredInput;
  onChange: (next: RccStructuredInput) => void;
}

export function RccStudyLevelCard({ value, onChange }: RccStudyLevelCardProps) {
  const showLnDetails = value.lymphNodes === "Present";
  const showMetDetails = value.distantMetastases === "Present";

  // Lymph nodes radio handler — clear sub-fields when leaving "Present"
  // (replicates the thrombusKind === "None" clear pattern in rcc-mass-card.tsx)
  const handleLnChange = (opt: RccLnM) => {
    if (opt === "Present") {
      onChange({ ...value, lymphNodes: opt });
    } else {
      onChange({
        ...value,
        lymphNodes: opt,
        lymphNodeSites: undefined,
        lymphNodeShortAxisCm: undefined,
      });
    }
  };

  // Distant metastases radio handler — clear sub-fields when leaving "Present"
  const handleMetChange = (opt: RccLnM) => {
    if (opt === "Present") {
      onChange({ ...value, distantMetastases: opt });
    } else {
      onChange({
        ...value,
        distantMetastases: opt,
        metastasisSites: undefined,
      });
    }
  };

  return (
    <Card className="shadow-sm ring-1 ring-border/50">
      <CardHeader className="pb-4">
        <CardTitle className="text-base font-semibold">
          Lymph nodes &amp; Distant metastases
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* SPEC-UI-001 desktop layout revision: 2-column grid on md+ with
            multi-select CheckboxGroups spanning both columns so all chip
            options sit on a single readable row instead of being squeezed. */}
        <div className="grid gap-x-6 gap-y-5 md:grid-cols-2">
          {/* Regional lymph nodes */}
          <FieldRow label="Regional lymph nodes">
            <SegmentedControl
              name="study-lymphNodes"
              ariaLabel="Regional lymph nodes"
              value={value.lymphNodes}
              options={toSegmentedOptions(RCC_LN_M)}
              onChange={handleLnChange}
            />
          </FieldRow>

          {/* LN largest short axis — conditional on Present.
              Placed adjacent to the LN selector on desktop so the size input
              stays in the same visual row as its parent control. */}
          {showLnDetails && (
            <NumberField
              id="study-lymphNodeShortAxisCm"
              label="Largest short axis"
              value={value.lymphNodeShortAxisCm}
              onChange={(v) =>
                onChange({ ...value, lymphNodeShortAxisCm: v })
              }
              unit="cm"
              optional
            />
          )}

          {/* LN site multiselect — conditional on Present.
              Spans both columns so the chip set is not crushed into a single
              column on desktop. */}
          {showLnDetails && (
            <CheckboxGroup<RccLnSite>
              id="study-lymphNodeSites"
              legend="Lymph node sites"
              options={RCC_LN_SITES}
              selected={value.lymphNodeSites}
              onChange={(next) =>
                onChange({ ...value, lymphNodeSites: next })
              }
              className="md:col-span-2"
            />
          )}

          {/* Distant metastases */}
          <FieldRow label="Distant metastases">
            <SegmentedControl
              name="study-distantMetastases"
              ariaLabel="Distant metastases"
              value={value.distantMetastases}
              options={toSegmentedOptions(RCC_LN_M)}
              onChange={handleMetChange}
            />
          </FieldRow>

          {/* Metastasis site multiselect — conditional on Present.
              Same col-span rationale as LN site multiselect. */}
          {showMetDetails && (
            <CheckboxGroup<RccMetSite>
              id="study-metastasisSites"
              legend="Metastasis sites"
              options={RCC_MET_SITES}
              selected={value.metastasisSites}
              onChange={(next) =>
                onChange({ ...value, metastasisSites: next })
              }
              className="md:col-span-2"
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
