// lib/providers/local-config.ts
// Single source of truth for local LLM provider defaults.
// Any change to host, modelId, or label must happen here and nowhere else.
// Enforced by AC-LOCAL-006 (ripgrep check) per SPEC-LOCAL-MODEL-001.

export const LOCAL_PROVIDER_DEFAULTS = {
  host: "http://localhost:8080",
  modelId: "Qwen/Qwen3.6-35B-A3B-FP8",
  label: "Qwen3.6 35B (A3B-FP8)",
} as const;

export type LocalProviderDefaults = typeof LOCAL_PROVIDER_DEFAULTS;
