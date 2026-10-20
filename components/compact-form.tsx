"use client";

/**
 * Compact form primitives for the structured-report inputs.
 *
 * One label-left row per field instead of a bordered box per field, so a
 * section reads like a worksheet and fits on one screen. Rows fall back to
 * label-above inside narrow containers. They use container queries rather
 * than viewport breakpoints because the form shares the page with the
 * output column, so the viewport says little about the room a row has.
 */

import * as React from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export const compactInputClass =
  "h-8 rounded-md border border-input bg-background px-2 text-sm tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60";

export const compactTextareaClass =
  "w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y";

export function RequiredMark() {
  return (
    <>
      <span aria-hidden="true" className="ml-0.5 font-bold text-destructive">
        *
      </span>
      <span className="sr-only"> (required)</span>
    </>
  );
}

// ---------------------------------------------------------------------------
// Section shell
// ---------------------------------------------------------------------------

export function FormSection({
  id,
  step,
  title,
  summary,
  actions,
  children,
}: {
  id: string;
  step: number;
  title: string;
  /** Short status text next to the title (e.g. "31.1 mL · PI-QUAL 3"). */
  summary?: React.ReactNode;
  /** Right-aligned header controls (toggles, add buttons). */
  actions?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      data-section-step={step}
      className="scroll-mt-32 rounded-lg border border-border bg-card shadow-sm"
    >
      <header className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 px-4 pt-3 pb-1.5">
        <span
          aria-hidden="true"
          className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground"
        >
          {step}
        </span>
        <h3
          id={`${id}-title`}
          className="text-[15px] font-semibold tracking-tight text-foreground"
        >
          {title}
        </h3>
        {summary && (
          <span className="text-xs text-muted-foreground">{summary}</span>
        )}
        {actions && (
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {actions}
          </div>
        )}
      </header>
      {children && <div className="@container px-4 pb-3">{children}</div>}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------------

const rowLabelClass = "text-[13px] font-medium text-foreground/75";

/**
 * Label-left field row. Pass `htmlFor` when the row holds a single native
 * input so the label names it; otherwise pass `labelId` and point the
 * control's aria-labelledby (or ariaLabel) at it.
 */
export function Row({
  label,
  required,
  htmlFor,
  labelId,
  align = "center",
  className,
  children,
}: {
  label: React.ReactNode;
  required?: boolean;
  htmlFor?: string;
  labelId?: string;
  align?: "center" | "start";
  className?: string;
  children: React.ReactNode;
}) {
  const labelContent = (
    <>
      {label}
      {required && <RequiredMark />}
    </>
  );
  return (
    <div
      className={cn(
        "grid gap-x-3 gap-y-1 py-1 @md:grid-cols-[6.5rem_minmax(0,1fr)]",
        align === "center" ? "@md:items-center" : "@md:items-start",
        className
      )}
    >
      {htmlFor ? (
        <label
          id={labelId}
          htmlFor={htmlFor}
          className={cn(rowLabelClass, align === "start" && "@md:pt-1.5")}
        >
          {labelContent}
        </label>
      ) : (
        <span
          id={labelId}
          className={cn(rowLabelClass, align === "start" && "@md:pt-1.5")}
        >
          {labelContent}
        </span>
      )}
      <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1.5">
        {children}
      </div>
    </div>
  );
}

/** A small caption + control pair, for several inputs sharing one row. */
export function InlineField({
  label,
  htmlFor,
  required,
  children,
}: {
  label: string;
  htmlFor?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  const caption = (
    <>
      {label}
      {required && <RequiredMark />}
    </>
  );
  return (
    <span className="inline-flex items-center gap-1.5">
      {/* A caption beside a radiogroup names nothing; the group carries its
          own aria-label, so only a native input gets a <label>. */}
      {htmlFor ? (
        <label htmlFor={htmlFor} className="text-xs text-muted-foreground">
          {caption}
        </label>
      ) : (
        <span aria-hidden="true" className="text-xs text-muted-foreground">
          {caption}
        </span>
      )}
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

export function NumberInput({
  id,
  value,
  onChange,
  unit,
  min,
  max,
  step = "1",
  widthClass = "w-20",
  ariaLabel,
  emptyWhenZero = false,
}: {
  id: string;
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  unit?: string;
  min?: string;
  max?: string;
  step?: string;
  widthClass?: string;
  ariaLabel?: string;
  /**
   * Show 0 as an empty box. For required numbers whose "not entered"
   * sentinel is 0 (PSA, lesion size), a printed 0 reads as a real value.
   */
  emptyWhenZero?: boolean;
}) {
  const shown = value === undefined || (emptyWhenZero && value === 0) ? "" : value;
  return (
    <span className="inline-flex items-center gap-1">
      <input
        id={id}
        type="number"
        inputMode="decimal"
        aria-label={ariaLabel}
        step={step}
        min={min}
        max={max}
        value={shown}
        onChange={(e) => {
          const v =
            e.target.value === "" ? undefined : parseFloat(e.target.value);
          onChange(v === undefined || Number.isNaN(v) ? undefined : v);
        }}
        className={cn(compactInputClass, widthClass)}
      />
      {unit && <span className="text-xs text-muted-foreground">{unit}</span>}
    </span>
  );
}

export function DateInput({
  id,
  value,
  onChange,
  min,
  max,
  disabled,
  ariaLabel,
}: {
  id: string;
  value: string | undefined;
  onChange: (v: string | undefined) => void;
  min?: string;
  max?: string;
  disabled?: boolean;
  ariaLabel?: string;
}) {
  return (
    <input
      id={id}
      type="date"
      aria-label={ariaLabel}
      value={value ?? ""}
      min={min}
      max={max}
      disabled={disabled}
      onChange={(e) =>
        onChange(e.target.value === "" ? undefined : e.target.value)
      }
      className={cn(compactInputClass, "w-[9.5rem]")}
    />
  );
}

/** Multi-select toggle chip (role="checkbox"). */
export function ChipToggle({
  active,
  onClick,
  children,
  title,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={active}
      title={title}
      onClick={onClick}
      className={cn(
        "h-7 rounded-md border px-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-background text-foreground/80 hover:bg-muted/60"
      )}
    >
      {children}
    </button>
  );
}

/** Read-only derived value, e.g. "부피 31.1 mL". */
export function Readout({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: React.ReactNode;
  tone?: "neutral" | "good" | "warn" | "bad";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs",
        tone === "neutral" && "bg-muted text-foreground/80",
        tone === "good" &&
          "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
        tone === "warn" &&
          "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
        tone === "bad" && "bg-destructive/10 text-destructive"
      )}
    >
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold tabular-nums">{value}</span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Disclosure
// ---------------------------------------------------------------------------

/**
 * One-line summary that expands into its fields. Opens on its own when
 * `forceOpen` turns true (a non-default value arrived), so a recorded
 * finding is never hidden behind a closed summary on first render.
 */
export function Disclosure({
  id,
  label,
  summary,
  forceOpen = false,
  children,
}: {
  id: string;
  label: string;
  summary?: React.ReactNode;
  forceOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(forceOpen);
  React.useEffect(() => {
    if (forceOpen) setOpen(true);
  }, [forceOpen]);

  return (
    <div className="mt-1 border-t border-border/60">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 py-2 text-left text-[13px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ChevronRight
          aria-hidden="true"
          className={cn(
            "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-90"
          )}
        />
        <span className="shrink-0 font-medium text-foreground/80">{label}</span>
        {summary && (
          <span className="min-w-0 truncate text-muted-foreground">
            {summary}
          </span>
        )}
        <span className="ml-auto shrink-0 text-xs text-primary">
          {open ? "접기" : "열기"}
        </span>
      </button>
      {open && (
        <div id={id} className="pb-1">
          {children}
        </div>
      )}
    </div>
  );
}
