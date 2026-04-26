"use client";

/**
 * SegmentedControl — generic radio-style toggle for compact option groups.
 *
 * SPEC-UI-001
 *
 * Visual: a single rounded pill container holding adjacent option buttons.
 * The active option is highlighted in place via background + ring + shadow
 * (no separate sliding indicator), so option widths can be content-sized and
 * the group can wrap onto multiple lines when the container is narrow without
 * breaking indicator geometry. Long labels (e.g. ">=50% exophytic") are NEVER
 * truncated — full label text is always visible. Width-uneven layout follows
 * the gap-based pattern used by Linear / Radix Toggle Group when option text
 * lengths vary.
 *
 * Accessibility:
 *   - role="radiogroup" on the wrapper, role="radio" on each option button.
 *   - aria-checked toggles per option.
 *   - aria-disabled on the wrapper when `disabled`.
 *   - Keyboard: Arrow keys cycle (skipping when group is disabled), Home/End
 *     jump to first/last, Space/Enter selects the focused option. Tab/Shift+Tab
 *     enters and exits the group via the active option's tabindex=0; inactive
 *     options are tabindex=-1 (roving tabindex pattern). Wrapping does not
 *     change the linear keyboard order (Arrow keys traverse options in DOM
 *     order regardless of which visual line they sit on).
 */

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Variants
// ---------------------------------------------------------------------------

const containerVariants = cva(
  // inline-flex + flex-wrap allows the group to break onto a second line on
  // narrow viewports rather than truncating any option label. `items-stretch`
  // keeps every wrapped row aligned at equal height. Container height is no
  // longer fixed because wrapped rows must be free to stack vertically.
  "relative inline-flex flex-wrap items-stretch gap-0.5 rounded-md bg-muted/60 p-0.5 text-foreground/90 ring-1 ring-inset ring-border/60",
  {
    variants: {
      size: {
        // `min-h-*` (not `h-*`) reserves the prior single-row height while
        // still permitting growth when wrapping kicks in.
        sm: "min-h-8 text-xs",
        md: "min-h-9 text-sm",
      },
    },
    defaultVariants: {
      size: "md",
    },
  }
);

const optionVariants = cva(
  // `whitespace-nowrap` keeps each individual option label on a single line
  // (no in-label wrapping) while the parent flex-wrap pushes overflowing
  // options to the next row. Active state is applied directly to the button
  // (background + ring + shadow) instead of via a separate sliding indicator,
  // so width-uneven option lists render correctly.
  "relative inline-flex items-center justify-center whitespace-nowrap rounded-[5px] font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:cursor-not-allowed",
  {
    variants: {
      size: {
        sm: "px-2.5 py-1",
        md: "px-3 py-1",
      },
      active: {
        true: "bg-background text-foreground shadow-sm ring-1 ring-inset ring-border/40",
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

  // Active highlight is rendered by the button itself (see optionVariants
  // `active: true` branch) — no separately positioned slide indicator. This
  // keeps width-uneven option lists and wrapped rows visually correct without
  // per-option measurement / ResizeObserver.

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
    >
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
            {/* Render the label as plain text — no `truncate` class — so long
                option labels (e.g. ">=50% exophytic") are always visible in
                full. `whitespace-nowrap` on the button keeps each individual
                label on one line; the parent flex-wrap handles overflow. */}
            <span>{opt.label}</span>
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
