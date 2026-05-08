"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Send,
  Square,
  Search,
  ChevronRight,
  FileText,
  Plus,
  Hash,
  Clock,
  ArrowRight,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  ClipboardList,
  Stethoscope,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import {
  notionTokens,
  C,
  SidebarSection,
  SidebarItem,
  Block,
  CalloutBlock,
  OutputBlock,
  PropRow,
  EmojiPickerTrigger,
  REPORT_EMOJI,
} from "@/components/notion-tone";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  diseaseCategoryToSlug,
} from "@/lib/prompts/disease-registry";
import { RccStructuredForm } from "@/components/rcc-structured-form";
import {
  ProstateStructuredForm,
  createEmptyProstateInput,
} from "@/components/prostate-structured-form";
import { ModelSelector } from "@/components/model-selector";
import { DiseaseCategoryIndicator } from "@/components/disease-category-indicator";
import { ReferencesDialog } from "@/components/references-dialog";
import { StructuredReportOutput } from "@/components/structured-report-output";
import {
  DISEASE_REGISTRY,
  getDiseaseCategoryMetadata,
} from "@/lib/prompts/disease-registry";
import {
  getMissingRccFields,
  hasMinimumStructuredFields,
  serializeRccStructuredInput,
} from "@/lib/prompts/disease-templates/rcc-serializer";
import type { RccStructuredInput } from "@/lib/prompts/disease-templates/rcc-serializer";
import {
  getMissingProstateFields,
  hasMinimumProstateFields,
  serializeProstateStructuredInput,
} from "@/lib/prompts/disease-templates/prostate-serializer";
import type { ProstateStructuredInput } from "@/lib/prompts/disease-templates/prostate-serializer";
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
  if (typeof document === "undefined") return "";
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

/**
 * Discriminated union of per-disease form state.
 *
 * The route renders one disease at a time (per `[disease]` slug), so the
 * `kind` discriminator is invariant for the lifetime of a mounted client.
 * Using a union (rather than two parallel state slots) means TypeScript
 * narrows `input` to the correct type on every read, and forgetting a new
 * disease in `serialize` / `hasMinimum` / form rendering becomes a compile
 * error rather than a runtime mismatch.
 */
type StructuredFormState =
  | { kind: "RCC"; input: RccStructuredInput }
  | { kind: "ProstateCancer"; input: ProstateStructuredInput };

function createInitialFormState(disease: DiseaseCategory): StructuredFormState {
  switch (disease) {
    case "RCC":
      return { kind: "RCC", input: { masses: [{ id: genClientId() }] } };
    case "ProstateCancer":
      return { kind: "ProstateCancer", input: createEmptyProstateInput() };
  }
}

function hasMinimumFormFields(state: StructuredFormState): boolean {
  switch (state.kind) {
    case "RCC":
      return hasMinimumStructuredFields(state.input);
    case "ProstateCancer":
      return hasMinimumProstateFields(state.input);
  }
}

/**
 * Disease-aware dispatcher returning the list of currently-missing required
 * fields, with user-facing Korean labels. Empty list means the form is ready
 * for submission. Used by the UI to render an inline checklist above the
 * Generate button when it would otherwise be silently disabled.
 */
function getMissingFormFields(state: StructuredFormState): string[] {
  switch (state.kind) {
    case "RCC":
      return getMissingRccFields(state.input);
    case "ProstateCancer":
      return getMissingProstateFields(state.input);
  }
}

function serializeFormFindings(state: StructuredFormState): string {
  switch (state.kind) {
    case "RCC":
      return serializeRccStructuredInput(state.input);
    case "ProstateCancer":
      return serializeProstateStructuredInput(state.input);
  }
}

function getMinimumFieldsErrorMessage(disease: DiseaseCategory): string {
  switch (disease) {
    case "RCC":
      return "Please complete the structured input (Side and Mass size are required for each mass).";
    case "ProstateCancer":
      return "Please complete the structured input (PSA, prostate volume, PI-QUAL overall, and at least one lesion with T2W/DWI scores and a sector are required).";
  }
}

