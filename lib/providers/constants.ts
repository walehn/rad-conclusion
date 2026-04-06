import type { ProviderSettings } from "./types";

export const PROVIDER_DEFAULTS: ProviderSettings[] = [
  {
    id: "local",
    name: "Local LLM",
    enabled: false,
    hostUrl: "http://localhost:5100",
    validationStatus: "none",
    models: [{ id: "gpt-oss-120b", name: "GPT-OSS 120B", isDefault: true }],
  },
  {
    id: "openai",
    name: "OpenAI",
    enabled: false,
    validationStatus: "none",
    models: [
      { id: "gpt-4o", name: "GPT-4o", isDefault: true },
      { id: "gpt-4o-mini", name: "GPT-4o Mini", isDefault: false },
      { id: "gpt-4.1", name: "GPT-4.1", isDefault: false },
    ],
  },
  {
    id: "anthropic",
    name: "Anthropic",
    enabled: false,
    validationStatus: "none",
    models: [
      {
        id: "claude-sonnet-4-20250514",
        name: "Claude Sonnet 4",
        isDefault: true,
      },
      {
        id: "claude-opus-4-20250514",
        name: "Claude Opus 4",
        isDefault: false,
      },
    ],
  },
  {
    id: "google",
    name: "Google AI",
    enabled: false,
    validationStatus: "none",
    models: [
      { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", isDefault: false },
      { id: "gemini-2.5-flash-lite", name: "Gemini 2.5 Flash-Lite", isDefault: false },
      { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro", isDefault: false },
      { id: "gemini-3-flash-preview", name: "Gemini 3 Flash (Preview)", isDefault: false },
      { id: "gemini-3.1-flash-lite-preview", name: "Gemini 3.1 Flash-Lite (Preview)", isDefault: true },
    ],
  },
];
