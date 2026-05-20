"use client";

import * as React from "react";
import { useTheme } from "@/components/theme-provider";

/**
 * Notion-tone color tokens for the radiology workspace.
 * See docs/notion-tone-guide.md for application guidance.
 *
 * The palette ships in two variants (light / dark). Components should
 * pull values through `useNotionPalette()` so inline styles follow the
 * active theme. The static `C` and `notionTokens` exports remain for
 * backward compatibility and resolve to the light variant.
 */

const lightTokens = {
  "--color-background": "#fafaf9",
  "--color-foreground": "#37352f",
  "--color-muted": "#f0eeec",
  "--color-muted-foreground": "#787671",
  "--color-border": "#e5e3df",
  "--color-input": "#e5e3df",
  "--color-ring": "#5645d4",
  "--color-primary": "#5645d4",
  "--color-primary-foreground": "#ffffff",
  "--color-secondary": "#f6f5f4",
  "--color-secondary-foreground": "#37352f",
  "--color-card": "#ffffff",
  "--color-card-foreground": "#37352f",
  "--color-popover": "#ffffff",
  "--color-popover-foreground": "#37352f",
  "--color-accent": "#f0eeec",
  "--color-accent-foreground": "#37352f",
} as React.CSSProperties;

const darkTokens = {
  "--color-background": "#191919",
  "--color-foreground": "#e7e5e1",
  "--color-muted": "#262626",
  "--color-muted-foreground": "#9b9a96",
  "--color-border": "#2f2f2f",
  "--color-input": "#2f2f2f",
  "--color-ring": "#9b87ff",
  "--color-primary": "#9b87ff",
  "--color-primary-foreground": "#1f1a3a",
  "--color-secondary": "#242424",
  "--color-secondary-foreground": "#e7e5e1",
  "--color-card": "#202020",
  "--color-card-foreground": "#e7e5e1",
  "--color-popover": "#252525",
  "--color-popover-foreground": "#e7e5e1",
  "--color-accent": "#2a2a2a",
  "--color-accent-foreground": "#e7e5e1",
} as React.CSSProperties;

const lightC = {
  canvas: "#fafaf9",
  surface: "#f6f5f4",
  surfaceSoft: "#fbfaf8",
  card: "#ffffff",
  hairline: "#e5e3df",
  hairlineSoft: "#ede9e4",
  ink: "#1a1a1a",
  charcoal: "#37352f",
  slate: "#5d5b54",
  steel: "#787671",
  stone: "#a4a097",
  primary: "#5645d4",
  primaryDeep: "#4534b3",
  primaryForeground: "#ffffff",
  accentBg: "#e6e0f5",
  accentText: "#5645d4",
  accentHover: "#ece8f7",
  cardLavender: "#f5f2fa",
  mutedHover: "#f0eeec",
  successText: "#2f7a3b",
  errorText: "#b3261e",
  warningBar: "#dd5b00",
  warningTint: "#fff4d6",
  warningBorder: "#f3d97a",
  warningText: "#5c3d00",
  ringTint: "#d6d9fc",
} as const;

const darkC = {
  canvas: "#191919",
  surface: "#242424",
  surfaceSoft: "#1f1f1f",
  card: "#202020",
  hairline: "#2f2f2f",
  hairlineSoft: "#2a2a2a",
  ink: "#f1efea",
  charcoal: "#e7e5e1",
  slate: "#c4c2bd",
  steel: "#9b9a96",
  stone: "#7a7873",
  primary: "#9b87ff",
  primaryDeep: "#7c63ff",
  primaryForeground: "#1f1a3a",
  accentBg: "#332a55",
  accentText: "#c4b6ff",
  accentHover: "#2d2748",
  cardLavender: "#262238",
  mutedHover: "#2a2a2a",
  successText: "#5fd17a",
  errorText: "#ff7a73",
  warningBar: "#ff9d4d",
  warningTint: "#3a2a14",
  warningBorder: "#7a4f1f",
  warningText: "#f5d59a",
  ringTint: "#5645d480",
} as const;

export type NotionPalette = { [K in keyof typeof lightC]: string };

/** CSS variable override applied to a page wrapper (light variant). */
export const notionTokens = lightTokens;

/** Inline color constants (light variant, kept for backward compat). */
export const C = lightC;

/**
 * Hook returning the active notion-tone palette and CSS variable map.
 *
 * Components rendering Notion-tone surfaces should use this instead of
 * the static `C` / `notionTokens` exports so inline styles update when
 * the user toggles the theme. Falls back to the light palette while
 * the client is still hydrating.
 */
export function useNotionPalette(): {
  c: NotionPalette;
  tokens: React.CSSProperties;
  isDark: boolean;
} {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  return {
    c: isDark ? darkC : lightC,
    tokens: isDark ? darkTokens : lightTokens,
    isDark,
  };
}
