"use client";

import * as React from "react";
import { Send, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { TabbedFindingsInput } from "@/components/tabbed-findings-input";
import type { ActiveTab } from "@/components/tabbed-findings-input";
import { ModelSelector } from "@/components/model-selector";
import { DiseaseCategoryIndicator } from "@/components/disease-category-indicator";
import { StructuredReportOutput } from "@/components/structured-report-output";
import {
  serializeRccStructuredInput,
} from "@/lib/prompts/disease-templates/rcc-serializer";
import type { RccStructuredInput } from "@/lib/prompts/disease-templates/rcc-serializer";
import { loadProviderSettings } from "@/lib/storage/settings-store";
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
import { cn } from "@/lib/utils";

const DISEASE_CATEGORY: DiseaseCategory = "RCC";

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
const SESSION_KEY_ACTIVE_TAB = "rad:srep:active-tab";

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

export function StructuredReportClient() {
  const [freeTextFindings, setFreeTextFindings] = React.useState("");
  const [structuredInput, setStructuredInput] = React.useState<RccStructuredInput>({});
  const [activeTab, setActiveTab] = React.useState<ActiveTab>("free-text");
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
      const savedTab = sessionStorage.getItem(SESSION_KEY_ACTIVE_TAB);
      if (savedProvider) setProvider(savedProvider as ProviderName);
      if (savedModel) setModel(savedModel);
      if (savedTab === "free-text" || savedTab === "rcc-structured") {
        setActiveTab(savedTab);
      }
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

  React.useEffect(() => {
    try {
      sessionStorage.setItem(SESSION_KEY_ACTIVE_TAB, activeTab);
    } catch {
      /* noop */
    }
  }, [activeTab]);

  // --- Generation handler --------------------------------------------------
  const handleGenerate = React.useCallback(async () => {
    const findingsText =
      activeTab === "rcc-structured"
        ? serializeRccStructuredInput(structuredInput)
        : freeTextFindings.trim();

    if (activeTab === "free-text" && !findingsText) {
      setInputError("Please enter the Findings text.");
      return;
    }
    setInputError("");
    setApiError(null);
    setContent("");
    setElapsedMs(null);

    const controller = new AbortController();
    abortRef.current = controller;
    setIsStreaming(true);
    const startedAt = performance.now();

    try {
      const response = await fetch("/api/structured-report/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": getCsrfToken(),
        },
        body: JSON.stringify({
          findings: findingsText,
          diseaseCategory: DISEASE_CATEGORY,
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
      abortRef.current = null;
    }
  }, [freeTextFindings, structuredInput, activeTab, modality, lang, provider, model]);

  const handleCancel = React.useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const handleRetry = React.useCallback(() => {
    setApiError(null);
    void handleGenerate();
  }, [handleGenerate]);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6">
        <div>
          <DiseaseCategoryIndicator
            category={DISEASE_CATEGORY}
            variant="overline"
            index={1}
          />
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            구조화 리포트 생성기
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Findings 텍스트로부터 6개 섹션(CLINICAL INFORMATION /
            TECHNIQUE / COMPARISON / FINDINGS / STAGING / IMPRESSION)으로
            구조화된 리포트를 생성합니다.
          </p>
        </div>
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
                >
                  Modality hint
                </label>
                <div
                  role="radiogroup"
                  aria-labelledby="modality-hint-label"
                  className="inline-flex rounded-full bg-muted/50 p-1"
                >
                  {MODALITY_OPTIONS.map((opt) => {
                    const active = modality === opt;
                    return (
                      <button
                        key={opt}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => setModality(opt)}
                        className={cn(
                          "rounded-full px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                          active
                            ? "bg-background text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
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
              <TabbedFindingsInput
                freeTextValue={freeTextFindings}
                onFreeTextChange={(v) => {
                  setFreeTextFindings(v);
                  if (inputError) setInputError("");
                }}
                freeTextError={inputError}
                structuredValue={structuredInput}
                onStructuredChange={setStructuredInput}
                activeTab={activeTab}
                onActiveTabChange={(tab) => {
                  setActiveTab(tab);
                  if (inputError) setInputError("");
                }}
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
                  disabled={activeTab === "free-text" && !freeTextFindings.trim()}
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
            error={apiError}
            onRetry={handleRetry}
          />
        </div>
      </div>
    </div>
  );
}
