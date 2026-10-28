// lib/eval/judges.ts
// The models that grade conclusions.
//
// Two judges on purpose: the local one never sends data off the machine but
// is the same model that wrote the conclusions (self-preference bias); the
// external one is stronger and independent but sees de-identified text.
// Their agreement is itself a metric — see lib/eval/report.ts.
//
// Model ids are pinned, never "-latest" aliases: a silent judge upgrade would
// show up as a quality trend that the generator never caused.

import { createOpenAI } from "@ai-sdk/openai";
import { createGoogle } from "@ai-sdk/google";
import { generateText, type LanguageModel } from "ai";
import { LOCAL_MODELS } from "@/lib/providers/local-config";
import { deidentify } from "./deidentify";
import {
  JUDGE_SYSTEM_PROMPT,
  buildJudgeUserPrompt,
  parseJudgment,
  type Judgment,
} from "./judge-prompt";

export interface JudgeSpec {
  /** Stored with every judgment: "<provider>:<model>". */
  id: string;
  /** Whether input leaves this machine. */
  external: boolean;
  createModel: () => LanguageModel;
  temperature?: number;
  maxOutputTokens: number;
}

const LOCAL_JUDGE_MODEL = "deepseek-v4-flash-0731";
const GEMINI_JUDGE_MODEL = "gemini-3.1-pro-preview";

function localJudgeModel(): LanguageModel {
  const entry = LOCAL_MODELS.find((m) => m.id === LOCAL_JUDGE_MODEL);
  if (!entry) throw new Error(`${LOCAL_JUDGE_MODEL} is not in LOCAL_MODELS`);
  const host = process.env[entry.hostEnvVar] || entry.host;
  // Grading benefits from reasoning, unlike the latency-bound generate path,
  // so thinking is switched on through the chat template. The reasoning
  // channel is dropped by the SDK; only the final JSON comes back.
  const withThinking: typeof fetch = (input, init) => {
    if (init?.body && typeof init.body === "string") {
      const body = JSON.parse(init.body);
      body.chat_template_kwargs = { ...(body.chat_template_kwargs ?? {}), thinking: true };
      init = { ...init, body: JSON.stringify(body) };
    }
    return fetch(input, init);
  };
  return createOpenAI({
    baseURL: host + "/v1",
    apiKey: "not-needed",
    fetch: withThinking,
  }).chat(entry.id);
}

function geminiJudgeModel(): LanguageModel {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_AI_API_KEY is not set");
  return createGoogle({ apiKey })(GEMINI_JUDGE_MODEL);
}

export const JUDGES: Record<string, JudgeSpec> = {
  local: {
    id: `local:${LOCAL_JUDGE_MODEL}`,
    external: false,
    createModel: localJudgeModel,
    temperature: 0,
    maxOutputTokens: 16000,
  },
  // Gemini 3 is tuned for its default temperature and lowering it is
  // documented to cause looping. AI SDK 4 nevertheless sent 0 when none was
  // set, so every stored Gemini judgment was graded at 0; it stays explicit
  // to keep judgments comparable now that the SDK leaves it unset.
  gemini: {
    id: `google:${GEMINI_JUDGE_MODEL}`,
    external: true,
    createModel: geminiJudgeModel,
    temperature: 0,
    maxOutputTokens: 16000,
  },
};

export interface JudgeOutcome {
  judgment: Judgment;
  raw: string;
  latencyMs: number;
  inputTokens: number | null;
  outputTokens: number | null;
}

/** De-identified judge input. Both judges get the same text. */
export function judgeInput(findings: string, conclusion: string) {
  const { texts, replaced } = deidentify([findings, conclusion]);
  return {
    system: JUDGE_SYSTEM_PROMPT,
    prompt: buildJudgeUserPrompt(texts[0], texts[1]),
    replaced,
  };
}

/**
 * Grades one conclusion. Throws with the raw reply attached when the model
 * output is not a valid judgment, so the caller can store it for inspection.
 */
export async function runJudge(
  spec: JudgeSpec,
  findings: string,
  conclusion: string,
  timeoutMs = 300_000
): Promise<JudgeOutcome> {
  const { system, prompt } = judgeInput(findings, conclusion);
  const t0 = performance.now();
  const res = await generateText({
    model: spec.createModel(),
    instructions: system,
    prompt,
    temperature: spec.temperature,
    maxOutputTokens: spec.maxOutputTokens,
    maxRetries: 2,
    abortSignal: AbortSignal.timeout(timeoutMs),
  });
  const latencyMs = Math.round(performance.now() - t0);
  try {
    return {
      judgment: parseJudgment(res.text),
      raw: res.text,
      latencyMs,
      inputTokens: res.usage?.inputTokens ?? null,
      outputTokens: res.usage?.outputTokens ?? null,
    };
  } catch (error) {
    throw new JudgeParseError(
      `${error instanceof Error ? error.message : String(error)} (finish: ${res.finishReason})`,
      res.text
    );
  }
}

export class JudgeParseError extends Error {
  constructor(message: string, readonly raw: string) {
    super(message);
    this.name = "JudgeParseError";
  }
}
