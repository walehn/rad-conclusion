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
  Smile,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
    .find((c) => c.startsWith("csrf_token="))
    ?.split("=")[1] ?? "";
}

export function ConclusionClient() {
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
      const c = localStorage.getItem("radc.sidebar-collapsed");
      if (c === "1") setSidebarCollapsed(true);
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
        const cs = localSettings.find((c) => c.id === sp.name);
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

  // Notion-toned token override scoped to this page. Restrained for clinical
  // use: warm off-white canvas, charcoal ink, single muted-purple accent,
  // hairline borders instead of shadows. No emoji dots or pastel cards.
  const notionTokens = {
    "--color-background": "#fafaf9",
    "--color-foreground": "#37352f",
    "--color-muted": "#f0eeec",
    "--color-muted-foreground": "#787671",
    "--color-border": "#e5e3df",
    "--color-input": "#e5e3df",
    "--color-ring": "#5645d4",
    "--color-primary": "#5645d4",
    "--color-primary-foreground": "#ffffff",
    "--color-secondary": "#f6f5f4",
    "--color-secondary-foreground": "#37352f",
    "--color-card": "#ffffff",
    "--color-card-foreground": "#37352f",
    "--color-popover": "#ffffff",
    "--color-popover-foreground": "#37352f",
    "--color-accent": "#f0eeec",
    "--color-accent-foreground": "#37352f",
  } as React.CSSProperties;

  const headingStyle: React.CSSProperties = {
    color: "#1a1a1a",
    letterSpacing: "-0.4px",
  };
  const subtleStyle: React.CSSProperties = { color: "#5d5b54" };

  // Notion-style colors used inline for the workspace shell.
  const C = {
    canvas: "#fafaf9",
    surface: "#f6f5f4",
    surfaceSoft: "#fbfaf8",
    card: "#ffffff",
    hairline: "#e5e3df",
    hairlineSoft: "#ede9e4",
    ink: "#1a1a1a",
    charcoal: "#37352f",
    slate: "#5d5b54",
    steel: "#787671",
    stone: "#a4a097",
    primary: "#5645d4",
    primaryDeep: "#4534b3",
    accentBg: "#e6e0f5",
    accentText: "#5645d4",
    cardLavender: "#f5f2fa",
  };

  const charsCount = findings.trim().length;
  const standardLabel =
    style === "numbered" ? "Numbered list" : "Free text";
  const langLabel = lang === "en" ? "English" : "한국어";
  const modeLabel = compareMode ? "A/B compare" : "Single";

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
        {/* ── Workspace sidebar ─────────────────────────────────── */}
        {!sidebarCollapsed && (
          <aside
            className="hidden border-r lg:block"
            style={{
              background: C.surfaceSoft,
              borderColor: C.hairlineSoft,
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

            {/* Search */}
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
                  style={{ color: C.steel }}
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
                      style={{ color: C.stone }}
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

        {/* ── Main page area ────────────────────────────────────── */}
        <main
          className="px-4 sm:px-8 lg:px-14"
          style={{ background: C.canvas }}
        >
          {/* Collapsed-state expand toggle (Notion: floating left edge button) */}
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
              <span>Workspace</span>
              <ChevronRight className="h-3 w-3" />
              <span>Conclusions</span>
              <ChevronRight className="h-3 w-3" />
              <span style={{ color: C.charcoal }}>Rad Conclusion</span>
            </nav>

            {/* Page title icon — Notion-style emoji picker trigger */}
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
              C={C}
            />

            {/* Page title */}
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
              Rad Conclusion
            </h1>
            <p
              className="mt-2 text-[15px]"
              style={{ color: C.slate, lineHeight: 1.55 }}
            >
              AI-powered radiology conclusion generator
            </p>

            {/* Property bar (Notion page properties) */}
            <dl
              className="mt-6 grid grid-cols-1 gap-y-1.5 text-[13px] sm:grid-cols-[120px_1fr]"
              style={{ color: C.charcoal }}
            >
              <PropRow label="Modality" value="MRI / CT / Mammography" iconColor={C.stone} />
              <PropRow
                label="Standard"
                value={standardLabel}
                pillBg={C.surface}
              />
              <PropRow
                label="Language"
                value={langLabel}
                pillBg={C.surface}
              />
              <PropRow
                label="Mode"
                value={modeLabel}
                pillBg={compareMode ? C.accentBg : C.surface}
                pillColor={compareMode ? C.primary : C.charcoal}
              />
              <PropRow
                label="Length"
                value={`${charsCount.toLocaleString()} characters`}
                muted
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
                  barColor={C.primary}
                  tint={C.cardLavender}
                  borderColor={C.accentBg}
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
                    background: C.cardLavender,
                    border: `1px solid ${C.accentBg}`,
                  }}
                >
                  <div className="min-w-0">
                    <div
                      className="text-[14px] font-medium"
                      style={{ color: C.charcoal }}
                    >
                      Ready to generate?
                    </div>
                    <div
                      className="text-[13px]"
                      style={{ color: C.slate, marginTop: 2 }}
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
                      background: C.primary,
                      color: "#ffffff",
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
                        bg: C.surface,
                        color: C.slate,
                      }}
                      C={C}
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
                        bg: C.accentBg,
                        color: C.primary,
                      }}
                      C={C}
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
                            borderColor: C.hairline,
                            background: C.surfaceSoft,
                          }}
                        >
                          <div
                            className="text-[13px]"
                            style={{ color: C.slate }}
                          >
                            {voted ? (
                              <>
                                Voted:{" "}
                                <span
                                  style={{
                                    color: C.charcoal,
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
                                  borderColor: C.hairline,
                                  color: C.charcoal,
                                }}
                              >
                                V1
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleVote("v2")}
                                style={{
                                  borderColor: C.hairline,
                                  color: C.charcoal,
                                }}
                              >
                                V2
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleVote("tie")}
                                style={{
                                  borderColor: C.hairline,
                                  color: C.charcoal,
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
                  <OutputBlock label="Output" title="Conclusion" C={C}>
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
              style={{ borderColor: C.hairlineSoft, color: C.steel }}
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
                  style={{ color: C.slate }}
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

/* ─── Notion-style helper components ───────────────────────────── */

function SidebarSection({
  title,
  children,
  mt,
  action,
}: {
  title: string;
  children: React.ReactNode;
  mt?: number;
  action?: React.ReactNode;
}) {
  return (
    <div style={{ marginTop: mt ?? 12 }}>
      <div
        className="flex items-center justify-between px-2 pb-1 text-[11px] font-medium"
        style={{ color: "#787671", letterSpacing: "0.04em" }}
      >
        <span>{title}</span>
        {action}
      </div>
      <div className="flex flex-col">{children}</div>
    </div>
  );
}

function SidebarItem({
  children,
  icon,
  active,
}: {
  children: React.ReactNode;
  icon?: React.ReactNode;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      className="flex items-center gap-2 rounded-md px-2 py-1 text-left text-[13px] transition-colors"
      style={{
        background: active ? "#ece8f7" : "transparent",
        color: active ? "#37352f" : "#5d5b54",
        fontWeight: active ? 500 : 400,
      }}
    >
      <span style={{ color: active ? "#5645d4" : "#a4a097" }}>{icon}</span>
      <span className="truncate">{children}</span>
    </button>
  );
}

function PropRow({
  label,
  value,
  pillBg,
  pillColor,
  muted,
  iconColor: _iconColor,
}: {
  label: string;
  value: string;
  pillBg?: string;
  pillColor?: string;
  muted?: boolean;
  iconColor?: string;
}) {
  return (
    <>
      <dt
        className="flex items-center gap-1.5 py-1.5 text-[13px]"
        style={{ color: "#787671" }}
      >
        {label}
      </dt>
      <dd className="flex items-center py-1.5">
        {pillBg ? (
          <span
            className="inline-flex items-center rounded px-2 py-0.5 text-[12px]"
            style={{
              background: pillBg,
              color: pillColor ?? "#37352f",
              fontWeight: 500,
            }}
          >
            {value}
          </span>
        ) : (
          <span
            className="text-[13px]"
            style={{
              color: muted ? "#787671" : "#37352f",
            }}
          >
            {value}
          </span>
        )}
      </dd>
    </>
  );
}

function Block({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-7">
      <div className="flex items-baseline justify-between">
        <h2
          className="text-[15px] font-semibold"
          style={{ color: "#1a1a1a", letterSpacing: "-0.1px" }}
        >
          {label}
        </h2>
        {hint && (
          <span className="text-[12px]" style={{ color: "#787671" }}>
            {hint}
          </span>
        )}
      </div>
      <div
        className="mt-2 rounded-lg border p-4"
        style={{ borderColor: "#e5e3df", background: "#ffffff" }}
      >
        {children}
      </div>
    </section>
  );
}

function OutputBlock({
  label,
  title,
  pill,
  children,
  C,
  highlight,
}: {
  label: string;
  title: string;
  pill?: { text: string; bg: string; color: string };
  children: React.ReactNode;
  C: { hairline: string; charcoal: string; ink: string; steel: string; accentBg: string };
  highlight?: boolean;
}) {
  return (
    <section>
      <div className="flex items-center justify-between">
        <div>
          <div
            className="text-[11px] font-medium uppercase"
            style={{ color: C.steel, letterSpacing: "0.08em" }}
          >
            {label}
          </div>
          <h3
            className="mt-0.5 text-[20px] font-semibold"
            style={{ color: C.ink, letterSpacing: "-0.2px" }}
          >
            {title}
          </h3>
        </div>
        {pill && (
          <span
            className="rounded-full px-2.5 py-1 text-[11px] font-medium"
            style={{ background: pill.bg, color: pill.color }}
          >
            {pill.text}
          </span>
        )}
      </div>
      <div
        className="mt-3 rounded-lg border p-4"
        style={{
          background: "#ffffff",
          borderColor: highlight ? C.accentBg : C.hairline,
        }}
      >
        {children}
      </div>
    </section>
  );
}

/* ─── Notion-style callout block ───────────────────────────────
   A single block of content with a coloured left bar and tinted
   background, used to draw the eye toward the most important
   input on the page. */
function CalloutBlock({
  label,
  hint,
  note,
  children,
  barColor,
  tint,
  borderColor,
}: {
  label: string;
  hint?: string;
  note?: string;
  children: React.ReactNode;
  barColor: string;
  tint: string;
  borderColor: string;
}) {
  return (
    <section className="mt-7">
      <div className="flex items-baseline justify-between">
        <h2
          className="text-[15px] font-semibold"
          style={{ color: "#1a1a1a", letterSpacing: "-0.1px" }}
        >
          {label}
        </h2>
        {hint && (
          <span className="text-[12px]" style={{ color: "#787671" }}>
            {hint}
          </span>
        )}
      </div>
      <div
        className="mt-2 flex overflow-hidden rounded-lg border"
        style={{ background: tint, borderColor: borderColor }}
      >
        <div
          aria-hidden
          className="shrink-0"
          style={{ width: 4, background: barColor }}
        />
        <div className="flex-1 p-4">
          {note && (
            <p
              className="mb-3 text-[13px]"
              style={{ color: "#5d5b54", lineHeight: 1.55 }}
            >
              {note}
            </p>
          )}
          {children}
        </div>
      </div>
    </section>
  );
}

/* ─── Notion-style emoji picker trigger ────────────────────────
   Click the icon tile to open a small popover with a curated
   medical emoji set. Keyboard-friendly (Esc closes), click-out
   closes, and 'Remove' returns to the default Stethoscope mark. */
const MEDICAL_EMOJI = [
  "🩺",
  "🩻",
  "🧠",
  "🫀",
  "🫁",
  "🦴",
  "🩸",
  "💉",
  "💊",
  "🧬",
  "🔬",
  "🧪",
  "🩹",
  "⚕️",
  "📋",
  "📝",
  "🔍",
  "📊",
];

function EmojiPickerTrigger({
  emoji,
  open,
  onOpenChange,
  onSelect,
  onClear,
  C,
}: {
  emoji: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSelect: (emoji: string) => void;
  onClear: () => void;
  C: { surface: string; hairlineSoft: string; charcoal: string; steel: string; hairline: string };
}) {
  const wrapperRef = React.useRef<HTMLDivElement>(null);

  // Close on outside click and Escape.
  React.useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        onOpenChange(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onOpenChange(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onOpenChange]);

  return (
    <div ref={wrapperRef} className="relative mt-6 inline-block">
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        aria-label="Change page icon"
        title="Click to change icon"
        className="group relative inline-flex items-center justify-center rounded-md transition-all hover:bg-[#f0eeec] hover:ring-2 hover:ring-offset-1"
        style={{
          width: 56,
          height: 56,
          background: emoji ? "transparent" : C.surface,
          border: emoji
            ? "1px solid transparent"
            : `1px solid ${C.hairlineSoft}`,
          fontSize: 36,
          lineHeight: 1,
          ["--tw-ring-color" as string]: "#d6d9fc",
        }}
      >
        {emoji ? (
          <span aria-hidden>{emoji}</span>
        ) : (
          <Stethoscope className="h-7 w-7" style={{ color: C.charcoal }} />
        )}
        <span
          aria-hidden
          className="pointer-events-none absolute -bottom-1 -right-1 grid h-5 w-5 place-items-center rounded-full bg-white opacity-0 shadow-sm transition-opacity group-hover:opacity-100"
          style={{
            color: "#5645d4",
            border: `1px solid ${C.hairline}`,
          }}
        >
          <Smile className="h-3 w-3" />
        </span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Choose page icon"
          className="absolute z-20 mt-2 w-[280px] rounded-lg border p-3 shadow-lg"
          style={{
            top: "100%",
            left: 0,
            background: "#ffffff",
            borderColor: C.hairline,
            boxShadow:
              "0 14px 28px -10px rgba(15,15,15,0.18), 0 2px 6px rgba(15,15,15,0.06)",
          }}
        >
          <div className="flex items-center justify-between pb-2">
            <span
              className="text-[11px] font-medium uppercase"
              style={{ color: C.steel, letterSpacing: "0.08em" }}
            >
              Medical icons
            </span>
            <button
              type="button"
              onClick={onClear}
              className="text-[12px] underline-offset-2 hover:underline"
              style={{ color: C.steel }}
            >
              Remove
            </button>
          </div>
          <div className="grid grid-cols-6 gap-1">
            {MEDICAL_EMOJI.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => onSelect(e)}
                aria-label={`Choose ${e}`}
                className="grid h-9 w-9 place-items-center rounded text-[20px] transition-colors hover:bg-[#f0eeec]"
              >
                {e}
              </button>
            ))}
          </div>
          <div
            className="mt-2 border-t pt-2 text-[11px]"
            style={{ borderColor: C.hairlineSoft, color: C.steel }}
          >
            Click any icon to apply. Saved per browser.
          </div>
        </div>
      )}
    </div>
  );
}
