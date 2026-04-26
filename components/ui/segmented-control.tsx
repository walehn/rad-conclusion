"use client";

/**
 * SegmentedControl — generic radio-style toggle for compact option groups.
 *
 * SPEC-UI-001
 *
 * Visual: a single rounded pill container with adjacent buttons. The active
 * option is rendered with an absolutely positioned indicator that slides via
 * CSS `transform: translateX(...)` + `transition`, similar to Linear/Vercel.
 *
 * Accessibility:
 *   - role="radiogroup" on the wrapper, role="radio" on each option button.
 *   - aria-checked toggles per option.
 *   - aria-disabled on the wrapper when `disabled`.
 *   - Keyboard: Arrow keys cycle (skipping when group is disabled), Home/End
 *     jump to first/last, Space/Enter selects the focused option. Tab/Shift+Tab
 *     enters and exits the group via the active option's tabindex=0; inactive
 *     options are tabindex=-1 (roving tabindex pattern).
 */

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Variants
// ---------------------------------------------------------------------------

const containerVariants = cva(
  "relative inline-grid auto-cols-fr grid-flow-col rounded-md bg-muted/60 p-0.5 text-foreground/90 ring-1 ring-inset ring-border/60",
  {
    variants: {
      size: {
        sm: "h-8 text-xs",
        md: "h-9 text-sm",
      },
    },
    defaultVariants: {
      size: "md",
    },
  }
);

const optionVariants = cva(
  "relative z-10 inline-flex items-center justify-center whitespace-nowrap rounded-[5px] font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:cursor-not-allowed",
  {
    variants: {
      size: {
        sm: "px-2.5",
        md: "px-3",
      },
      active: {
        true: "text-foreground",
        false: "text-muted-foreground hover:text-foreground",
      },
    },
    defaultVariants: {
      size: "md",
      active: false,
    },
  }
);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SegmentedControlOption<T extends string> {
  value: T;
  label: string;
}

export interface SegmentedControlProps<T extends string>
  extends VariantProps<typeof containerVariants> {
  value: T | undefined;
  options: ReadonlyArray<SegmentedControlOption<T>>;
  onChange: (next: T) => void;
  ariaLabel: string;
  disabled?: boolean;
  className?: string;
  name?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  disabled = false,
  size,
  className,
  name,
}: SegmentedControlProps<T>) {
  const reactId = React.useId();
  const groupName = name ?? `seg-${reactId}`;
  const count = options.length;
  const activeIdx = options.findIndex((opt) => opt.value === value);

  // Roving tabindex anchor: the active option (or first option when nothing
  // is selected) receives tabindex=0; other options receive tabindex=-1.
  const focusAnchorIdx = activeIdx >= 0 ? activeIdx : 0;

  const focusOptionAt = React.useCallback(
    (idx: number) => {
      const id = `${groupName}-opt-${idx}`;
      const el = document.getElementById(id);
      if (el) {
        el.focus();
      }
    },
    [groupName]
  );

  const handleKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    idx: number
  ) => {
    if (disabled) return;
    if (count === 0) return;

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
      // Native radiogroup semantics: arrow movement also updates selection.
      onChange(options[nextIdx].value);
      focusOptionAt(nextIdx);
    }
  };

  // Slide-indicator geometry. Uses `style` (transform+width via grid template)
  // so the visual indicator follows the active option without per-option
  // measurement. The indicator spans the full cell width of the active option.
  const indicatorVisible = activeIdx >= 0 && count > 0;

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      aria-disabled={disabled ? "true" : undefined}
      data-slot="segmented-control"
      className={cn(
        containerVariants({ size }),
        disabled && "opacity-60",
        className
      )}
      style={{
        gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))`,
      }}
    >
      {/* Slide indicator: a single absolutely positioned element that translates
          to the active cell. Width is 1/count of the inner area minus padding. */}
      {indicatorVisible && (
        <span
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-y-0.5 left-0.5 rounded-[5px] bg-background shadow-sm ring-1 ring-inset ring-border/40",
            "transition-transform duration-200 ease-out"
          )}
          style={{
            // The indicator covers (1/count) of (100% - 4px padding); we step
            // it via translate by the same fraction.
            width: `calc((100% - 4px) / ${count})`,
            transform: `translateX(calc(${activeIdx} * 100%))`,
          }}
        />
      )}

      {options.map((opt, idx) => {
        const active = idx === activeIdx;
        return (
          <button
            key={opt.value}
            id={`${groupName}-opt-${idx}`}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={opt.label}
            disabled={disabled}
            tabIndex={disabled ? -1 : idx === focusAnchorIdx ? 0 : -1}
            onClick={() => {
              if (disabled) return;
              onChange(opt.value);
            }}
            onKeyDown={(event) => handleKeyDown(event, idx)}
            className={optionVariants({ size, active })}
          >
            <span className="truncate">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Convenience helper for plain `readonly T[]` option arrays
// ---------------------------------------------------------------------------

/**
 * toSegmentedOptions — adapt a `readonly T[]` of string literals (e.g.
 * `RCC_SIDES`) into `SegmentedControlOption<T>[]` where the label equals the
 * value. Use this when the option label is the canonical domain string itself.
 */
export function toSegmentedOptions<T extends string>(
  values: ReadonlyArray<T>
): SegmentedControlOption<T>[] {
  return values.map((v) => ({ value: v, label: v }));
}
