"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProviderCard } from "@/components/settings/provider-card";
import { loadProviderSettings } from "@/lib/storage/settings-store";
import type { ProviderSettings, ProviderName } from "@/lib/providers/types";
import { CSRF_COOKIE_NAME } from "@/lib/auth/csrf";

/** Reads the double-submit CSRF token from the non-httpOnly cookie. */
function getCsrfToken(): string {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(
    new RegExp(`(?:^|;\\s*)${CSRF_COOKIE_NAME}=([^;]+)`)
  );
  return match ? decodeURIComponent(match[1]) : "";
}

/** Shape returned by GET /api/user/api-keys */
interface StoredKeyInfo {
  provider: string;
  hasKey: boolean;
  maskedKey: string | null;
}

const LOCAL_STORAGE_KEY = "rad-conclusion-provider-settings";

export default function SettingsClient() {
  const router = useRouter();
  const [settings, setSettings] = React.useState<ProviderSettings[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [storedKeys, setStoredKeys] = React.useState<StoredKeyInfo[]>([]);
  const [showMigrationBanner, setShowMigrationBanner] = React.useState(false);
  const [migrating, setMigrating] = React.useState(false);

  // Load server-side stored keys and check for migration opportunity
  React.useEffect(() => {
    async function initialize() {
      try {
        // Fetch server-stored keys
        const res = await fetch("/api/user/api-keys");
        let serverKeys: StoredKeyInfo[] = [];
        if (res.ok) {
          serverKeys = await res.json();
          setStoredKeys(serverKeys);
        }

        // Check if localStorage has settings not yet migrated to server
        const hasLocalData =
          typeof window !== "undefined" &&
          !!localStorage.getItem(LOCAL_STORAGE_KEY);
        const serverHasNoKeys = serverKeys.every((k) => !k.hasKey);

        if (hasLocalData && serverHasNoKeys) {
          setShowMigrationBanner(true);
        }

        // Load local settings for display (validation status etc.)
        const localSettings = await loadProviderSettings();
        setSettings(localSettings);
      } finally {
        setLoading(false);
      }
    }
    initialize();
  }, []);

  const handleProviderChange = (updated: ProviderSettings) => {
    setSettings((prev) =>
      prev.map((s) => (s.id === updated.id ? updated : s))
    );
  };

  const handleValidate = async (providerId: string) => {
    const provider = settings.find((s) => s.id === providerId);
    if (!provider) return;

    setSettings((prev) =>
      prev.map((s) =>
        s.id === providerId ? { ...s, validationStatus: "validating" } : s
      )
    );

    try {
      const res = await fetch("/api/providers/validate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": getCsrfToken(),
        },
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

  /** Save the API key for a provider to the server. */
  const saveApiKeyToServer = async (
    providerId: ProviderName,
    apiKey: string
  ): Promise<void> => {
    const res = await fetch("/api/user/api-keys", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-csrf-token": getCsrfToken(),
      },
      body: JSON.stringify({ provider: providerId, apiKey }),
    });
    if (!res.ok) {
      throw new Error(`Failed to save API key: ${res.status}`);
    }
    // Refresh stored key list
    const updated: StoredKeyInfo = await res.json();
    setStoredKeys((prev) =>
      prev.some((k) => k.provider === providerId)
        ? prev.map((k) =>
            k.provider === providerId
              ? { provider: providerId, hasKey: true, maskedKey: updated.maskedKey }
              : k
          )
        : [...prev, { provider: providerId, hasKey: true, maskedKey: updated.maskedKey }]
    );
  };

  /** Delete the API key for a provider from the server. */
  const deleteApiKeyFromServer = async (
    providerId: ProviderName
  ): Promise<void> => {
    const res = await fetch(`/api/user/api-keys/${providerId}`, {
      method: "DELETE",
      headers: { "x-csrf-token": getCsrfToken() },
    });
    if (!res.ok && res.status !== 404) {
      throw new Error(`Failed to delete API key: ${res.status}`);
    }
    setStoredKeys((prev) =>
      prev.map((k) =>
        k.provider === providerId
          ? { ...k, hasKey: false, maskedKey: null }
          : k
      )
    );
  };

  /** Called when user changes an API key field and focuses away, or clicks save. */
  const handleApiKeySave = async (providerId: ProviderName, apiKey: string) => {
    if (!apiKey) return;
    try {
      await saveApiKeyToServer(providerId, apiKey);
    } catch (err) {
      console.error("[settings] Failed to save API key:", err);
    }
  };

  /** Migrate localStorage API keys to server storage. */
  const handleMigrate = async () => {
    setMigrating(true);
    try {
      const localSettings = await loadProviderSettings();
      const keysToMigrate = localSettings.filter(
        (s) => s.apiKey && s.id !== "local"
      );

      await Promise.all(
        keysToMigrate.map((s) =>
          saveApiKeyToServer(s.id, s.apiKey as string)
        )
      );

      // Remove localStorage data after successful migration
      if (typeof window !== "undefined") {
        localStorage.removeItem(LOCAL_STORAGE_KEY);
        localStorage.removeItem("rad-conclusion-crypto-key");
      }

      setShowMigrationBanner(false);
    } catch (err) {
      console.error("[settings] Migration failed:", err);
    } finally {
      setMigrating(false);
    }
  };

  const handleMigrateDismiss = () => {
    setShowMigrationBanner(false);
  };

  const getStoredKeyInfo = (providerId: string): StoredKeyInfo | undefined =>
    storedKeys.find((k) => k.provider === providerId);

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

      {/* Migration Banner */}
      {showMigrationBanner && (
        <div className="mb-6 rounded-md border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30">
          <p className="mb-3 text-sm text-amber-900 dark:text-amber-200">
            브라우저에 저장된 API 키를 서버로 마이그레이션하면 모든 기기에서
            사용할 수 있습니다.
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={handleMigrate}
              disabled={migrating}
              className="bg-amber-600 text-white hover:bg-amber-700"
            >
              {migrating ? "마이그레이션 중..." : "서버로 마이그레이션"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleMigrateDismiss}
              disabled={migrating}
            >
              나중에
            </Button>
          </div>
        </div>
      )}

      {/* Provider Cards */}
      <div className="grid gap-6">
        {settings.map((provider) => {
          const storedInfo = getStoredKeyInfo(provider.id);
          return (
            <ProviderCard
              key={provider.id}
              settings={provider}
              onChange={(updated) => {
                handleProviderChange(updated);
                // If api key was cleared, delete from server
                if (
                  updated.id !== "local" &&
                  !updated.apiKey &&
                  storedInfo?.hasKey
                ) {
                  deleteApiKeyFromServer(updated.id as ProviderName).catch(
                    console.error
                  );
                }
                // If api key was set, save to server
                if (updated.id !== "local" && updated.apiKey) {
                  handleApiKeySave(
                    updated.id as ProviderName,
                    updated.apiKey
                  ).catch(console.error);
                }
              }}
              onValidate={handleValidate}
              hasStoredKey={storedInfo?.hasKey ?? false}
            />
          );
        })}
      </div>

      {/* Info */}
      <div className="mt-8 rounded-md border border-input bg-muted/50 p-4">
        <p className="text-sm text-muted-foreground">
          API 키는 서버에 암호화되어 저장되며 모든 기기에서 사용할 수 있습니다.
          키는 LLM 제공자 API에 직접 전달되며 평문으로 저장되지 않습니다.
        </p>
      </div>
    </div>
  );
}
