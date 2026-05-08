"use client";

import * as React from "react";
import { Smile } from "lucide-react";
import { C } from "./tokens";

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
}: Props) {
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

  return (
    <div ref={wrapperRef} className="relative mt-6 inline-block">
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        aria-label="Change page icon"
        title="Click to change icon"
        className="group relative inline-flex items-center justify-center rounded-md transition-all hover:bg-[#f0eeec] hover:ring-2 hover:ring-offset-1"
        style={{
          width: 56,
          height: 56,
          background: emoji ? "transparent" : C.surface,
          border: emoji
            ? "1px solid transparent"
            : `1px solid ${C.hairlineSoft}`,
          fontSize: 36,
          lineHeight: 1,
          ["--tw-ring-color" as string]: "#d6d9fc",
        }}
      >
        {emoji ? <span aria-hidden>{emoji}</span> : fallback}
        <span
          aria-hidden
          className="pointer-events-none absolute -bottom-1 -right-1 grid h-5 w-5 place-items-center rounded-full bg-white opacity-0 shadow-sm transition-opacity group-hover:opacity-100"
          style={{ color: C.primary, border: `1px solid ${C.hairline}` }}
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
            background: "#ffffff",
            borderColor: C.hairline,
            boxShadow:
              "0 14px 28px -10px rgba(15,15,15,0.18), 0 2px 6px rgba(15,15,15,0.06)",
          }}
        >
          <div className="flex items-center justify-between pb-2">
            <span
              className="text-[11px] font-medium uppercase"
              style={{ color: C.steel, letterSpacing: "0.08em" }}
            >
              {popoverLabel}
            </span>
            <button
              type="button"
              onClick={onClear}
              className="text-[12px] underline-offset-2 hover:underline"
              style={{ color: C.steel }}
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
                className="grid h-9 w-9 place-items-center rounded text-[20px] transition-colors hover:bg-[#f0eeec]"
              >
                {e}
              </button>
            ))}
          </div>
          <div
            className="mt-2 border-t pt-2 text-[11px]"
            style={{ borderColor: C.hairlineSoft, color: C.steel }}
          >
            Click any icon to apply. Saved per browser.
          </div>
        </div>
      )}
    </div>
  );
}
