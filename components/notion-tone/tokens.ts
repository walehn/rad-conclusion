import type * as React from "react";

/**
 * Notion-tone color tokens for the radiology workspace.
 * See docs/notion-tone-guide.md for application guidance.
 */

/** CSS variable override applied to a page wrapper. */
export const notionTokens = {
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

/** Inline color constants for direct use in components. */
export const C = {
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
  accentBg: "#e6e0f5",
  accentText: "#5645d4",
  cardLavender: "#f5f2fa",
} as const;

export type NotionPalette = typeof C;
