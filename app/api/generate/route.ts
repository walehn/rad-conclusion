import { streamText } from "ai";
import { z } from "zod";
import { getModelWithKey } from "@/lib/providers/registry";
import { buildSystemPrompt, buildUserPrompt } from "@/lib/prompts/system-prompt";
import type { ProviderName } from "@/lib/providers/types";
import type { ConclusionStyle, ConclusionLang, PromptVersion } from "@/lib/prompts/system-prompt";
import { requireApiSession } from "@/lib/auth/guard";
import { validateCsrfOrFail } from "@/lib/auth/csrf";
import { resolveApiKey } from "@/lib/api-keys/resolve";
import { perfLog } from "@/lib/perf-log";

const requestSchema = z.object({
  findings: z.string().min(1, "Findings text is required"),
  style: z.enum(["numbered", "short", "urgent-first"]).default("numbered"),
  lang: z.enum(["ko", "en", "mixed"]).default("en"),
  title: z.string().default("Conclusion"),
  provider: z
    .enum(["local", "openai", "anthropic", "google"])
    .default("local"),
  model: z.string().optional(),
  // API keys are now managed via server environment variables only
  // apiKey and hostUrl no longer accepted from client
  promptVersion: z.enum(["v1", "v2"]).default("v1"),
});

export async function POST(req: Request) {
  // Perf instrumentation: capture entry time before any auth work so the
  // (auth + csrf + parse) overhead can be subtracted from the LLM-only window.
  const tReq = performance.now();

  const { session, response } = await requireApiSession();
  if (response) return response;

  const csrfFailure = await validateCsrfOrFail(req);
  if (csrfFailure) return csrfFailure;

  try {
    const body = await req.json();

    // Extract findings from useChat messages format
    if (!body.findings && Array.isArray(body.messages)) {
      const lastUserMsg = [...body.messages].reverse().find(
        (m: { role: string }) => m.role === "user"
      );
      if (lastUserMsg) {
        body.findings = lastUserMsg.content;
      }
    }

    const parsed = requestSchema.safeParse(body);

    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: parsed.error.flatten().fieldErrors }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const { findings, style, lang, title, provider, model, promptVersion } =
      parsed.data;

    const apiKey = await resolveApiKey(session.userId, provider as ProviderName);
    const llmModel = getModelWithKey(provider as ProviderName, model, apiKey);

    const systemPrompt = buildSystemPrompt({
      style: style as ConclusionStyle,
      lang: lang as ConclusionLang,
      title,
      version: promptVersion as PromptVersion,
    });

    const userPrompt = buildUserPrompt({ findings, title });

    const reasoningEffort = promptVersion === "v2" ? "medium" : "low";

    // Perf instrumentation: t at LLM-call boundary so TTFT excludes auth/parse.
    // promptVersion is included so concurrent v1+v2 (compareMode) requests can
    // be grouped in `jq` post-processing.
    const tLLMStart = performance.now();
    const modelId =
      process.env.RAD_LOCAL_MODEL ?? model ?? "default";
    const baseTags = {
      route: "/api/generate",
      provider,
      modelId,
      promptVersion,
      style,
      lang,
      title,
    } as const;
    let firstTokenLogged = false;

    const result = streamText({
      model: llmModel,
      system: systemPrompt,
      prompt: userPrompt,
      temperature: 0.3,
      topP: 0.9,
      providerOptions: {
        openai: { reasoningEffort },
      },
      onChunk: ({ chunk }) => {
        if (firstTokenLogged) return;
        if (chunk.type !== "text-delta") return;
        firstTokenLogged = true;
        try {
          perfLog({
            perf: "gen",
            stage: "ttft",
            ...baseTags,
            ms: Math.round(performance.now() - tLLMStart),
            preLLMMs: Math.round(tLLMStart - tReq),
          });
        } catch {
          /* observability must never break the stream */
        }
      },
      onFinish: ({ usage, finishReason }) => {
        try {
          const totalMs = performance.now() - tLLMStart;
          const completion = usage?.completionTokens ?? 0;
          const tps =
            totalMs > 0 ? (completion / (totalMs / 1000)) : 0;
          perfLog({
            perf: "gen",
            stage: "finish",
            ...baseTags,
            totalMs: Math.round(totalMs),
            promptTokens: usage?.promptTokens ?? null,
            completionTokens: completion,
            tps: Number(tps.toFixed(1)),
            finishReason,
          });
        } catch {
          /* swallow to keep parity with onChunk */
        }
      },
      onError: ({ error }) => {
        console.error("[generate] streamText error:", error);
      },
    });

    return result.toDataStreamResponse({
      getErrorMessage: (error) => {
        if (error instanceof Error) return error.message;
        return "Unknown streaming error";
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Internal server error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
