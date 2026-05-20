"use client";

import * as React from "react";
import { useNotionPalette } from "./tokens";

/**
 * Notion-style page property row.
 *
 * Use inside a `<dl>` grid:
 *
 *   <dl className="grid grid-cols-1 gap-y-1.5 sm:grid-cols-[120px_1fr]">
 *     <PropRow label="Standard" value="PI-RADS v2.1" pillBg={c.surface} />
 *     <PropRow label="Length" value="0 characters" muted />
 *   </dl>
 */
export function PropRow({
  label,
  value,
  pillBg,
  pillColor,
  muted,
}: {
  label: string;
  value: string;
  pillBg?: string;
  pillColor?: string;
  muted?: boolean;
}) {
  const { c } = useNotionPalette();
  return (
    <>
      <dt
        className="flex items-center gap-1.5 py-1.5 text-[13px]"
        style={{ color: c.steel }}
      >
        {label}
      </dt>
      <dd className="flex items-center py-1.5">
        {pillBg ? (
          <span
            className="inline-flex items-center rounded px-2 py-0.5 text-[12px]"
            style={{
              background: pillBg,
              color: pillColor ?? c.charcoal,
              fontWeight: 500,
            }}
          >
            {value}
          </span>
        ) : (
          <span
            className="text-[13px]"
            style={{ color: muted ? c.steel : c.charcoal }}
          >
            {value}
          </span>
        )}
      </dd>
    </>
  );
}
