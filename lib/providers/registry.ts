import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import type { ProviderName, ProviderInfo } from "./types";
import { LOCAL_PROVIDER_DEFAULTS } from "./local-config";

// vLLM (Qwen) emits empty content when its <think> channel exhausts max_tokens.
// We force-disable thinking via the OpenAI-compat `chat_template_kwargs` field,
// which @ai-sdk/openai 1.3 does not expose. Inject it via a fetch middleware.
const localFetch: typeof fetch = async (input, init) => {
  if (init?.body && typeof init.body === "string" && init.body.includes('"messages"')) {
    try {
      const parsed = JSON.parse(init.body);
      parsed.chat_template_kwargs = { ...(parsed.chat_template_kwargs ?? {}), enable_thinking: false };
      init = { ...init, body: JSON.stringify(parsed) };
    } catch {
      /* leave body untouched if not JSON */
    }
  }
  return fetch(input as RequestInfo, init);
};

export function getModel(
  provider: ProviderName,
  modelId?: string,
) {
  switch (provider) {
    case "local": {
      const baseHost = process.env.RAD_LOCAL_HOST || LOCAL_PROVIDER_DEFAULTS.host;
      const local = createOpenAI({
        baseURL: baseHost + "/v1",
        apiKey: "not-needed",
        fetch: localFetch,
      });
      return local(modelId || process.env.RAD_LOCAL_MODEL || LOCAL_PROVIDER_DEFAULTS.modelId);
    }
    case "openai": {
      const openai = createOpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
      return openai(modelId || "gpt-4o");
    }
    case "anthropic": {
      const anthropic = createAnthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
      });
      return anthropic(modelId || "claude-sonnet-4-20250514");
    }
    case "google": {
      const google = createGoogleGenerativeAI({
        apiKey: process.env.GOOGLE_AI_API_KEY,
      });
      return google(modelId || "gemini-3.1-flash-lite-preview");
    }
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

/**
 * Like getModel() but accepts an explicit apiKey to inject directly into the
 * provider SDK instance. Falls back to env vars when apiKey is null.
 * Used by generation endpoints that resolve per-user keys from the database.
 */
export function getModelWithKey(
  provider: ProviderName,
  modelId: string | undefined,
  apiKey: string | null,
) {
  switch (provider) {
    case "local": {
      const baseHost = process.env.RAD_LOCAL_HOST || LOCAL_PROVIDER_DEFAULTS.host;
      const local = createOpenAI({
        baseURL: baseHost + "/v1",
        apiKey: "not-needed",
        fetch: localFetch,
      });
      return local(modelId || process.env.RAD_LOCAL_MODEL || LOCAL_PROVIDER_DEFAULTS.modelId);
    }
    case "openai": {
      const openai = createOpenAI({
        apiKey: apiKey ?? process.env.OPENAI_API_KEY,
      });
      return openai(modelId || "gpt-4o");
    }
    case "anthropic": {
      const anthropic = createAnthropic({
        apiKey: apiKey ?? process.env.ANTHROPIC_API_KEY,
      });
      return anthropic(modelId || "claude-sonnet-4-20250514");
    }
    case "google": {
      const google = createGoogleGenerativeAI({
        apiKey: apiKey ?? process.env.GOOGLE_AI_API_KEY,
      });
      return google(modelId || "gemini-3.1-flash-lite-preview");
    }
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

export function getAvailableProviders(): ProviderInfo[] {
  const providers: ProviderInfo[] = [
    {
      name: "local",
      label: "Local LLM",
      defaultModel: process.env.RAD_LOCAL_MODEL || LOCAL_PROVIDER_DEFAULTS.modelId,
      models: [process.env.RAD_LOCAL_MODEL || LOCAL_PROVIDER_DEFAULTS.modelId],
      available: true,
    },
    {
      name: "openai",
      label: "OpenAI",
      defaultModel: "gpt-4o",
      models: ["gpt-4o", "gpt-4o-mini", "gpt-4.1"],
      available: !!process.env.OPENAI_API_KEY,
    },
    {
      name: "anthropic",
      label: "Anthropic",
      defaultModel: "claude-sonnet-4-20250514",
      models: [
        "claude-sonnet-4-20250514",
        "claude-opus-4-20250514",
        "claude-haiku-4-20250514",
      ],
      available: !!process.env.ANTHROPIC_API_KEY,
    },
    {
      name: "google",
      label: "Google AI",
      defaultModel: "gemini-3.1-flash-lite-preview",
      models: [
        "gemini-2.5-flash",
        "gemini-2.5-flash-lite",
        "gemini-2.5-pro",
        "gemini-3-flash-preview",
        "gemini-3.1-flash-lite-preview",
      ],
      available: !!process.env.GOOGLE_AI_API_KEY,
    },
  ];

  return providers;
}
