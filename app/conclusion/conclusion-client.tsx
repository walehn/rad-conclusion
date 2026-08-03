"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useChat } from "@ai-sdk/react";
import {
  Stethoscope,
  Send,
  Settings,
  Github,
  Search,
  ChevronRight,
  FileText,
  Plus,
  Sparkles,
  Hash,
  Clock,
  ArrowRight,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  useNotionPalette,
  SidebarSection,
  SidebarItem,
  Block,
  CalloutBlock,
  OutputBlock,
  PageProperties,
  EmojiPickerTrigger,
  MEDICAL_EMOJI,
} from "@/components/notion-tone";
import { FindingsInput } from "@/components/findings-input";
import { OptionsPanel } from "@/components/options-panel";
import { ModelSelector } from "@/components/model-selector";
import { ConclusionOutput } from "@/components/conclusion-output";
import { ThemeToggle } from "@/components/theme-toggle";
import { postProcess } from "@/lib/post-process";
import { loadProviderSettings } from "@/lib/storage/settings-store";
import type { ConclusionStyle, ConclusionLang } from "@/lib/prompts/system-prompt";
import type { ProviderInfo, ProviderName, ProviderSettings } from "@/lib/providers/types";
import { LOCAL_PROVIDER_DEFAULTS } from "@/lib/providers/local-config";

function getCsrfToken(): string {
  if (typeof document === "undefined") return "";
  return document.cookie
    .split("; ")
    .find((cookie) => cookie.startsWith("csrf_token="))
    ?.split("=")[1] ?? "";
}

