"use client";

/**
 * Shared field primitives for the uterine myoma structured form.
 *
 * The RCC cards duplicate FieldRow / NumberField / DateInput per file; the
 * myoma form has six cards sharing the same primitives, so they live here
 * once instead. Markup and classes mirror the RCC versions exactly to keep
 * the two forms visually identical.
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  SegmentedControl,
} from "@/components/ui/segmented-control";

/** Uniform vertical wrapper rendering a bold label above any control. */
export function FieldRow({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  /** Small muted suffix after the label (e.g. Korean gloss, "(optional)"). */
  hint?: string;
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
        {hint && (
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            {hint}
          </span>
        )}
      </span>
      {children}
    </div>
  );
}

export function NumberField({
  id,
  label,
  value,
  onChange,
  unit,
  optional = false,
  hint,
  className,
}: {
  id: string;
  label: string;
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  unit?: string;
  optional?: boolean;
  hint?: string;
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
        {hint && (
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            {hint}
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

export function DateInput({
  id,
  label,
  value,
  onChange,
  optional = false,
  className,
}: {
  id: string;
  label: string;
  value: string | undefined;
  onChange: (v: string | undefined) => void;
  optional?: boolean;
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

/** Multi-select chip toggle group (mirrors the RCC study-level card). */
export function CheckboxGroup<T extends string>({
  id,
  legend,
  hint,
  options,
  selected,
  onChange,
  className,
}: {
  id: string;
  legend: string;
  hint?: string;
  options: readonly T[];
  selected: readonly T[] | undefined;
  onChange: (next: T[]) => void;
  className?: string;
}) {
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
        className="px-1 text-[0.9375rem] font-bold tracking-tight text-foreground"
      >
        {legend}
        {hint && (
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            {hint}
          </span>
        )}
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

/**
 * Yes/No segmented control bound to a boolean.
 *
 * `undefined` renders with neither option active - "not answered" is a real
 * state the serializer distinguishes from "No", so there is no default.
 */
export function YesNoControl({
  name,
  ariaLabel,
  value,
  onChange,
}: {
  name: string;
  ariaLabel: string;
  value: boolean | undefined;
  onChange: (next: boolean) => void;
}) {
  return (
    <SegmentedControl
      name={name}
      ariaLabel={ariaLabel}
      value={value === undefined ? undefined : value ? "Yes" : "No"}
      options={[
        { value: "Yes", label: "Yes" },
        { value: "No", label: "No" },
      ]}
      onChange={(opt) => onChange(opt === "Yes")}
    />
  );
}
