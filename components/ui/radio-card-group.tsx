"use client";

/**
 * RadioCardGroup — generic radio-style card grid for grouped option sets.
 *
 * SPEC-UI-001
 *
 * Visual: each option is a card with a left semantic-color accent bar, a bold
 * label, an optional small muted sublabel, and a check icon when selected.
 * Cards live inside a CSS Grid with caller-controlled column count.
 *
 * Accessibility:
 *   - <fieldset> wrapper with sr-only <legend> mirroring `ariaLabel`.
 *   - Each card is a real <button role="radio" aria-checked>, never a div+onClick.
 *   - aria-disabled on the wrapper when `disabled`; aria-describedby on each
 *     option points at the disabledNote when one is provided.
 *   - Keyboard: roving tabindex (0 on the active card, -1 on others). Arrow
 *     keys move between cards (cycling), Home/End jump to first/last,
 *     Space/Enter selects. The grid behaves as a single radio group.
 */

import * as React from "react";
import { Check, Lock } from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SemanticTone =
  | "neutral"
  | "success"
  | "warning"
  | "orange"
  | "destructive";

export interface RadioCardOption<T extends string> {
  value: T;
  label: string;
  sublabel?: string;
  tone?: SemanticTone;
}

export interface RadioCardGroupProps<T extends string> {
  value: T | undefined;
  options: ReadonlyArray<RadioCardOption<T>>;
  onChange: (next: T) => void;
  ariaLabel: string;
  disabled?: boolean;
  disabledNote?: string;
  columns?: 1 | 2 | 3;
  className?: string;
  name?: string;
}

// ---------------------------------------------------------------------------
// Variants
// ---------------------------------------------------------------------------

/**
 * Tone styles encode three visual concerns:
 *   - accent: left-side color bar (always visible)
 *   - selectedRing: ring color shown when the card is selected
 *   - selectedBg: a soft background tint shown when the card is selected
 */
const cardToneVariants = cva(
  "group relative flex w-full items-start gap-3 rounded-md border border-border bg-card p-3 text-left text-card-foreground shadow-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:cursor-not-allowed",
  {
    variants: {
      tone: {
        neutral: "",
        success: "",
        warning: "",
        orange: "",
        destructive: "",
      },
      selected: {
        true: "",
        false: "hover:border-border hover:bg-muted/40",
      },
    },
    compoundVariants: [
      // Selected ring + soft bg per tone
      {
        tone: "neutral",
        selected: true,
        class: "border-foreground/40 bg-muted/60 ring-2 ring-foreground/20",
      },
      {
        tone: "success",
        selected: true,
        class: "border-success/60 bg-success/5 ring-2 ring-success/40",
      },
      {
        tone: "warning",
        selected: true,
        class: "border-warning/60 bg-warning/5 ring-2 ring-warning/40",
      },
      {
        tone: "orange",
        selected: true,
        class: "border-orange/60 bg-orange/5 ring-2 ring-orange/40",
      },
      {
        tone: "destructive",
        selected: true,
        class:
          "border-destructive/60 bg-destructive/5 ring-2 ring-destructive/40",
      },
    ],
    defaultVariants: {
      tone: "neutral",
      selected: false,
    },
  }
);

const accentVariants = cva(
  "absolute left-0 top-2 bottom-2 w-1 rounded-r-sm",
  {
    variants: {
      tone: {
        neutral: "bg-muted-foreground/40",
        success: "bg-success",
        warning: "bg-warning",
        orange: "bg-orange",
        destructive: "bg-destructive",
      },
    },
    defaultVariants: {
      tone: "neutral",
    },
  }
);

const checkBadgeVariants = cva(
  "ml-auto inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] transition-opacity",
  {
    variants: {
      tone: {
        neutral: "bg-foreground/80 text-background",
        success: "bg-success text-success-foreground",
        warning: "bg-warning text-warning-foreground",
        orange: "bg-orange text-orange-foreground",
        destructive: "bg-destructive text-destructive-foreground",
      },
      visible: {
        true: "opacity-100",
        false: "opacity-0",
      },
    },
    defaultVariants: {
      tone: "neutral",
      visible: false,
    },
  }
);

