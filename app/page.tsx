"use client";

import * as React from "react";
import Link from "next/link";
import { useChat } from "@ai-sdk/react";
import { Stethoscope, Send, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FindingsInput } from "@/components/findings-input";
import { OptionsPanel } from "@/components/options-panel";
import { ModelSelector } from "@/components/model-selector";
import { ConclusionOutput } from "@/components/conclusion-output";
import { ThemeToggle } from "@/components/theme-toggle";
import { postProcess } from "@/lib/post-process";
import { loadProviderSettings } from "@/lib/storage/settings-store";
import type { ConclusionStyle, ConclusionLang } from "@/lib/prompts/system-prompt";
import type { ProviderInfo, ProviderName, ProviderSettings } from "@/lib/providers/types";

export default function Home() {
  const [findings, setFindings] = React.useState("");
  const [style, setStyle] = React.useState<ConclusionStyle>("numbered");
  const [lang, setLang] = React.useState<ConclusionLang>("en");
  const [title, setTitle] = React.useState("Conclusion");
  const [provider, setProvider] = React.useState<ProviderName>("local");
  const [model, setModel] = React.useState("gpt-oss-120b");
  const [providers, setProviders] = React.useState<ProviderInfo[]>([]);
  const [clientSettings, setClientSettings] = React.useState<ProviderSettings[]>([]);
  const [inputError, setInputError] = React.useState("");
  const [elapsedTime, setElapsedTime] = React.useState<number | null>(null);
  const [apiError, setApiError] = React.useState("");
  const startTimeRef = React.useRef<number | null>(null);

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
    body: {
      style,
      lang,
      title,
      provider,
      model,
      apiKey: currentClientSettings?.apiKey,
      hostUrl: currentClientSettings?.hostUrl,
    },
    onFinish: () => {
      if (startTimeRef.current) {
        setElapsedTime((performance.now() - startTimeRef.current) / 1000);
      }
    },
    onError: (err) => {
      setApiError(err.message || "An error occurred while generating.");
      if (startTimeRef.current) {
        setElapsedTime((performance.now() - startTimeRef.current) / 1000);
      }
    },
  });

  const handleGenerate = () => {
    const trimmed = findings.trim();
    if (!trimmed) {
      setInputError("Please enter the Findings text.");
      return;
    }
    setInputError("");
    setApiError("");
    setElapsedTime(null);
    setMessages([]);
    startTimeRef.current = performance.now();

    append({
      role: "user",
      content: trimmed,
    });
  };

  // Extract the assistant's latest message content and post-process it
  const rawContent =
    messages.filter((m) => m.role === "assistant").pop()?.content || "";
  const processedContent = rawContent ? postProcess(rawContent, title) : "";

  return (
    <div className="mx-auto min-h-screen max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <header className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Stethoscope className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Rad Conclusion
            </h1>
            <p className="text-sm text-muted-foreground">
              AI-powered radiology conclusion generator
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/settings">
            <Button variant="ghost" size="icon" aria-label="Settings">
              <Settings className="h-5 w-5" />
            </Button>
          </Link>
          <ThemeToggle />
        </div>
      </header>

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left Column - Input */}
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Configuration</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
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
                title={title}
                onStyleChange={setStyle}
                onLangChange={setLang}
                onTitleChange={setTitle}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Findings</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <FindingsInput
                value={findings}
                onChange={(v) => {
                  setFindings(v);
                  if (inputError) setInputError("");
                }}
                error={inputError}
              />
              <Button
                onClick={handleGenerate}
                disabled={isLoading}
                className="w-full"
                size="lg"
              >
                {isLoading ? (
                  "Generating..."
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Generate Conclusion
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Output */}
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle className="text-lg">Result</CardTitle>
          </CardHeader>
          <CardContent className="flex-1">
            <ConclusionOutput
              content={processedContent}
              isLoading={isLoading}
              elapsedTime={elapsedTime}
              error={apiError}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
