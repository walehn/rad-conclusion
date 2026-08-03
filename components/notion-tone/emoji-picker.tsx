"use client";

import * as React from "react";
import { Smile } from "lucide-react";
import { useNotionPalette } from "./tokens";

/**
 * Notion-style emoji picker trigger.
 *
 * Renders a 56×56 icon tile that opens a popover grid when clicked.
 * Click-out and Escape close the popover. "Remove" returns to the
 * supplied fallback element (e.g. a lucide icon).
 *
 * Persistence is handled by the calling page (use localStorage with
 * the `radc.<scope>-page-emoji` key convention).
 */

/** Curated medical emoji set (default for radiology pages). */
export const MEDICAL_EMOJI = [
  "🩺",
  "🩻",
  "🧠",
  "🫀",
  "🫁",
  "🦴",
  "🩸",
  "💉",
  "💊",
  "🧬",
  "🔬",
  "🧪",
  "🩹",
  "⚕️",
  "📋",
  "📝",
  "🔍",
  "📊",
] as const;

/** Report-leaning emoji set for structured-report style pages. */
export const REPORT_EMOJI = [
  "📋",
  "📊",
  "📝",
  "🩺",
  "🩻",
  "🧠",
  "🫀",
  "🫁",
  "🦴",
  "🩸",
  "🔬",
  "🧪",
  "📁",
  "📄",
  "🗂️",
  "✅",
  "⚕️",
  "🔍",
] as const;

interface Props {
  emoji: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSelect: (emoji: string) => void;
  onClear: () => void;
  /** Element shown when emoji is null (fallback). Typically a lucide icon. */
  fallback: React.ReactNode;
  /** Emoji set displayed in the popover. */
  emojis?: readonly string[];
  /** Section heading inside the popover. */
  popoverLabel?: string;
  /**
   * Visual size variant. `md` is the original 56×56 tile; `sm` renders a 40×40
   * tile intended for compact inline page heroes.
   */
  size?: "md" | "sm";
  /**
   * Overrides the default wrapper class. Use to drop the built-in `mt-6`
   * spacing when placing the trigger inside a flex hero row.
   */
  wrapperClassName?: string;
}

export function EmojiPickerTrigger({
  emoji,
  open,
  onOpenChange,
  onSelect,
  onClear,
  fallback,
  emojis = MEDICAL_EMOJI,
  popoverLabel = "Medical icons",
  size = "md",
  wrapperClassName,
}: Props) {
  const { c } = useNotionPalette();
  const wrapperRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        onOpenChange(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onOpenChange(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onOpenChange]);

  const dims = size === "sm" ? { box: 40, font: 24 } : { box: 56, font: 36 };
  const wrapperClass =
    wrapperClassName ?? (size === "sm" ? "relative inline-block" : "relative mt-6 inline-block");

  return (
    <div ref={wrapperRef} className={wrapperClass}>
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        aria-label="Change page icon"
        title="Click to change icon"
        className="group relative inline-flex items-center justify-center rounded-md transition-all hover:ring-2 hover:ring-offset-1"
        style={{
          width: dims.box,
          height: dims.box,
          background: emoji ? "transparent" : c.surface,
          border: emoji
            ? "1px solid transparent"
            : `1px solid ${c.hairlineSoft}`,
          fontSize: dims.font,
          lineHeight: 1,
          ["--tw-ring-color" as string]: c.ringTint,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = c.mutedHover;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = emoji ? "transparent" : c.surface;
        }}
      >
        {emoji ? <span aria-hidden>{emoji}</span> : fallback}
        <span
          aria-hidden
          className="pointer-events-none absolute -bottom-1 -right-1 grid h-5 w-5 place-items-center rounded-full opacity-0 shadow-sm transition-opacity group-hover:opacity-100"
          style={{
            background: c.card,
            color: c.primary,
            border: `1px solid ${c.hairline}`,
          }}
        >
          <Smile className="h-3 w-3" />
        </span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Choose page icon"
          className="absolute z-20 mt-2 w-[280px] rounded-lg border p-3 shadow-lg"
          style={{
            top: "100%",
            left: 0,
            background: c.card,
            borderColor: c.hairline,
            boxShadow:
              "0 14px 28px -10px rgba(0,0,0,0.35), 0 2px 6px rgba(0,0,0,0.15)",
          }}
        >
          <div className="flex items-center justify-between pb-2">
            <span
              className="text-[11px] font-medium uppercase"
              style={{ color: c.steel, letterSpacing: "0.08em" }}
            >
              {popoverLabel}
            </span>
            <button
              type="button"
              onClick={onClear}
              className="text-[12px] underline-offset-2 hover:underline"
              style={{ color: c.steel }}
            >
              Remove
            </button>
          </div>
          <div className="grid grid-cols-6 gap-1">
            {emojis.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => onSelect(e)}
                aria-label={`Choose ${e}`}
                className="grid h-9 w-9 place-items-center rounded text-[20px] transition-colors"
                onMouseEnter={(ev) => {
                  ev.currentTarget.style.background = c.mutedHover;
                }}
                onMouseLeave={(ev) => {
                  ev.currentTarget.style.background = "transparent";
                }}
              >
                {e}
              </button>
            ))}
          </div>
          <div
            className="mt-2 border-t pt-2 text-[11px]"
            style={{ borderColor: c.hairlineSoft, color: c.steel }}
          >
            Click any icon to apply. Saved per browser.
          </div>
        </div>
      )}
    </div>
  );
}
