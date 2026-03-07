"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProviderCard } from "@/components/settings/provider-card";
import {
  loadProviderSettings,
  saveProviderSettings,
} from "@/lib/storage/settings-store";
import type { ProviderSettings, ProviderName } from "@/lib/providers/types";

export default function SettingsPage() {
  const router = useRouter();
  const [settings, setSettings] = React.useState<ProviderSettings[]>([]);
  const [loading, setLoading] = React.useState(true);

  // Load settings on mount
  React.useEffect(() => {
    loadProviderSettings()
      .then(setSettings)
      .finally(() => setLoading(false));
  }, []);

  // Save settings on change (skip initial load)
  const isInitialMount = React.useRef(true);
  React.useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    if (settings.length > 0) {
      saveProviderSettings(settings);
    }
  }, [settings]);

  const handleProviderChange = (updated: ProviderSettings) => {
    setSettings((prev) =>
      prev.map((s) => (s.id === updated.id ? updated : s))
    );
  };

  const handleValidate = async (providerId: string) => {
    const provider = settings.find((s) => s.id === providerId);
    if (!provider) return;

    // Set validating status
    setSettings((prev) =>
      prev.map((s) =>
        s.id === providerId ? { ...s, validationStatus: "validating" } : s
      )
    );

    try {
      const res = await fetch("/api/providers/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: providerId as ProviderName,
          apiKey: provider.apiKey || "not-needed",
          hostUrl: provider.hostUrl,
        }),
      });
      const result = await res.json();

      setSettings((prev) =>
        prev.map((s) =>
          s.id === providerId
            ? {
                ...s,
                validationStatus: result.valid ? "valid" : "invalid",
                lastValidatedAt: new Date().toISOString(),
              }
            : s
        )
      );
    } catch {
      setSettings((prev) =>
        prev.map((s) =>
          s.id === providerId ? { ...s, validationStatus: "invalid" } : s
        )
      );
    }
  };

  if (loading) {
    return (
      <div className="mx-auto min-h-screen max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex items-center justify-center py-20">
          <p className="text-muted-foreground">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-screen max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <header className="mb-8 flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Back to home"
          onClick={() => router.back()}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-3">
          <Settings className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
            <p className="text-sm text-muted-foreground">
              Configure LLM providers and API keys
            </p>
          </div>
        </div>
      </header>

      {/* Provider Cards */}
      <div className="grid gap-6">
        {settings.map((provider) => (
          <ProviderCard
            key={provider.id}
            settings={provider}
            onChange={handleProviderChange}
            onValidate={handleValidate}
          />
        ))}
      </div>

      {/* Info */}
      <div className="mt-8 rounded-md border border-input bg-muted/50 p-4">
        <p className="text-sm text-muted-foreground">
          API keys are encrypted and stored locally in your browser. Keys are
          never sent to our servers - they are passed directly to the LLM
          provider APIs. Closing the browser tab will require re-entering your
          keys.
        </p>
      </div>
    </div>
  );
}