export function ConclusionClient() {
  const { c, tokens } = useNotionPalette();
  const router = useRouter();
  const [findings, setFindings] = React.useState("");
  const [style, setStyle] = React.useState<ConclusionStyle>("numbered");
  const [lang, setLang] = React.useState<ConclusionLang>("en");
  const [provider, setProvider] = React.useState<ProviderName>("local");
  const [model, setModel] = React.useState<string>(LOCAL_PROVIDER_DEFAULTS.modelId);
  const [providers, setProviders] = React.useState<ProviderInfo[]>([]);
  const [clientSettings, setClientSettings] = React.useState<ProviderSettings[]>([]);
  const [inputError, setInputError] = React.useState("");
  const [elapsedTime, setElapsedTime] = React.useState<number | null>(null);
  const [compareMode, setCompareMode] = React.useState(true);
  const [apiError, setApiError] = React.useState("");
  const [apiErrorV1, setApiErrorV1] = React.useState("");
  const [apiErrorV2, setApiErrorV2] = React.useState("");
  const [elapsedTimeV1, setElapsedTimeV1] = React.useState<number | null>(null);
  const [elapsedTimeV2, setElapsedTimeV2] = React.useState<number | null>(null);
  const [voted, setVoted] = React.useState<string | null>(null);
  const startTimeRef = React.useRef<number | null>(null);
  const startTimeV1Ref = React.useRef<number | null>(null);
  const startTimeV2Ref = React.useRef<number | null>(null);

  // ── Notion-style UX state (sidebar collapse, page emoji) ──────
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);
  const [pageEmoji, setPageEmoji] = React.useState<string | null>("🩺");
  const [emojiPickerOpen, setEmojiPickerOpen] = React.useState(false);
  const [hydrated, setHydrated] = React.useState(false);

  // Hydrate UX preferences from localStorage after mount.
  React.useEffect(() => {
    try {
      const collapsed = localStorage.getItem("radc.sidebar-collapsed");
      if (collapsed === "1") setSidebarCollapsed(true);
      const e = localStorage.getItem("radc.page-emoji");
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
      if (pageEmoji) localStorage.setItem("radc.page-emoji", pageEmoji);
      else localStorage.removeItem("radc.page-emoji");
    } catch {}
  }, [pageEmoji, hydrated]);

  // Fetch available providers on mount and merge with client settings
  const refreshProviders = React.useCallback(async () => {
    try {
      const [serverRes, localSettings] = await Promise.all([
        fetch("/api/providers").then((r) => r.json() as Promise<ProviderInfo[]>),
        loadProviderSettings(),
      ]);

      setClientSettings(localSettings);

      // Merge: a provider is available if server has env var OR client has configured it
      const merged = serverRes.map((sp) => {
        const cs = localSettings.find((s) => s.id === sp.name);
        const clientAvailable = cs?.enabled && (cs.id === "local" ? !!cs.hostUrl : !!cs.apiKey);
        return {
          ...sp,
          available: sp.available || !!clientAvailable,
        };
      });

      setProviders(merged);

      // Select first available provider if current one is not available
      const currentAvailable = merged.find((p) => p.name === provider && p.available);
      if (!currentAvailable) {
        const firstAvailable = merged.find((p) => p.available);
        if (firstAvailable) {
          setProvider(firstAvailable.name);
          setModel(firstAvailable.defaultModel);
        }
      }
    } catch {
      // Use defaults if fetch fails
    }
  }, [provider]);

  React.useEffect(() => {
    refreshProviders();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Resolve client-side API key/hostUrl for the current provider
  const currentClientSettings = clientSettings.find(
    (s) => s.id === provider && s.enabled
  );

  const { messages, isLoading, append, setMessages } = useChat({
    api: "/api/generate",
    headers: { "x-csrf-token": getCsrfToken() },
    body: {
      style,
      lang,
      provider,
      model,
      promptVersion: "v1",
    },
    onFinish: (message) => {
      if (startTimeRef.current) {
        setElapsedTime((performance.now() - startTimeRef.current) / 1000);
      }
      // Fire-and-forget evaluation
      if (message.content) {
        fetch("/api/evaluate", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-csrf-token": getCsrfToken() },
          body: JSON.stringify({
            findings: findings.trim(),
            conclusion: message.content,
            promptVersion: "v1",
            style,
            lang,
            model,
          }),
        }).catch(() => {}); // Silent fail
      }
    },
    onError: (err) => {
      setApiError(err.message || "An error occurred while generating.");
      if (startTimeRef.current) {
        setElapsedTime((performance.now() - startTimeRef.current) / 1000);
      }
    },
  });

  // A/B Compare mode hooks (always declared to satisfy React rules of hooks)
  const chatV1 = useChat({
    id: "chat-v1",
    api: "/api/generate",
    headers: { "x-csrf-token": getCsrfToken() },
    body: {
      style,
      lang,
      provider,
      model,
      promptVersion: "v1",
    },
    onFinish: (message) => {
      if (startTimeV1Ref.current) {
        setElapsedTimeV1((performance.now() - startTimeV1Ref.current) / 1000);
      }
      // Fire-and-forget evaluation
      if (message.content) {
        fetch("/api/evaluate", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-csrf-token": getCsrfToken() },
          body: JSON.stringify({
            findings: findings.trim(),
            conclusion: message.content,
            promptVersion: "v1",
            style,
            lang,
            model,
          }),
        }).catch(() => {}); // Silent fail
      }
    },
    onError: (err) => {
      setApiErrorV1(err.message || "An error occurred while generating.");
      if (startTimeV1Ref.current) {
        setElapsedTimeV1((performance.now() - startTimeV1Ref.current) / 1000);
      }
    },
  });

  const chatV2 = useChat({
    id: "chat-v2",
    api: "/api/generate",
    headers: { "x-csrf-token": getCsrfToken() },
    body: {
      style,
      lang,
      provider,
      model,
      promptVersion: "v2",
    },
    onFinish: (message) => {
      if (startTimeV2Ref.current) {
        setElapsedTimeV2((performance.now() - startTimeV2Ref.current) / 1000);
      }
      // Fire-and-forget evaluation
      if (message.content) {
        fetch("/api/evaluate", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-csrf-token": getCsrfToken() },
          body: JSON.stringify({
            findings: findings.trim(),
            conclusion: message.content,
            promptVersion: "v2",
            style,
            lang,
            model,
          }),
        }).catch(() => {}); // Silent fail
      }
    },
    onError: (err) => {
      setApiErrorV2(err.message || "An error occurred while generating.");
      if (startTimeV2Ref.current) {
        setElapsedTimeV2((performance.now() - startTimeV2Ref.current) / 1000);
      }
    },
  });

  const handleVote = async (vote: "v1" | "v2" | "tie") => {
    setVoted(vote);
    try {
      await fetch("/api/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": getCsrfToken() },
        body: JSON.stringify({
          vote,
          style,
          lang,
          model,
          findingsLength: findings.length,
        }),
      });
    } catch {
      // Silent fail - voting is non-critical
    }
  };

  const handleGenerate = () => {
    const trimmed = findings.trim();
    if (!trimmed) {
      setInputError("Please enter the Findings text.");
      return;
    }
    setInputError("");
    setApiError("");

    if (compareMode) {
      // A/B Compare mode: fire both V1 and V2 simultaneously
      setVoted(null);
      setApiErrorV1("");
      setApiErrorV2("");
      setElapsedTimeV1(null);
      setElapsedTimeV2(null);
      chatV1.setMessages([]);
      chatV2.setMessages([]);
      const now = performance.now();
      startTimeV1Ref.current = now;
      startTimeV2Ref.current = now;

      chatV1.append({ role: "user", content: trimmed });
      chatV2.append({ role: "user", content: trimmed });
    } else {
      // Normal mode: single generation
      setElapsedTime(null);
      setMessages([]);
      startTimeRef.current = performance.now();

      append({ role: "user", content: trimmed });
    }
  };

  // Extract the assistant's latest message content and post-process it
  const rawContent =
    messages.filter((m) => m.role === "assistant").pop()?.content || "";
  const processedContent = rawContent ? postProcess(rawContent, "Conclusion") : "";

  // A/B Compare mode: extract content from V1 and V2
  const rawV1 =
    chatV1.messages.filter((m) => m.role === "assistant").pop()?.content || "";
  const processedV1 = rawV1 ? postProcess(rawV1, "Conclusion") : "";

  const rawV2 =
    chatV2.messages.filter((m) => m.role === "assistant").pop()?.content || "";
  const processedV2 = rawV2 ? postProcess(rawV2, "Conclusion") : "";

  const isAnyLoading = compareMode
    ? chatV1.isLoading || chatV2.isLoading
    : isLoading;

  // Local style helpers for this page only (palette comes from notion-tone).
  const headingStyle: React.CSSProperties = {
    color: c.ink,
    letterSpacing: "-0.4px",
  };
  const subtleStyle: React.CSSProperties = { color: c.slate };

  const charsCount = findings.trim().length;
  const standardLabel =
    style === "numbered" ? "Numbered list" : "Free text";
  const langLabel = lang === "en" ? "English" : "한국어";
  const modeLabel = compareMode ? "A/B compare" : "Single";

  return (
    <div
      className="min-h-screen"
      style={{ ...tokens, background: c.canvas }}
    >
      <div
        className={
          sidebarCollapsed
            ? "grid"
            : "grid lg:grid-cols-[260px_minmax(0,1fr)]"
        }
      >
        {/* ── Workspace sidebar ─────────────────────────────────── */}
        {!sidebarCollapsed && (
          <aside
            className="hidden border-r lg:block"
            style={{
              background: c.surfaceSoft,
              borderColor: c.hairlineSoft,
              position: "sticky",
              top: 56, // AppNav height
              alignSelf: "flex-start",
              height: "calc(100vh - 56px)",
              overflowY: "auto",
            }}
          >
          <div className="flex h-full flex-col px-3 py-4 text-[14px]">
            {/* Workspace header */}
            <div
              className="group flex items-center gap-2 rounded-md px-2 py-1.5"
              style={{ color: c.charcoal }}
            >
              <span
                className="grid h-6 w-6 place-items-center rounded-md"
                style={{
                  background: c.accentBg,
                  color: c.primary,
                  fontWeight: 700,
                  fontSize: 12,
                }}
              >
                R
              </span>
              <div className="leading-tight">
                <div className="font-medium" style={{ color: c.charcoal }}>
                  Radiology
                </div>
                <div className="text-[11px]" style={{ color: c.steel }}>
                  Workspace
                </div>
              </div>
              <button
                type="button"
                aria-label="Collapse sidebar"
                onClick={() => setSidebarCollapsed(true)}
                className="ml-auto rounded p-1 transition-opacity"
                style={{ color: c.steel }}
                title="Collapse sidebar"
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = c.accentHover;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                }}
              >
                <PanelLeftClose className="h-4 w-4" />
              </button>
            </div>

            {/* Search */}
            <div
              className="mt-3 flex items-center gap-2 rounded-md px-2 py-1.5"
              style={{ background: c.surface, color: c.steel }}
            >
              <Search className="h-3.5 w-3.5" />
              <span className="text-[13px]">Search…</span>
              <span
                className="ml-auto rounded px-1.5 py-0.5 text-[10px]"
                style={{ background: c.canvas, color: c.steel }}
              >
                ⌘K
              </span>
            </div>

            {/* Quick access */}
            <SidebarSection title="Quick access" mt={10}>
              <SidebarItem icon={<Sparkles className="h-3.5 w-3.5" />} active>
                New conclusion
              </SidebarItem>
              <SidebarItem icon={<FileText className="h-3.5 w-3.5" />}>
                Drafts
              </SidebarItem>
              <SidebarItem icon={<Clock className="h-3.5 w-3.5" />}>
                Recent
              </SidebarItem>
            </SidebarSection>

            {/* Templates */}
            <SidebarSection
              title="Templates"
              mt={6}
              action={
                <span
                  className="rounded p-1"
                  style={{ color: c.steel }}
                  aria-hidden
                >
                  <Plus className="h-3.5 w-3.5" />
                </span>
              }
            >
              {[
                "PI-RADS v2.1",
                "BI-RADS 5e",
                "Lung-RADS 2022",
                "ACR TI-RADS",
              ].map((t) => (
                <SidebarItem
                  key={t}
                  icon={
                    <Hash
                      className="h-3.5 w-3.5"
                      style={{ color: c.stone }}
                    />
                  }
                >
                  {t}
                </SidebarItem>
              ))}
            </SidebarSection>

            <div className="mt-auto flex items-center gap-1 pt-4">
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start gap-2"
                onClick={() => router.push("/settings")}
                style={{ color: c.steel }}
              >
                <Settings className="h-4 w-4" />
                Settings
              </Button>
              <ThemeToggle />
            </div>
          </div>
          </aside>
        )}

        {/* ── Main page area ────────────────────────────────────── */}
        <main
          className="px-4 sm:px-8 lg:px-14"
          style={{ background: c.canvas }}
        >
          {/* Collapsed-state expand toggle (Notion: floating left edge button) */}
          {sidebarCollapsed && (
            <button
              type="button"
              aria-label="Open sidebar"
              onClick={() => setSidebarCollapsed(false)}
              className="hidden lg:flex items-center gap-1.5 mt-4 -ml-2 rounded-md px-2 py-1 text-[12px] transition-colors"
              style={{ color: c.steel }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = c.mutedHover;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
              }}
            >
              <PanelLeftOpen className="h-4 w-4" />
              <span>Open sidebar</span>
            </button>
          )}
          <div className="mx-auto max-w-6xl py-6">
            {/* Breadcrumb */}
            <nav
              className="flex items-center gap-1.5 text-[12px]"
              style={{ color: c.steel }}
            >
              <span>Workspace</span>
              <ChevronRight className="h-3 w-3" />
              <span>Conclusions</span>
              <ChevronRight className="h-3 w-3" />
              <span style={{ color: c.charcoal }}>Rad Conclusion</span>
            </nav>

            {/* Compact hero: emoji + title + subtitle laid out horizontally */}
            <div className="mt-3 flex items-center gap-3">
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
                  <Stethoscope className="h-5 w-5" style={{ color: c.charcoal }} />
                }
                emojis={MEDICAL_EMOJI}
                popoverLabel="Medical icons"
                size="sm"
              />
              <div className="min-w-0">
                <h1
                  className="text-balance"
                  style={{
                    fontSize: 26,
                    fontWeight: 700,
                    lineHeight: 1.2,
                    letterSpacing: "-0.4px",
                    color: c.ink,
                  }}
                >
                  Rad Conclusion
                </h1>
                <p
                  className="mt-0.5 text-[13px]"
                  style={{ color: c.slate, lineHeight: 1.45 }}
                >
                  AI-powered radiology conclusion generator
                </p>
              </div>
            </div>

            {/* Horizontal property bar */}
            <div className="mt-3">
              <PageProperties
                items={[
                  { label: "Modality", value: "MRI / CT / Mammography" },
                  { label: "Standard", value: standardLabel, pillBg: c.surface },
                  { label: "Language", value: langLabel, pillBg: c.surface },
                  {
                    label: "Mode",
                    value: modeLabel,
                    pillBg: compareMode ? c.accentBg : c.surface,
                    pillColor: compareMode ? c.primary : c.charcoal,
                  },
                  {
                    label: "Length",
                    value: `${charsCount.toLocaleString()} characters`,
                    muted: true,
                  },
                ]}
              />
            </div>

            <div
              className="my-5 h-px"
              style={{ background: c.hairlineSoft }}
            />

            {/* ── Workspace 2-column layout ──────────────────── */}
            <div className="grid gap-x-8 gap-y-0 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              {/* LEFT: input column */}
              <div className="flex min-w-0 flex-col">
                {/* Configuration */}
                <Block
                  label="Configuration"
                  hint="Provider, model, and output format."
                >
                  <div className="flex flex-col gap-4 pt-2">
                    <ModelSelector
                      providers={providers}
                      selectedProvider={provider}
                      selectedModel={model}
                      onProviderChange={setProvider}
                      onModelChange={setModel}
                    />
                    <OptionsPanel
                      style={style}
                      lang={lang}
                      compareMode={compareMode}
                      onStyleChange={setStyle}
                      onLangChange={setLang}
                      onCompareModeChange={setCompareMode}
                    />
                  </div>
                </Block>

                {/* Findings (Notion-style callout) */}
                <CalloutBlock
                  label="Findings"
                  hint={`${charsCount.toLocaleString()} characters · paste from your dictation`}
                  note="Paste exactly what you dictated. Don't pre-format — standards-aware parsing happens at generation time."
                  barColor={c.primary}
                  tint={c.cardLavender}
                  borderColor={c.accentBg}
                >
                  <FindingsInput
                    value={findings}
                    onChange={(v) => {
                      setFindings(v);
                      if (inputError) setInputError("");
                    }}
                    error={inputError}
                  />
                </CalloutBlock>

                {/* Generate CTA frame (lavender) */}
                <div
                  className="mt-6 flex flex-col gap-3 rounded-xl p-5 sm:flex-row sm:items-center sm:justify-between"
                  style={{
                    background: c.cardLavender,
                    border: `1px solid ${c.accentBg}`,
                  }}
                >
                  <div className="min-w-0">
                    <div
                      className="text-[14px] font-medium"
                      style={{ color: c.charcoal }}
                    >
                      Ready to generate?
                    </div>
                    <div
                      className="text-[13px]"
                      style={{ color: c.slate, marginTop: 2 }}
                    >
                      {compareMode
                        ? "V1 and V2 will run in parallel for comparison."
                        : "A single conclusion will be drafted."}
                    </div>
                  </div>
                  <Button
                    onClick={handleGenerate}
                    disabled={isAnyLoading}
                    className="font-medium"
                    size="lg"
                    style={{
                      background: c.primary,
                      color: c.primaryForeground,
                      borderRadius: 9999,
                      padding: "0 22px",
                      height: 44,
                    }}
                  >
                    {isAnyLoading ? (
                      "Generating…"
                    ) : (
                      <>
                        <Send className="mr-2 h-4 w-4" />
                        Generate
                        <ArrowRight className="ml-1 h-4 w-4" />
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* RIGHT: output column (sticky on desktop) */}
              <div
                className="mt-10 flex min-w-0 flex-col lg:mt-7 lg:sticky lg:self-start"
                style={{ top: 80 }}
              >
                {compareMode ? (
                  <div className="flex flex-col gap-6">
                    <OutputBlock
                      label="Variant V1"
                      title="Basic"
                      pill={{
                        text: "baseline",
                        bg: c.surface,
                        color: c.slate,
                      }}
                    >
                      <ConclusionOutput
                        content={processedV1}
                        isLoading={chatV1.isLoading}
                        elapsedTime={elapsedTimeV1}
                        error={apiErrorV1}
                      />
                    </OutputBlock>

                    <OutputBlock
                      label="Variant V2"
                      title="Advanced — Dx / DDx"
                      pill={{
                        text: "experimental",
                        bg: c.accentBg,
                        color: c.primary,
                      }}
                      highlight
                    >
                      <ConclusionOutput
                        content={processedV2}
                        isLoading={chatV2.isLoading}
                        elapsedTime={elapsedTimeV2}
                        error={apiErrorV2}
                      />
                    </OutputBlock>

                    {!chatV1.isLoading &&
                      !chatV2.isLoading &&
                      processedV1 &&
                      processedV2 && (
                        <div
                          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3"
                          style={{
                            borderColor: c.hairline,
                            background: c.surfaceSoft,
                          }}
                        >
                          <div
                            className="text-[13px]"
                            style={{ color: c.slate }}
                          >
                            {voted ? (
                              <>
                                Voted:{" "}
                                <span
                                  style={{
                                    color: c.charcoal,
                                    fontWeight: 500,
                                  }}
                                >
                                  {voted === "v1"
                                    ? "V1 Basic"
                                    : voted === "v2"
                                    ? "V2 Advanced"
                                    : "Tie"}
                                </span>
                              </>
                            ) : (
                              <>Which conclusion is better?</>
                            )}
                          </div>
                          {!voted && (
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleVote("v1")}
                                style={{
                                  borderColor: c.hairline,
                                  color: c.charcoal,
                                }}
                              >
                                V1
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleVote("v2")}
                                style={{
                                  borderColor: c.hairline,
                                  color: c.charcoal,
                                }}
                              >
                                V2
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleVote("tie")}
                                style={{
                                  borderColor: c.hairline,
                                  color: c.charcoal,
                                }}
                              >
                                Tie
                              </Button>
                            </div>
                          )}
                        </div>
                      )}
                  </div>
                ) : (
                  <OutputBlock label="Output" title="Conclusion">
                    <ConclusionOutput
                      content={processedContent}
                      isLoading={isLoading}
                      elapsedTime={elapsedTime}
                      error={apiError}
                    />
                  </OutputBlock>
                )}
              </div>
            </div>

            {/* Footer */}
            <footer
              className="mt-16 flex flex-col items-start gap-2 border-t pt-6 text-[12px] sm:flex-row sm:items-center sm:justify-between"
              style={{ borderColor: c.hairlineSoft, color: c.steel }}
            >
              <span>
                Rad Conclusion v0.2.0 — Clinical radiology report assistant.
                For professional use only.
              </span>
              <div className="flex items-center gap-3">
                <span>Updated 2026-04-24</span>
                <a
                  href="https://github.com/walehn/rad-conclusion"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1"
                  style={{ color: c.slate }}
                >
                  <Github className="h-3.5 w-3.5" />
                  GitHub
                </a>
              </div>
            </footer>
          </div>
        </main>
      </div>
    </div>
  );
}

