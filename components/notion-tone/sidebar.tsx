"use client";

import * as React from "react";
import { useNotionPalette } from "./tokens";

/**
 * Notion-tone sidebar primitives.
 * Use these inside a workspace `<aside>` together with WorkspaceHeader / Search.
 */

export function SidebarSection({
  title,
  children,
  mt,
  action,
}: {
  title: string;
  children: React.ReactNode;
  mt?: number;
  action?: React.ReactNode;
}) {
  const { c } = useNotionPalette();
  return (
    <div style={{ marginTop: mt ?? 12 }}>
      <div
        className="flex items-center justify-between px-2 pb-1 text-[11px] font-medium"
        style={{ color: c.steel, letterSpacing: "0.04em" }}
      >
        <span>{title}</span>
        {action && (
          <span
            className="rounded p-1"
            style={{ color: c.steel }}
            aria-hidden
          >
            {action}
          </span>
        )}
      </div>
      <div className="flex flex-col">{children}</div>
    </div>
  );
}

export function SidebarItem({
  children,
  icon,
  active,
  onClick,
}: {
  children: React.ReactNode;
  icon?: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
}) {
  const { c } = useNotionPalette();
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2 rounded-md px-2 py-1 text-left text-[13px] transition-colors"
      style={{
        background: active ? c.accentHover : "transparent",
        color: active ? c.charcoal : c.slate,
        fontWeight: active ? 500 : 400,
      }}
    >
      <span style={{ color: active ? c.primary : c.stone }}>{icon}</span>
      <span className="truncate">{children}</span>
    </button>
  );
}
