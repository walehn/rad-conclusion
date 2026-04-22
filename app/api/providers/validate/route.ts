import { z } from "zod";
import type { ProviderName } from "@/lib/providers/types";
import { LOCAL_PROVIDER_DEFAULTS } from "@/lib/providers/local-config";
import { requireApiSession } from "@/lib/auth/guard";
import { validateCsrfOrFail } from "@/lib/auth/csrf";

const validateSchema = z.object({
  provider: z.enum(["local", "openai", "anthropic", "google"]),
  apiKey: z.string().min(1, "API key is required"),
  hostUrl: z.string().url().optional(),
});

async function validateLocal(hostUrl: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const res = await fetch(`${hostUrl}/v1/models`, {
      method: "GET",
      signal: AbortSignal.timeout(10000),
    });
    if (res.ok) return { valid: true };
    return { valid: false, error: `Server responded with status ${res.status}` };
  } catch {
    return { valid: false, error: "Could not connect to local server" };
  }
}

async function validateOpenAI(apiKey: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const res = await fetch("https://api.openai.com/v1/models", {
      method: "GET",
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(10000),
    });
    if (res.ok) return { valid: true };
    if (res.status === 401) return { valid: false, error: "Invalid API key" };
    return { valid: false, error: `API responded with status ${res.status}` };
  } catch {
    return { valid: false, error: "Could not connect to OpenAI API" };
  }
}

async function validateAnthropic(apiKey: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1,
        messages: [{ role: "user", content: "hi" }],
      }),
      signal: AbortSignal.timeout(15000),
    });
    // A successful response or a 400 (bad request but authenticated) means key is valid
    if (res.ok || res.status === 400) return { valid: true };
    if (res.status === 401) return { valid: false, error: "Invalid API key" };
    return { valid: false, error: `API responded with status ${res.status}` };
  } catch {
    return { valid: false, error: "Could not connect to Anthropic API" };
  }
}

async function validateGoogle(apiKey: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
      {
        method: "GET",
        signal: AbortSignal.timeout(10000),
      }
    );
    if (res.ok) return { valid: true };
    if (res.status === 400 || res.status === 403)
      return { valid: false, error: "Invalid API key" };
    return { valid: false, error: `API responded with status ${res.status}` };
  } catch {
    return { valid: false, error: "Could not connect to Google AI API" };
  }
}

const validators: Record<
  ProviderName,
  (apiKey: string, hostUrl?: string) => Promise<{ valid: boolean; error?: string }>
> = {
  local: (_apiKey, hostUrl) => validateLocal(hostUrl || LOCAL_PROVIDER_DEFAULTS.host),
  openai: (apiKey) => validateOpenAI(apiKey),
  anthropic: (apiKey) => validateAnthropic(apiKey),
  google: (apiKey) => validateGoogle(apiKey),
};

export async function POST(req: Request) {
  const { response } = await requireApiSession();
  if (response) return response;

  const csrfFailure = await validateCsrfOrFail(req);
  if (csrfFailure) return csrfFailure;

  try {
    const body = await req.json();
    const parsed = validateSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { valid: false, error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { provider, apiKey, hostUrl } = parsed.data;
    const result = await validators[provider](apiKey, hostUrl);

    return Response.json(result);
  } catch {
    return Response.json(
      { valid: false, error: "Validation request failed" },
      { status: 500 }
    );
  }
}
