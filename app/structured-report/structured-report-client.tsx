"use client";

import * as React from "react";
import Link from "next/link";
import { Send, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { RccStructuredForm } from "@/components/rcc-structured-form";
import { ModelSelector } from "@/components/model-selector";
import { DiseaseCategoryIndicator } from "@/components/disease-category-indicator";
import { ReferencesDialog } from "@/components/references-dialog";
import { StructuredReportOutput } from "@/components/structured-report-output";
import { getDiseaseCategoryMetadata } from "@/lib/prompts/disease-registry";
import {
  hasMinimumStructuredFields,
  serializeRccStructuredInput,
} from "@/lib/prompts/disease-templates/rcc-serializer";
import type { RccStructuredInput } from "@/lib/prompts/disease-templates/rcc-serializer";
import { loadProviderSettings } from "@/lib/storage/settings-store";
import { genClientId } from "@/lib/utils";
import type { DiseaseCategory } from "@/lib/prompts/disease-registry";
import type {
  RccModality,
  RccReportLang,
} from "@/lib/prompts/disease-templates/rcc";
import type {
  ProviderInfo,
  ProviderName,
  ProviderSettings,
} from "@/lib/providers/types";
import { LOCAL_PROVIDER_DEFAULTS } from "@/lib/providers/local-config";
import {
  SegmentedControl,
  toSegmentedOptions,
} from "@/components/ui/segmented-control";

const MODALITY_OPTIONS: readonly RccModality[] = [
  "Auto",
  "CT",
  "MRI",
  "US",
] as const;

const LANG_OPTIONS: ReadonlyArray<{ value: RccReportLang; label: string }> = [
  { value: "en", label: "English" },
  { value: "ko", label: "한국어" },
  { value: "mixed", label: "Mixed (해부 용어 영어 + 설명 한국어)" },
];

const SESSION_KEY_PROVIDER = "rad:last-provider";
const SESSION_KEY_MODEL = "rad:last-model";

function getCsrfToken(): string {
  return (
    document.cookie
      .split("; ")
      .find((c) => c.startsWith("csrf_token="))
      ?.split("=")[1] ?? ""
  );
}

/**
 * Parse an AI SDK v4 data-stream line such as `0:"hello"` and append the
 * decoded text chunk to the accumulator. Non-text prefixes (1/2/3/8/9/d/e)
 * carry tool-call, step, and finish metadata that the structured report UI
 * does not need to render inline. Error prefixes surface via the error
 * channel returned from the fetch response itself (non-200 status).
 */
function appendStreamChunk(accumulated: string, rawLine: string): string {
  if (!rawLine) return accumulated;
  const colonIdx = rawLine.indexOf(":");
  if (colonIdx <= 0) return accumulated;
  const prefix = rawLine.slice(0, colonIdx);
  const payload = rawLine.slice(colonIdx + 1);
  if (prefix !== "0") return accumulated;
  try {
    const decoded = JSON.parse(payload);
    if (typeof decoded === "string") return accumulated + decoded;
  } catch {
    // Malformed payload — skip silently; subsequent chunks may still be valid.
  }
  return accumulated;
}

export function StructuredReportClient({ disease }: { disease: DiseaseCategory }) {
  const [structuredInput, setStructuredInput] = React.useState<RccStructuredInput>(
    () => ({ masses: [{ id: genClientId() }] })
  );
  const [modality, setModality] = React.useState<RccModality>("Auto");
  const [lang, setLang] = React.useState<RccReportLang>("en");
  const [provider, setProvider] = React.useState<ProviderName>("local");
  const [model, setModel] = React.useState<string>(
    LOCAL_PROVIDER_DEFAULTS.modelId
  );
  const [providers, setProviders] = React.useState<ProviderInfo[]>([]);
  const [, setClientSettings] = React.useState<ProviderSettings[]>([]);
  const [inputError, setInputError] = React.useState("");
  const [content, setContent] = React.useState("");
  const [isStreaming, setIsStreaming] = React.useState(false);
  const [elapsedMs, setElapsedMs] = React.useState<number | null>(null);
  const [streamStartedAt, setStreamStartedAt] = React.useState<number | null>(null);
  const [apiError, setApiError] = React.useState<string | null>(null);
  const abortRef = React.useRef<AbortController | null>(null);

  // --- Provider / Model refresh (mirrors ConclusionClient) -----------------
  const refreshProviders = React.useCallback(async () => {
    try {
      const [serverRes, localSettings] = await Promise.all([
        fetch("/api/providers").then(
          (r) => r.json() as Promise<ProviderInfo[]>
        ),
        loadProviderSettings(),
      ]);

      setClientSettings(localSettings);

      const merged = serverRes.map((sp) => {
        const cs = localSettings.find((c) => c.id === sp.name);
        const clientAvailable =
          cs?.enabled &&
          (cs.id === "local" ? !!cs.hostUrl : !!cs.apiKey);
        return {
          ...sp,
          available: sp.available || !!clientAvailable,
        };
      });

      setProviders(merged);

      // Respect the caller's current selection when available; otherwise fall
      // back to the first available provider/model combination.
      const currentAvailable = merged.find(
        (p) => p.name === provider && p.available
      );
      if (!currentAvailable) {
        const firstAvailable = merged.find((p) => p.available);
        if (firstAvailable) {
          setProvider(firstAvailable.name);
          setModel(firstAvailable.defaultModel);
        }
      }
    } catch {
      // Keep defaults if the providers endpoint is unavailable.
    }
  }, [provider]);

  // --- sessionStorage provider/model sync per REQ-SREP --------------------
  // Initial hydration: read last-used provider/model so they persist across
  // page switches between /conclusion and /structured-report within a session.
  React.useEffect(() => {
    try {
      const savedProvider = sessionStorage.getItem(SESSION_KEY_PROVIDER);
      const savedModel = sessionStorage.getItem(SESSION_KEY_MODEL);
      if (savedProvider) setProvider(savedProvider as ProviderName);
      if (savedModel) setModel(savedModel);
    } catch {
      // sessionStorage unavailable (private mode, SSR boundary) — ignore.
    }
    // Intentionally run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    refreshProviders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    try {
      sessionStorage.setItem(SESSION_KEY_PROVIDER, provider);
    } catch {
      /* noop */
    }
  }, [provider]);

  React.useEffect(() => {
    try {
      sessionStorage.setItem(SESSION_KEY_MODEL, model);
    } catch {
      /* noop */
    }
  }, [model]);

  // --- Generation handler --------------------------------------------------
  const handleGenerate = React.useCallback(async () => {
    if (!hasMinimumStructuredFields(structuredInput)) {
      setInputError(
        "Please complete the structured input (Side and Mass size are required for each mass)."
      );
      return;
    }
    const findingsText = serializeRccStructuredInput(structuredInput);
    setInputError("");
    setApiError(null);
    setContent("");
    setElapsedMs(null);

    const controller = new AbortController();
    abortRef.current = controller;
    setIsStreaming(true);
    const startedAt = performance.now();
    setStreamStartedAt(startedAt);

    try {
      const response = await fetch("/api/structured-report/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": getCsrfToken(),
        },
        body: JSON.stringify({
          findings: findingsText,
          diseaseCategory: disease,
          modality,
          lang,
          provider,
          model,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        let message = `HTTP ${response.status}`;
        try {
          const body = (await response.json()) as { error?: unknown };
          if (body?.error) {
            message =
              typeof body.error === "string"
                ? body.error
                : JSON.stringify(body.error);
          }
        } catch {
          const text = await response.text().catch(() => "");
          if (text) message = text;
        }
        throw new Error(message);
      }

      if (!response.body) {
        throw new Error("Empty response body from stream endpoint");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          accumulated = appendStreamChunk(accumulated, line);
        }
        setContent(accumulated);
      }

      // Drain any trailing partial line.
      if (buffer) {
        accumulated = appendStreamChunk(accumulated, buffer);
        setContent(accumulated);
      }

      setElapsedMs(performance.now() - startedAt);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        // User-initiated cancellation: keep whatever partial content arrived.
        setElapsedMs(performance.now() - startedAt);
        return;
      }
      setApiError(
        err instanceof Error
          ? err.message
          : "An unknown error occurred while generating."
      );
    } finally {
      setIsStreaming(false);
      setStreamStartedAt(null);
      abortRef.current = null;
    }
  }, [structuredInput, modality, lang, provider, model]);

  const handleCancel = React.useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const handleRetry = React.useCallback(() => {
    setApiError(null);
    void handleGenerate();
  }, [handleGenerate]);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Back link to the disease selector landing page (SPEC-DISEASE-SELECTOR-001). */}
      <Link
        href="/structured-report"
        aria-label="질병 선택 페이지로 돌아가기"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground hover:underline transition-colors mb-3"
      >
        <span aria-hidden="true">←</span>
        다른 질병 선택
      </Link>
      {/* Page hero — split into two stacked cards.

          Card 1 = the "current disease" selector strip. Designed to scale to
          multiple diseases later (RCC = #1, future categories = #2, #3, …);
          rendered at body-text scale via the `hero` indicator variant + `lg`
          Sources trigger so it does not read as a footnote.

          Card 2 = the page H1 banner. Carries the semantic <h1> page heading.
          The previous "Findings 텍스트로부터..." description paragraph was
          removed at user request. We intentionally use a raw <h1> rather than
          CardTitle because CardTitle renders a <div> in this codebase, which
          would erase page-heading semantics for AT / SEO.

          Both cards live inside a single <header> landmark so the entire hero
          region remains addressable as a banner by assistive tech. */}
      <header className="mb-6 flex flex-col gap-4">
        <Card className="shadow-sm ring-1 ring-border/50">
          <CardContent className="py-5">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              구조화 리포트 생성기
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              6개 섹션(CLINICAL INFORMATION / TECHNIQUE / COMPARISON /
              FINDINGS / STAGING / IMPRESSION)으로 구조화된 리포트를
              생성합니다.
            </p>
          </CardContent>
        </Card>
        <Card className="shadow-sm ring-1 ring-border/50">
          <CardContent className="flex flex-wrap items-center justify-between gap-4 py-5">
            <DiseaseCategoryIndicator
              category={disease}
              variant="hero"
              index={1}
            />
            <ReferencesDialog
              size="lg"
              citations={getDiseaseCategoryMetadata(disease).standardReferences}
            />
          </CardContent>
        </Card>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left column — inputs */}
        <div className="flex flex-col gap-6">
          <Card className="shadow-sm ring-1 ring-border/50">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-semibold">
                Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <ModelSelector
                providers={providers}
                selectedProvider={provider}
                selectedModel={model}
                onProviderChange={setProvider}
                onModelChange={setModel}
              />

              <div>
                <label
                  className="mb-1.5 block text-sm font-medium text-foreground"
                  id="modality-hint-label"
                  htmlFor="modality-hint-control"
                >
                  Modality hint
                </label>
                <SegmentedControl
                  name="modality-hint-control"
                  ariaLabel="Modality hint"
                  size="sm"
                  value={modality}
                  options={toSegmentedOptions(MODALITY_OPTIONS)}
                  onChange={(opt) => setModality(opt)}
                />
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Auto: 입력 텍스트에서 modality를 자동 유추합니다. 구체적인
                  modality를 선택하면 프롬프트에 hint로 전달됩니다.
                </p>
              </div>

              <div className="min-w-[200px]">
                <Select
                  id="lang"
                  label="Output language"
                  value={lang}
                  onChange={(e) =>
                    setLang(e.target.value as RccReportLang)
                  }
                >
                  {LANG_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm ring-1 ring-border/50">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-semibold">Findings</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <RccStructuredForm
                value={structuredInput}
                onChange={(next) => {
                  setStructuredInput(next);
                  if (inputError) setInputError("");
                }}
                error={inputError}
              />
              {isStreaming ? (
                <Button
                  onClick={handleCancel}
                  variant="outline"
                  className="w-full"
                  size="lg"
                >
                  <Square className="mr-2 h-4 w-4" />
                  Cancel generation
                </Button>
              ) : (
                <Button
                  onClick={handleGenerate}
                  disabled={!hasMinimumStructuredFields(structuredInput)}
                  className="w-full bg-gradient-to-r from-primary to-primary/90 shadow-md shadow-primary/20 transition-all hover:shadow-lg hover:shadow-primary/30 disabled:from-muted disabled:to-muted disabled:shadow-none"
                  size="lg"
                >
                  <Send className="mr-2 h-4 w-4" />
                  Generate structured report
                </Button>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right column — streaming output */}
        <div className="flex flex-col gap-4">
          <StructuredReportOutput
            content={content}
            isStreaming={isStreaming}
            elapsedMs={elapsedMs}
            streamStartedAt={streamStartedAt}
            error={apiError}
            onRetry={handleRetry}
          />
        </div>
      </div>
    </div>
  );
}