// VariantProps surface (for downstream typing)
export type CardToneVariantProps = VariantProps<typeof cardToneVariants>;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RadioCardGroup<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  disabled = false,
  disabledNote,
  columns = 2,
  className,
  name,
}: RadioCardGroupProps<T>) {
  const reactId = React.useId();
  const groupName = name ?? `card-${reactId}`;
  const noteId = `${groupName}-note`;
  const count = options.length;
  const activeIdx = options.findIndex((opt) => opt.value === value);
  const focusAnchorIdx = activeIdx >= 0 ? activeIdx : 0;

  const focusOptionAt = React.useCallback(
    (idx: number) => {
      const id = `${groupName}-opt-${idx}`;
      const el = document.getElementById(id);
      if (el) el.focus();
    },
    [groupName]
  );

  const handleKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    idx: number
  ) => {
    if (disabled || count === 0) return;
    let nextIdx: number | null = null;
    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        nextIdx = (idx + 1) % count;
        break;
      case "ArrowLeft":
      case "ArrowUp":
        nextIdx = (idx - 1 + count) % count;
        break;
      case "Home":
        nextIdx = 0;
        break;
      case "End":
        nextIdx = count - 1;
        break;
      case " ":
      case "Enter":
        event.preventDefault();
        onChange(options[idx].value);
        return;
      default:
        return;
    }

    if (nextIdx !== null) {
      event.preventDefault();
      onChange(options[nextIdx].value);
      focusOptionAt(nextIdx);
    }
  };

  // Map columns to a static Tailwind class so the JIT compiler keeps the rule.
  const colClass =
    columns === 1
      ? "grid-cols-1"
      : columns === 2
        ? "grid-cols-1 sm:grid-cols-2"
        : "grid-cols-1 sm:grid-cols-2 md:grid-cols-3";

  return (
    <fieldset
      aria-disabled={disabled ? "true" : undefined}
      data-slot="radio-card-group"
      className={cn(
        "flex flex-col gap-2",
        disabled && "opacity-60",
        className
      )}
    >
      <legend className="sr-only">{ariaLabel}</legend>

      <div className={cn("grid gap-2", colClass)}>
        {options.map((opt, idx) => {
          const tone: SemanticTone = opt.tone ?? "neutral";
          const selected = idx === activeIdx;
          return (
            <button
              key={opt.value}
              id={`${groupName}-opt-${idx}`}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-describedby={
                disabled && disabledNote ? noteId : undefined
              }
              disabled={disabled}
              tabIndex={disabled ? -1 : idx === focusAnchorIdx ? 0 : -1}
              onClick={() => {
                if (disabled) return;
                onChange(opt.value);
              }}
              onKeyDown={(event) => handleKeyDown(event, idx)}
              className={cardToneVariants({ tone, selected })}
            >
              {/* Left accent bar — always rendered; selection state intensifies
                  via the surrounding ring + bg from cardToneVariants. */}
              <span aria-hidden="true" className={accentVariants({ tone })} />

              <span className="flex flex-1 flex-col gap-0.5 pl-2">
                <span className="text-sm font-semibold leading-tight">
                  {opt.label}
                </span>
                {opt.sublabel && (
                  <span className="text-xs leading-tight text-muted-foreground">
                    {opt.sublabel}
                  </span>
                )}
              </span>

              {/* Disabled indicator — replaces the check badge while disabled. */}
              {disabled ? (
                <span
                  aria-hidden="true"
                  className="ml-auto inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"
                >
                  <Lock className="h-3 w-3" />
                </span>
              ) : (
                <span
                  aria-hidden="true"
                  className={checkBadgeVariants({ tone, visible: selected })}
                >
                  <Check className="h-3 w-3" strokeWidth={3} />
                </span>
              )}
            </button>
          );
        })}
      </div>

      {disabled && disabledNote && (
        <p id={noteId} className="text-xs text-muted-foreground">
          {disabledNote}
        </p>
      )}
    </fieldset>
  );
}
