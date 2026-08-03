// lib/providers/local-config.ts
// Single source of truth for local LLM provider defaults.
// Any change to host, modelId, or label must happen here and nowhere else.
// Enforced by AC-LOCAL-006 (ripgrep check) per SPEC-LOCAL-MODEL-001.
//
// This module is imported by client components, so it must stay free of
// `process.env` access. Environment overrides are applied server-side in
// lib/providers/registry.ts using the `hostEnvVar` declared here.

export interface LocalModelConfig {
  /** Model id exactly as served by the OpenAI-compatible endpoint. */
  id: string;
  /** Human-readable label shown in the model selector. */
  label: string;
  /** Base host, without the `/v1` suffix. */
  host: string;
  /** Environment variable that overrides `host` when set. */
  hostEnvVar: string;
  /**
   * vLLM OpenAI-compat `chat_template_kwargs` merged into every request.
   * Omit to leave the server's own --default-chat-template-kwargs untouched.
   */
  chatTemplateKwargs?: Record<string, unknown>;
  /**
   * Replaces `chatTemplateKwargs` when the caller asks for deeper reasoning
   * (the v2 prompt path). These endpoints drive thinking through the chat
   * template, so depth is expressed by turning thinking on rather than by the
   * `reasoning_effort` parameter — see `supportsReasoningEffort`.
   *
   * Measured on DeepSeek-V4-Flash: off ~6s / 248 tokens, on+low ~15s / 697
   * tokens, on+medium ~21s / 1072 tokens. `low` keeps most of the benefit.
   *
   * Only used by /api/generate, which sets no max_tokens. Do not enable this
   * on a capped route: thinking can consume the whole budget and return empty
   * content.
   */
  deepChatTemplateKwargs?: Record<string, unknown>;
  /**
   * Whether the endpoint may receive the OpenAI `reasoning_effort` parameter.
   *
   * On vLLM builds that drive reasoning through the chat template, sending it
   * overrides `chatTemplateKwargs.thinking` and silently re-enables reasoning:
   * the model then spends its whole budget on hidden thinking tokens (TTFT
   * 13-21s, and empty content once max_tokens is reached). Off unless a model
   * is known to handle the parameter.
   */
  supportsReasoningEffort?: boolean;
}

/**
 * Locally served models, in selector order. The first entry is the default.
 * Each model carries its own host because they are served by separate vLLM
 * instances on different ports.
 */
export const LOCAL_MODELS: readonly LocalModelConfig[] = [
  {
    id: "deepseek-v4-flash-0731",
    label: "DeepSeek V4 Flash",
    host: "http://localhost:8888",
    hostEnvVar: "RAD_LOCAL_DEEPSEEK_HOST",
    // The DeepSeek-V4 chat template takes `thinking` (the server starts with
    // it enabled). Reasoning is streamed on `reasoning_content`, which the AI
    // SDK does not surface, so it stays off unless depth is requested.
    chatTemplateKwargs: { thinking: false },
    deepChatTemplateKwargs: { thinking: true, reasoning_effort: "low" },
  },
  {
    id: "Qwen/Qwen3.6-35B-A3B-FP8",
    label: "Qwen3.6 35B (A3B-FP8)",
    host: "http://localhost:8080",
    hostEnvVar: "RAD_LOCAL_HOST",
    // vLLM (Qwen) emits empty content when its <think> channel exhausts
    // max_tokens, so thinking is force-disabled.
    chatTemplateKwargs: { enable_thinking: false },
    deepChatTemplateKwargs: { enable_thinking: true },
  },
];

/** Selected when the caller does not specify a model. */
export const DEFAULT_LOCAL_MODEL = LOCAL_MODELS[0];

/** Exact-match lookup; returns undefined for ids outside the catalog. */
export function findLocalModel(
  modelId: string | undefined | null
): LocalModelConfig | undefined {
  if (!modelId) return undefined;
  return LOCAL_MODELS.find((m) => m.id === modelId);
}

/**
 * Resolves a model id to its endpoint config.
 *
 * Ids outside the catalog (e.g. an ad-hoc RAD_LOCAL_MODEL override) inherit
 * the default entry's host and template kwargs so an operator can point at a
 * one-off model without editing this file.
 */
export function resolveLocalModel(
  modelId?: string | null
): LocalModelConfig {
  const known = findLocalModel(modelId);
  if (known) return known;
  if (!modelId) return DEFAULT_LOCAL_MODEL;
  return { ...DEFAULT_LOCAL_MODEL, id: modelId, label: modelId };
}

/**
 * Back-compat surface for call sites that predate multi-model support.
 * Always describes the default model.
 */
export const LOCAL_PROVIDER_DEFAULTS = {
  host: DEFAULT_LOCAL_MODEL.host,
  modelId: DEFAULT_LOCAL_MODEL.id,
  label: DEFAULT_LOCAL_MODEL.label,
} as const;

export type LocalProviderDefaults = typeof LOCAL_PROVIDER_DEFAULTS;
