import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import type { ProviderName, ProviderInfo } from "./types";
import {
  LOCAL_MODELS,
  resolveLocalModel,
  type LocalModelConfig,
} from "./local-config";
import { perfLog } from "@/lib/perf-log";

/** Model used when a request omits `model`, per provider. */
const DEFAULT_MODEL_BY_PROVIDER = {
  openai: "gpt-4o",
  anthropic: "claude-sonnet-4-20250514",
  google: "gemini-3.1-flash-lite-preview",
} as const;

// Best-effort URL extraction so the perf log shows path (and origin when easy)
// without leaking auth tokens that may live in query strings.
function describeFetchUrl(input: RequestInfo | URL): string {
  try {
    if (typeof input === "string") return input;
    if (input instanceof URL) return input.toString();
    if (typeof Request !== "undefined" && input instanceof Request) {
      return input.url;
    }
  } catch {
    /* fall through */
  }
  return "<unknown>";
}

/** Applies the env override declared by the model's catalog entry. */
function resolveLocalHost(entry: LocalModelConfig): string {
  return process.env[entry.hostEnvVar] || entry.host;
}

/**
 * Resolves the local model actually targeted by a request.
 * Client selection wins; RAD_LOCAL_MODEL is the operator-level fallback.
 */
function resolveLocalEntry(modelId?: string): LocalModelConfig {
  return resolveLocalModel(modelId || process.env.RAD_LOCAL_MODEL);
}

// Serving stacks need per-model chat-template flags that @ai-sdk/openai 1.3
// does not expose (Qwen drops all content when its <think> channel exhausts
// max_tokens; DeepSeek-V4 streams reasoning on a channel the SDK ignores).
// Inject the catalog's `chat_template_kwargs` via a fetch middleware.
const createLocalFetch = (
  entry: LocalModelConfig
): typeof fetch => async (input, init) => {
  const kwargs = entry.chatTemplateKwargs;
  if (
    kwargs &&
    init?.body &&
    typeof init.body === "string" &&
    init.body.includes('"messages"')
  ) {
    try {
      const parsed = JSON.parse(init.body);
      parsed.chat_template_kwargs = {
        ...(parsed.chat_template_kwargs ?? {}),
        ...kwargs,
      };
      init = { ...init, body: JSON.stringify(parsed) };
    } catch {
      /* leave body untouched if not JSON */
    }
  }
  // Perf instrumentation: time-to-headers from upstream (vLLM/Ollama). This is
  // the prefill+queue contribution as seen from Next.js, NOT the total stream
  // duration — the stream body is still read by the AI SDK consumer.
  const t0 = performance.now();
  const res = await fetch(input as RequestInfo, init);
  try {
    perfLog({
      perf: "localFetch",
      modelId: entry.id,
      upstreamHeadersMs: Math.round(performance.now() - t0),
      status: res.status,
      url: describeFetchUrl(input as RequestInfo | URL),
    });
  } catch {
    /* observability must never break the request path */
  }
  return res;
};

/**
 * Builds a model handle bound to the selected local model's own endpoint.
 * Each catalog entry may live on a different host, so the client is created
 * per request rather than shared.
 */
function createLocalModel(modelId?: string) {
  const entry = resolveLocalEntry(modelId);
  const local = createOpenAI({
    baseURL: resolveLocalHost(entry) + "/v1",
    apiKey: "not-needed",
    fetch: createLocalFetch(entry),
  });
  return local(entry.id);
}

/**
 * The model id actually sent upstream, after client selection, env overrides
 * and per-provider defaults are applied. Used for perf logging so the log
 * reflects which model really ran.
 */
export function resolvedModelId(
  provider: ProviderName,
  modelId?: string
): string {
  if (provider === "local") return resolveLocalEntry(modelId).id;
  return modelId || DEFAULT_MODEL_BY_PROVIDER[provider];
}

export function getModel(
  provider: ProviderName,
  modelId?: string,
) {
  switch (provider) {
    case "local":
      return createLocalModel(modelId);
    case "openai": {
      const openai = createOpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
      return openai(modelId || DEFAULT_MODEL_BY_PROVIDER.openai);
    }
    case "anthropic": {
      const anthropic = createAnthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
      });
      return anthropic(modelId || DEFAULT_MODEL_BY_PROVIDER.anthropic);
    }
    case "google": {
      const google = createGoogleGenerativeAI({
        apiKey: process.env.GOOGLE_AI_API_KEY,
      });
      return google(modelId || DEFAULT_MODEL_BY_PROVIDER.google);
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
    case "local":
      // Local models need no key; the endpoint is resolved from the catalog.
      return createLocalModel(modelId);
    case "openai": {
      const openai = createOpenAI({
        apiKey: apiKey ?? process.env.OPENAI_API_KEY,
      });
      return openai(modelId || DEFAULT_MODEL_BY_PROVIDER.openai);
    }
    case "anthropic": {
      const anthropic = createAnthropic({
        apiKey: apiKey ?? process.env.ANTHROPIC_API_KEY,
      });
      return anthropic(modelId || DEFAULT_MODEL_BY_PROVIDER.anthropic);
    }
    case "google": {
      const google = createGoogleGenerativeAI({
        apiKey: apiKey ?? process.env.GOOGLE_AI_API_KEY,
      });
      return google(modelId || DEFAULT_MODEL_BY_PROVIDER.google);
    }
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

export function getAvailableProviders(): ProviderInfo[] {
  // Catalog models, plus any ad-hoc RAD_LOCAL_MODEL override so the selector
  // can always display the value it is initialised with.
  const localDefault = resolveLocalEntry();
  const localEntries: LocalModelConfig[] = LOCAL_MODELS.some(
    (m) => m.id === localDefault.id
  )
    ? [...LOCAL_MODELS]
    : [localDefault, ...LOCAL_MODELS];

  const providers: ProviderInfo[] = [
    {
      name: "local",
      label: "Local LLM",
      defaultModel: localDefault.id,
      models: localEntries.map((m) => m.id),
      modelLabels: Object.fromEntries(
        localEntries.map((m) => [m.id, m.label])
      ),
      available: true,
    },
    {
      name: "openai",
      label: "OpenAI",
      defaultModel: DEFAULT_MODEL_BY_PROVIDER.openai,
      models: ["gpt-4o", "gpt-4o-mini", "gpt-4.1"],
      available: !!process.env.OPENAI_API_KEY,
    },
    {
      name: "anthropic",
      label: "Anthropic",
      defaultModel: DEFAULT_MODEL_BY_PROVIDER.anthropic,
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
      defaultModel: DEFAULT_MODEL_BY_PROVIDER.google,
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
