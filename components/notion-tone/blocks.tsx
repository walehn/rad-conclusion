"use client";

import * as React from "react";
import { useNotionPalette } from "./tokens";

/**
 * Three Notion-style block containers used across radiology pages:
 *
 * - Block         : standard label-above / card-below content unit.
 * - CalloutBlock  : tinted block with a coloured left bar; use sparingly to
 *                   draw the eye to the most important input on a page.
 * - OutputBlock   : label + H3 + optional pill, ideal for results.
 */

export function Block({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { c } = useNotionPalette();
  return (
    <section className="mt-7">
      <div className="flex items-baseline justify-between gap-3">
        <h2
          className="text-[15px] font-semibold"
          style={{ color: c.ink, letterSpacing: "-0.1px" }}
        >
          {label}
        </h2>
        {hint && (
          <span className="text-[12px]" style={{ color: c.steel }}>
            {hint}
          </span>
        )}
      </div>
      <div
        className="mt-2 rounded-lg border p-4"
        style={{ borderColor: c.hairline, background: c.card }}
      >
        {children}
      </div>
    </section>
  );
}

export function CalloutBlock({
  label,
  hint,
  note,
  children,
  barColor,
  tint,
  borderColor,
}: {
  label: string;
  hint?: React.ReactNode;
  note?: string;
  children: React.ReactNode;
  barColor?: string;
  tint?: string;
  borderColor?: string;
}) {
  const { c } = useNotionPalette();
  const resolvedBar = barColor ?? c.primary;
  const resolvedTint = tint ?? c.cardLavender;
  const resolvedBorder = borderColor ?? c.accentBg;
  return (
    <section className="mt-7">
      <div className="flex items-baseline justify-between gap-3">
        <h2
          className="text-[15px] font-semibold"
          style={{ color: c.ink, letterSpacing: "-0.1px" }}
        >
          {label}
        </h2>
        {hint && (
          <span className="text-[12px]" style={{ color: c.steel }}>
            {hint}
          </span>
        )}
      </div>
      <div
        className="mt-2 flex overflow-hidden rounded-lg border"
        style={{ background: resolvedTint, borderColor: resolvedBorder }}
      >
        <div
          aria-hidden
          className="shrink-0"
          style={{ width: 4, background: resolvedBar }}
        />
        <div className="flex-1 p-4">
          {note && (
            <p
              className="mb-3 text-[13px]"
              style={{ color: c.slate, lineHeight: 1.55 }}
            >
              {note}
            </p>
          )}
          {children}
        </div>
      </div>
    </section>
  );
}

export function OutputBlock({
  label,
  title,
  pill,
  children,
  highlight,
}: {
  label: string;
  title: string;
  pill?: { text: string; bg: string; color: string };
  children: React.ReactNode;
  highlight?: boolean;
}) {
  const { c } = useNotionPalette();
  return (
    <section>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div
            className="text-[11px] font-medium uppercase"
            style={{ color: c.steel, letterSpacing: "0.08em" }}
          >
            {label}
          </div>
          <h3
            className="mt-0.5 truncate text-[20px] font-semibold"
            style={{ color: c.ink, letterSpacing: "-0.2px" }}
          >
            {title}
          </h3>
        </div>
        {pill && (
          <span
            className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium"
            style={{ background: pill.bg, color: pill.color }}
          >
            {pill.text}
          </span>
        )}
      </div>
      <div
        className="mt-3 rounded-lg border p-4"
        style={{
          background: c.card,
          borderColor: highlight ? c.accentBg : c.hairline,
        }}
      >
        {children}
      </div>
    </section>
  );
}