export function StructuredReportClient({ disease }: { disease: DiseaseCategory }) {
  const [formState, setFormState] = React.useState<StructuredFormState>(
    () => createInitialFormState(disease)
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
    if (!hasMinimumFormFields(formState)) {
      setInputError(getMinimumFieldsErrorMessage(disease));
      return;
    }
    const findingsText = serializeFormFindings(formState);
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
  }, [formState, disease, modality, lang, provider, model]);

  const handleCancel = React.useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const handleRetry = React.useCallback(() => {
    setApiError(null);
    void handleGenerate();
  }, [handleGenerate]);

  // ── Notion-tone UX state (sidebar collapse, page emoji) ──────
  const router = useRouter();
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);
  const [pageEmoji, setPageEmoji] = React.useState<string | null>("📋");
  const [emojiPickerOpen, setEmojiPickerOpen] = React.useState(false);
  const [hydrated, setHydrated] = React.useState(false);

  React.useEffect(() => {
    try {
      const c = localStorage.getItem("radc.sidebar-collapsed");
      if (c === "1") setSidebarCollapsed(true);
      const e = localStorage.getItem("radc.reports-page-emoji");
      if (e) setPageEmoji(e);
    } catch {}
    setHydrated(true);
  }, []);

  React.useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(
        "radc.sidebar-collapsed",
        sidebarCollapsed ? "1" : "0",
      );
    } catch {}
  }, [sidebarCollapsed, hydrated]);

  React.useEffect(() => {
    if (!hydrated) return;
    try {
      if (pageEmoji)
        localStorage.setItem("radc.reports-page-emoji", pageEmoji);
      else localStorage.removeItem("radc.reports-page-emoji");
    } catch {}
  }, [pageEmoji, hydrated]);

  // Disease registry projection for the sidebar Templates section.
  const diseaseEntries = React.useMemo(
    () =>
      (Object.keys(DISEASE_REGISTRY) as DiseaseCategory[]).map((cat) => ({
        category: cat,
        slug: diseaseCategoryToSlug(cat),
        meta: DISEASE_REGISTRY[cat],
      })),
    [],
  );

  const meta = getDiseaseCategoryMetadata(disease);
  const langLabel =
    LANG_OPTIONS.find((o) => o.value === lang)?.label ?? lang;
  const missingFields = !isStreaming ? getMissingFormFields(formState) : [];

  return (
    <div
      className="min-h-screen"
      style={{ ...notionTokens, background: C.canvas }}
    >
      <div
        className={
          sidebarCollapsed
            ? "grid"
            : "grid lg:grid-cols-[260px_minmax(0,1fr)]"
        }
      >
        {/* ── Workspace sidebar ─────────────────────────────── */}
        {!sidebarCollapsed && (
          <aside
            className="hidden border-r lg:block"
            style={{
              background: C.surfaceSoft,
              borderColor: C.hairlineSoft,
              position: "sticky",
              top: 56,
              alignSelf: "flex-start",
              height: "calc(100vh - 56px)",
              overflowY: "auto",
            }}
          >
            <div className="flex h-full flex-col px-3 py-4 text-[14px]">
              <div
                className="group flex items-center gap-2 rounded-md px-2 py-1.5"
                style={{ color: C.charcoal }}
              >
                <span
                  className="grid h-6 w-6 place-items-center rounded-md"
                  style={{
                    background: C.accentBg,
                    color: C.primary,
                    fontWeight: 700,
                    fontSize: 12,
                  }}
                >
                  R
                </span>
                <div className="leading-tight">
                  <div className="font-medium" style={{ color: C.charcoal }}>
                    Radiology
                  </div>
                  <div className="text-[11px]" style={{ color: C.steel }}>
                    Workspace
                  </div>
                </div>
                <button
                  type="button"
                  aria-label="Collapse sidebar"
                  onClick={() => setSidebarCollapsed(true)}
                  className="ml-auto rounded p-1 transition-opacity hover:bg-[#ece8f7]"
                  style={{ color: C.steel }}
                  title="Collapse sidebar"
                >
                  <PanelLeftClose className="h-4 w-4" />
                </button>
              </div>

              <div
                className="mt-3 flex items-center gap-2 rounded-md px-2 py-1.5"
                style={{ background: C.surface, color: C.steel }}
              >
                <Search className="h-3.5 w-3.5" />
                <span className="text-[13px]">Search…</span>
                <span
                  className="ml-auto rounded px-1.5 py-0.5 text-[10px]"
                  style={{ background: C.canvas, color: C.steel }}
                >
                  ⌘K
                </span>
              </div>

              <SidebarSection title="Quick access" mt={10}>
                <SidebarItem
                  icon={<Stethoscope className="h-3.5 w-3.5" />}
                  onClick={() => router.push("/conclusion")}
                >
                  New conclusion
                </SidebarItem>
                <SidebarItem
                  icon={<ClipboardList className="h-3.5 w-3.5" />}
                  onClick={() => router.push("/structured-report")}
                >
                  Structured reports
                </SidebarItem>
                <SidebarItem icon={<FileText className="h-3.5 w-3.5" />}>
                  Drafts
                </SidebarItem>
                <SidebarItem icon={<Clock className="h-3.5 w-3.5" />}>
                  Recent
                </SidebarItem>
              </SidebarSection>

              <SidebarSection
                title="Templates"
                mt={6}
                action={<Plus className="h-3.5 w-3.5" />}
              >
                {diseaseEntries.map(({ category, slug, meta: m }) => (
                  <SidebarItem
                    key={category}
                    active={category === disease}
                    icon={
                      <Hash
                        className="h-3.5 w-3.5"
                        style={{
                          color:
                            category === disease ? C.primary : C.stone,
                        }}
                      />
                    }
                    onClick={() =>
                      router.push(`/structured-report/${slug}`)
                    }
                  >
                    {m.displayNameKo}
                  </SidebarItem>
                ))}
              </SidebarSection>

              <div className="mt-auto flex items-center gap-1 pt-4">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start gap-2"
                  onClick={() => router.push("/settings")}
                  style={{ color: C.steel }}
                >
                  <Settings className="h-4 w-4" />
                  Settings
                </Button>
                <ThemeToggle />
              </div>
            </div>
          </aside>
        )}

        {/* ── Main page area ────────────────────────────────── */}
        <main
          className="px-4 sm:px-8 lg:px-14"
          style={{ background: C.canvas }}
        >
          {sidebarCollapsed && (
            <button
              type="button"
              aria-label="Open sidebar"
              onClick={() => setSidebarCollapsed(false)}
              className="hidden lg:flex items-center gap-1.5 mt-4 -ml-2 rounded-md px-2 py-1 text-[12px] transition-colors hover:bg-[#f0eeec]"
              style={{ color: C.steel }}
            >
              <PanelLeftOpen className="h-4 w-4" />
              <span>Open sidebar</span>
            </button>
          )}

          <div className="mx-auto max-w-6xl py-10">
            {/* Breadcrumb */}
            <nav
              className="flex items-center gap-1.5 text-[12px]"
              style={{ color: C.steel }}
            >
              <Link href="/structured-report" style={{ color: C.steel }}>
                Workspace
              </Link>
              <ChevronRight className="h-3 w-3" />
              <Link
                href="/structured-report"
                className="hover:underline"
                style={{ color: C.steel }}
              >
                Structured reports
              </Link>
              <ChevronRight className="h-3 w-3" />
              <span style={{ color: C.charcoal }}>{meta.displayNameKo}</span>
            </nav>

            <EmojiPickerTrigger
              emoji={pageEmoji}
              open={emojiPickerOpen}
              onOpenChange={setEmojiPickerOpen}
              onSelect={(e) => {
                setPageEmoji(e);
                setEmojiPickerOpen(false);
              }}
              onClear={() => {
                setPageEmoji(null);
                setEmojiPickerOpen(false);
              }}
              fallback={
                <ClipboardList
                  className="h-7 w-7"
                  style={{ color: C.charcoal }}
                />
              }
              emojis={REPORT_EMOJI}
              popoverLabel="Report icons"
            />

            <h1
              className="mt-4 text-balance"
              style={{
                fontSize: 44,
                fontWeight: 700,
                lineHeight: 1.15,
                letterSpacing: "-0.6px",
                color: C.ink,
              }}
            >
              {meta.displayNameKo} 구조화 리포트
            </h1>
            <p
              className="mt-2 text-[15px]"
              style={{ color: C.slate, lineHeight: 1.55 }}
            >
              6개 섹션(CLINICAL INFORMATION / TECHNIQUE / COMPARISON /
              FINDINGS / STAGING / IMPRESSION)으로 구조화된 리포트를
              생성합니다.
            </p>

            {/* Disease indicator inline + References dialog */}
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <DiseaseCategoryIndicator
                category={disease}
                variant="hero"
                index={
                  (Object.keys(DISEASE_REGISTRY) as DiseaseCategory[]).indexOf(
                    disease,
                  ) + 1
                }
              />
              <ReferencesDialog
                size="lg"
                citations={meta.standardReferences}
              />
            </div>

            {/* Property bar */}
            <dl
              className="mt-6 grid grid-cols-1 gap-y-1.5 text-[13px] sm:grid-cols-[120px_1fr]"
              style={{ color: C.charcoal }}
            >
              <PropRow
                label="Disease"
                value={meta.displayNameKo}
                pillBg={C.accentBg}
                pillColor={C.primary}
              />
              <PropRow
                label="Modality"
                value={modality === "Auto" ? "Auto-detect" : modality}
                pillBg={C.surface}
              />
              <PropRow
                label="Language"
                value={langLabel}
                pillBg={C.surface}
              />
              <PropRow
                label="Status"
                value={
                  isStreaming
                    ? "Streaming…"
                    : missingFields.length > 0
                    ? `${missingFields.length} fields missing`
                    : "Ready to generate"
                }
                pillBg={
                  isStreaming
                    ? C.accentBg
                    : missingFields.length > 0
                    ? "#fff4d6"
                    : "#dff5e3"
                }
                pillColor={
                  isStreaming
                    ? C.primary
                    : missingFields.length > 0
                    ? "#7a5a00"
                    : "#0a6a2c"
                }
              />
            </dl>

            <div
              className="my-8 h-px"
              style={{ background: C.hairlineSoft }}
            />

            {/* ── Workspace 2-column layout ──────────────────── */}
            <div className="grid gap-x-8 gap-y-0 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              {/* LEFT: input column */}
              <div className="flex min-w-0 flex-col">
                <Block
                  label="Configuration"
                  hint="Provider, modality hint, output language."
                >
                  <div className="flex flex-col gap-4 pt-2">
                    <ModelSelector
                      providers={providers}
                      selectedProvider={provider}
                      selectedModel={model}
                      onProviderChange={setProvider}
                      onModelChange={setModel}
                    />

                    <div>
                      <label
                        className="mb-1.5 block text-[13px] font-medium"
                        id="modality-hint-label"
                        htmlFor="modality-hint-control"
                        style={{ color: C.charcoal }}
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
                      <p
                        className="mt-1.5 text-[12px]"
                        style={{ color: C.steel }}
                      >
                        Auto: 입력 텍스트에서 modality를 자동 유추합니다.
                        구체적인 modality를 선택하면 프롬프트에 hint로
                        전달됩니다.
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
                  </div>
                </Block>

                <CalloutBlock
                  label="Findings"
                  hint={`${meta.displayNameKo} structured input`}
                  note="Fill the structured fields below. Required cells are marked; the report won't generate until they are complete."
                >
                  <div className="flex flex-col gap-4">
                    {formState.kind === "RCC" ? (
                      <RccStructuredForm
                        value={formState.input}
                        onChange={(next) => {
                          setFormState({ kind: "RCC", input: next });
                          if (inputError) setInputError("");
                        }}
                        error={inputError}
                      />
                    ) : (
                      <ProstateStructuredForm
                        value={formState.input}
                        onChange={(next) => {
                          setFormState({
                            kind: "ProstateCancer",
                            input: next,
                          });
                          if (inputError) setInputError("");
                        }}
                        error={inputError}
                      />
                    )}

                    {!isStreaming && missingFields.length > 0 && (
                      <div
                        role="status"
                        aria-live="polite"
                        className="rounded-md border px-3 py-2.5 text-[13px]"
                        style={{
                          borderColor: "#f3d97a",
                          background: "#fff8e1",
                          color: "#7a5a00",
                        }}
                      >
                        <p className="font-medium">
                          필수 입력란이 비어 있습니다
                          <span
                            className="ml-1 font-normal"
                            style={{ color: "#a07a00" }}
                          >
                            ({missingFields.length}개 항목 누락)
                          </span>
                        </p>
                        <ul className="mt-1.5 ml-4 list-disc space-y-0.5 text-[12px] leading-relaxed">
                          {missingFields.map((label) => (
                            <li key={label}>{label}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </CalloutBlock>

                {/* Generate / Cancel CTA frame */}
                <div
                  className="mt-6 flex flex-col gap-3 rounded-xl p-5 sm:flex-row sm:items-center sm:justify-between"
                  style={{
                    background: C.cardLavender,
                    border: `1px solid ${C.accentBg}`,
                  }}
                >
                  <div className="min-w-0">
                    <div
                      className="text-[14px] font-medium"
                      style={{ color: C.charcoal }}
                    >
                      {isStreaming
                        ? "Generating report…"
                        : "Ready to generate?"}
                    </div>
                    <div
                      className="text-[13px]"
                      style={{ color: C.slate, marginTop: 2 }}
                    >
                      {isStreaming
                        ? "Cancel anytime to keep the partial output."
                        : "A 6-section structured report will stream into the right column."}
                    </div>
                  </div>
                  {isStreaming ? (
                    <Button
                      onClick={handleCancel}
                      variant="outline"
                      size="lg"
                      style={{
                        borderColor: C.hairline,
                        color: C.charcoal,
                        borderRadius: 9999,
                        padding: "0 22px",
                        height: 44,
                      }}
                    >
                      <Square className="mr-2 h-4 w-4" />
                      Cancel
                    </Button>
                  ) : (
                    <Button
                      onClick={handleGenerate}
                      disabled={!hasMinimumFormFields(formState)}
                      size="lg"
                      className="font-medium"
                      style={{
                        background: C.primary,
                        color: "#ffffff",
                        borderRadius: 9999,
                        padding: "0 22px",
                        height: 44,
                      }}
                    >
                      <Send className="mr-2 h-4 w-4" />
                      Generate report
                      <ArrowRight className="ml-1 h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>

              {/* RIGHT: streaming output (sticky on desktop) */}
              <div
                className="mt-10 flex min-w-0 flex-col lg:mt-7 lg:sticky lg:self-start"
                style={{ top: 80 }}
              >
                <OutputBlock
                  label="Output"
                  title="Structured report"
                  pill={
                    isStreaming
                      ? {
                          text: "streaming",
                          bg: C.accentBg,
                          color: C.primary,
                        }
                      : undefined
                  }
                >
                  <StructuredReportOutput
                    content={content}
                    isStreaming={isStreaming}
                    elapsedMs={elapsedMs}
                    streamStartedAt={streamStartedAt}
                    error={apiError}
                    onRetry={handleRetry}
                  />
                </OutputBlock>
              </div>
            </div>

            {/* Footer */}
            <footer
              className="mt-16 flex flex-col items-start gap-2 border-t pt-6 text-[12px] sm:flex-row sm:items-center sm:justify-between"
              style={{ borderColor: C.hairlineSoft, color: C.steel }}
            >
              <span>
                Rad Conclusion — Structured radiology report generator. For
                professional use only.
              </span>
              <Link
                href="/structured-report"
                className="inline-flex items-center gap-1"
                style={{ color: C.slate }}
              >
                ← All disease templates
              </Link>
            </footer>
          </div>
        </main>
      </div>
    </div>
  );
}
