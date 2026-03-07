import { streamText } from "ai";
import { z } from "zod";
import { getModel } from "@/lib/providers/registry";
import { buildSystemPrompt, buildUserPrompt } from "@/lib/prompts/system-prompt";
import type { ProviderName } from "@/lib/providers/types";
import type { ConclusionStyle, ConclusionLang } from "@/lib/prompts/system-prompt";

const requestSchema = z.object({
  findings: z.string().min(1, "Findings text is required"),
  style: z.enum(["numbered", "short", "urgent-first"]).default("numbered"),
  lang: z.enum(["ko", "en", "mixed"]).default("en"),
  title: z.string().default("Conclusion"),
  provider: z
    .enum(["local", "openai", "anthropic", "google"])
    .default("local"),
  model: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = requestSchema.safeParse(body);

    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: parsed.error.flatten().fieldErrors }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const { findings, style, lang, title, provider, model } = parsed.data;

    const llmModel = getModel(provider as ProviderName, model);

    const systemPrompt = buildSystemPrompt({
      style: style as ConclusionStyle,
      lang: lang as ConclusionLang,
      title,
    });

    const userPrompt = buildUserPrompt({ findings, title });

    const result = streamText({
      model: llmModel,
      system: systemPrompt,
      prompt: userPrompt,
      temperature: 0.3,
      topP: 0.9,
    });

    return result.toDataStreamResponse();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Internal server error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
