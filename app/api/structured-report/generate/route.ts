/**
 * POST /api/structured-report/generate
 *
 * SSE streaming endpoint for the Structured Report Generator
 * (SPEC-DASHBOARD-001). v0.1.0 supports the Renal Cell Carcinoma (RCC)
 * disease category only; requests for any other category are rejected
 * with HTTP 400.
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
 */

import { streamText } from "ai";
import { z } from "zod";
import { getModelWithKey } from "@/lib/providers/registry";
import type { ProviderName } from "@/lib/providers/types";
import {
  buildReportSystemPrompt,
  buildReportUserPrompt,
} from "@/lib/prompts/structured-report-prompt";
import { requireApiSession } from "@/lib/auth/guard";
import { validateCsrfOrFail } from "@/lib/auth/csrf";
import { resolveApiKey } from "@/lib/api-keys/resolve";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Request body schema.
 *
 * - findings: non-empty; hard-capped at 20_000 chars to keep prompts bounded.
 * - diseaseCategory: v0.1.0 fixed to the literal 'RCC'. Any other value
 *   (e.g., 'HCC', 'ProstateCancer') is rejected at the zod layer, producing
 *   a 400 response without reaching the prompt dispatcher.
 * - modality: optional hint routed to the RCC template (defaults to 'Auto').
 * - lang: output language for the report body.
 * - provider/model: same provider surface as /api/generate.
 */
const requestSchema = z.object({
  findings: z
    .string()
    .min(1, "Findings text is required")
    .max(20_000, "Findings text exceeds maximum length (20000 characters)"),
  diseaseCategory: z.literal("RCC"),
  modality: z.enum(["CT", "MRI", "US", "Auto"]).optional(),
  lang: z.enum(["ko", "en", "mixed"]),
  provider: z.enum(["local", "openai", "anthropic", "google"]),
  model: z.string().min(1, "Model identifier is required"),
});

export async function POST(req: Request) {
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

    const { findings, diseaseCategory, modality, lang, provider, model } =
      parsed.data;

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

    const result = streamText({
      model: llmModel,
      system: systemPrompt,
      prompt: userPrompt,
      temperature: 0.3,
      topP: 0.9,
      maxTokens: 2048,
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
