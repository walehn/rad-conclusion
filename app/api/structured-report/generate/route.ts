/**
 * POST /api/structured-report/generate
 *
 * SSE streaming endpoint for the Structured Report Generator
 * (SPEC-DASHBOARD-001). Supports the disease categories registered in
 * lib/prompts/disease-registry.ts; requests for any other category are
 * rejected with HTTP 400 at the zod layer.
 *
 * Security layers (mirrors /api/generate):
 *   1. requireApiSession()      — iron-session cookie gate (401 on miss)
 *   2. validateCsrfOrFail()     — double-submit CSRF + Origin check (403)
 *   3. zod schema               — body shape + field bounds (400)
 *
 * Privacy:
 *   - The raw Findings text is NEVER logged. Only metadata
 *     (diseaseCategory, modality, lang, provider, model, findingsLength)
 *     is emitted on error paths.
 *   - Findings, form state and the finished report ARE persisted to the
 *     local SQLite `structured_reports` table for review (never to logs).
 */

/** Upper bound on the serialized form state, mirroring the findings cap. */
const MAX_FORM_STATE_CHARS = 100_000;

/** Fixed sample input so the prompt hash tracks prompt text, not findings. */
const SAMPLE_FINDINGS = "SAMPLE FINDINGS";

import { streamText } from "ai";
import { z } from "zod";
import { getModelWithKey, resolvedModelId } from "@/lib/providers/registry";
import type { ProviderName } from "@/lib/providers/types";
import {
  buildReportSystemPrompt,
  buildReportUserPrompt,
} from "@/lib/prompts/structured-report-prompt";
import { requireApiSession } from "@/lib/auth/guard";
import { validateCsrfOrFail } from "@/lib/auth/csrf";
import { resolveApiKey } from "@/lib/api-keys/resolve";
import { perfLog } from "@/lib/perf-log";
import {
  hashReportPrompt,
  recordStructuredReport,
} from "@/lib/structured-reports/record";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Request body schema.
 *
 * - findings: non-empty; hard-capped at 20_000 chars to keep prompts bounded.
 * - diseaseCategory: one of the registered DiseaseCategory literals. Any other
 *   value is rejected at the zod layer, producing a 400 response without
 *   reaching the prompt dispatcher. The literals are listed explicitly rather
 *   than derived so that adding a category is a deliberate API change.
 * - modality: optional hint routed to the chosen template, which normalizes
 *   values it has no authored guidance for (defaults to 'Auto').
 * - lang: output language for the report body.
 * - provider/model: same provider surface as /api/generate.
 */
const requestSchema = z.object({
  findings: z
    .string()
    .min(1, "Findings text is required")
    .max(20_000, "Findings text exceeds maximum length (20000 characters)"),
  diseaseCategory: z.union([
    z.literal("RCC"),
    z.literal("ProstateCancer"),
    z.literal("UterineMyoma"),
  ]),
  modality: z.enum(["CT", "MRI", "US", "Auto"]).optional(),
  lang: z.enum(["ko", "en", "mixed"]),
  provider: z.enum(["local", "openai", "anthropic", "google"]),
  model: z.string().min(1, "Model identifier is required"),
  // Raw form input, stored alongside the serialized findings. Bounded after
  // serialization so an oversized payload is rejected rather than truncated.
  formState: z
    .unknown()
    .optional()
    .refine(
      (v) => v === undefined || JSON.stringify(v).length <= MAX_FORM_STATE_CHARS,
      `Form state exceeds maximum length (${MAX_FORM_STATE_CHARS} characters)`
    ),
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
    const parsed = requestSchema.safeParse(body);

    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: parsed.error.flatten().fieldErrors }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const {
      findings,
      diseaseCategory,
      modality,
      lang,
      provider,
      model,
      formState,
    } = parsed.data;

    // Privacy: log metadata only. The raw findings text is NEVER serialized.
    const requestMeta = {
      diseaseCategory,
      modality: modality ?? "Auto",
      lang,
      provider,
      model,
      findingsLength: findings.length,
    };

    const apiKey = await resolveApiKey(session.userId, provider as ProviderName);
    const llmModel = getModelWithKey(provider as ProviderName, model, apiKey);

    const systemPrompt = buildReportSystemPrompt({
      diseaseCategory,
      lang,
      modality,
    });

    const userPrompt = buildReportUserPrompt({
      diseaseCategory,
      lang,
      modality,
      findings,
    });

    const promptHash = hashReportPrompt(
      systemPrompt,
      buildReportUserPrompt({
        diseaseCategory,
        lang,
        modality,
        findings: SAMPLE_FINDINGS,
      })
    );

    // Perf instrumentation: t at LLM-call boundary so TTFT excludes auth/parse.
    // `disease` lets us group perf records by disease category in `jq` analysis.
    const tLLMStart = performance.now();
    const modelId = resolvedModelId(provider as ProviderName, model);
    const maxTokensConfig = 2048;
    const baseTags = {
      route: "/api/structured-report/generate",
      provider,
      modelId,
      disease: diseaseCategory,
      modality: modality ?? "Auto",
      lang,
      maxTokensConfig,
    } as const;
    let firstTokenLogged = false;
    let ttftMs: number | null = null;

    const result = streamText({
      model: llmModel,
      system: systemPrompt,
      prompt: userPrompt,
      temperature: 0.3,
      topP: 0.9,
      maxTokens: maxTokensConfig,
      onChunk: ({ chunk }) => {
        if (firstTokenLogged) return;
        if (chunk.type !== "text-delta") return;
        firstTokenLogged = true;
        ttftMs = Math.round(performance.now() - tLLMStart);
        try {
          perfLog({
            perf: "gen",
            stage: "ttft",
            ...baseTags,
            ms: ttftMs,
            preLLMMs: Math.round(tLLMStart - tReq),
          });
        } catch {
          /* observability must never break the stream */
        }
      },
      onFinish: ({ text, usage, finishReason }) => {
        const totalMs = performance.now() - tLLMStart;

        // Durable history row. Written here rather than from the browser so a
        // closed tab cannot lose the record.
        recordStructuredReport({
          userId: session.userId,
          diseaseCategory,
          modality: modality ?? "Auto",
          lang,
          findings,
          formState: formState === undefined ? null : JSON.stringify(formState),
          report: text,
          promptHash,
          provider,
          model: modelId,
          finishReason,
          promptTokens: usage?.promptTokens ?? null,
          completionTokens: usage?.completionTokens ?? null,
          ttftMs,
          totalMs: Math.round(totalMs),
        });

        try {
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
        console.error(
          "[structured-report/generate] streamText error:",
          requestMeta,
          error instanceof Error ? error.message : error
        );
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
