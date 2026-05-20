"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Settings,
  Search,
  ChevronRight,
  FileText,
  Plus,
  Hash,
  Clock,
  PanelLeftClose,
  PanelLeftOpen,
  ClipboardList,
  Stethoscope,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProviderCard } from "@/components/settings/provider-card";
import { PasswordChangeForm } from "@/components/settings/password-change-form";
import { loadProviderSettings } from "@/lib/storage/settings-store";
import type { ProviderSettings, ProviderName } from "@/lib/providers/types";
import { CSRF_COOKIE_NAME } from "@/lib/auth/csrf-constants";
import {
  useNotionPalette,
  SidebarSection,
  SidebarItem,
  Block,
  CalloutBlock,
  EmojiPickerTrigger,
} from "@/components/notion-tone";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  DISEASE_REGISTRY,
  diseaseCategoryToSlug,
  type DiseaseCategory,
} from "@/lib/prompts/disease-registry";

const SETTINGS_EMOJI = [
  "⚙️",
  "🔧",
  "🔑",
  "🛡️",
  "🔒",
  "👤",
  "🌐",
  "📋",
  "🩺",
  "📊",
  "✅",
  "🔔",
] as const;

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
  const { c, tokens } = useNotionPalette();
  const [settings, setSettings] = React.useState<ProviderSettings[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [storedKeys, setStoredKeys] = React.useState<StoredKeyInfo[]>([]);
  const [showMigrationBanner, setShowMigrationBanner] = React.useState(false);
  const [migrating, setMigrating] = React.useState(false);

  // ── Notion-tone UX state ──────────────────────────────────
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);
  const [pageEmoji, setPageEmoji] = React.useState<string | null>("⚙️");
  const [emojiPickerOpen, setEmojiPickerOpen] = React.useState(false);
  const [hydrated, setHydrated] = React.useState(false);

  React.useEffect(() => {
    try {
      const c = localStorage.getItem("radc.sidebar-collapsed");
      if (c === "1") setSidebarCollapsed(true);
      const e = localStorage.getItem("radc.settings-page-emoji");
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
        localStorage.setItem("radc.settings-page-emoji", pageEmoji);
      else localStorage.removeItem("radc.settings-page-emoji");
    } catch {}
  }, [pageEmoji, hydrated]);

  const diseaseEntries = React.useMemo(
    () =>
      (Object.keys(DISEASE_REGISTRY) as DiseaseCategory[]).map((cat) => ({
        category: cat,
        slug: diseaseCategoryToSlug(cat),
        meta: DISEASE_REGISTRY[cat],
      })),
    [],
  );

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
        {/* ── Workspace sidebar ─────────────────────────────── */}
        {!sidebarCollapsed && (
          <aside
            className="hidden border-r lg:block"
            style={{
              background: c.surfaceSoft,
              borderColor: c.hairlineSoft,
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
                {diseaseEntries.map(({ category, slug, meta }) => (
                  <SidebarItem
                    key={category}
                    icon={
                      <Hash
                        className="h-3.5 w-3.5"
                        style={{ color: c.stone }}
                      />
                    }
                    onClick={() =>
                      router.push(`/structured-report/${slug}`)
                    }
                  >
                    {meta.displayNameKo}
                  </SidebarItem>
                ))}
              </SidebarSection>

              <div className="mt-auto flex items-center gap-1 pt-4">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start gap-2"
                  style={{ color: c.charcoal, background: c.accentHover }}
                >
                  <Settings className="h-4 w-4" style={{ color: c.primary }} />
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
          style={{ background: c.canvas }}
        >
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

          <div className="mx-auto max-w-3xl py-10">
            {/* Breadcrumb */}
            <nav
              className="flex items-center gap-1.5 text-[12px]"
              style={{ color: c.steel }}
            >
              <span>Workspace</span>
              <ChevronRight className="h-3 w-3" />
              <span style={{ color: c.charcoal }}>Settings</span>
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
                <Settings className="h-7 w-7" style={{ color: c.charcoal }} />
              }
              emojis={SETTINGS_EMOJI}
              popoverLabel="Settings icons"
            />

            <h1
              className="mt-4 text-balance"
              style={{
                fontSize: 44,
                fontWeight: 700,
                lineHeight: 1.15,
                letterSpacing: "-0.6px",
                color: c.ink,
              }}
            >
              Settings
            </h1>
            <p
              className="mt-2 text-[15px]"
              style={{ color: c.slate, lineHeight: 1.55 }}
            >
              LLM 제공자와 API 키를 설정합니다. 키는 서버에 암호화되어 저장되며
              모든 기기에서 사용할 수 있습니다.
            </p>

            <div
              className="my-8 h-px"
              style={{ background: c.hairlineSoft }}
            />

            {loading ? (
              <div
                className="rounded-lg border p-12 text-center text-[14px]"
                style={{
                  borderColor: c.hairline,
                  background: c.surfaceSoft,
                  color: c.slate,
                }}
              >
                Loading settings…
              </div>
            ) : (
              <>
                {showMigrationBanner && (
                  <CalloutBlock
                    label="Migration available"
                    note="브라우저에 저장된 API 키를 서버로 마이그레이션하면 모든 기기에서 사용할 수 있습니다."
                    barColor={c.warningBar}
                    tint={c.warningTint}
                    borderColor={c.warningBorder}
                  >
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={handleMigrate}
                        disabled={migrating}
                        style={{
                          background: c.warningBar,
                          color: c.primaryForeground,
                          borderRadius: 9999,
                        }}
                      >
                        {migrating ? "마이그레이션 중..." : "서버로 마이그레이션"}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleMigrateDismiss}
                        disabled={migrating}
                        style={{ color: c.slate }}
                      >
                        나중에
                      </Button>
                    </div>
                  </CalloutBlock>
                )}

                <Block
                  label="Providers"
                  hint={`${settings.length} configured`}
                >
                  <div className="grid gap-4">
                    {settings.map((provider) => {
                      const storedInfo = getStoredKeyInfo(provider.id);
                      return (
                        <ProviderCard
                          key={provider.id}
                          settings={provider}
                          onChange={(updated) => {
                            handleProviderChange(updated);
                            if (
                              updated.id !== "local" &&
                              !updated.apiKey &&
                              storedInfo?.hasKey
                            ) {
                              deleteApiKeyFromServer(
                                updated.id as ProviderName,
                              ).catch(console.error);
                            }
                            if (updated.id !== "local" && updated.apiKey) {
                              handleApiKeySave(
                                updated.id as ProviderName,
                                updated.apiKey,
                              ).catch(console.error);
                            }
                          }}
                          onValidate={handleValidate}
                          hasStoredKey={storedInfo?.hasKey ?? false}
                        />
                      );
                    })}
                  </div>
                </Block>

                <Block label="Security" hint="How API keys are stored">
                  <p
                    className="text-[13px]"
                    style={{ color: c.slate, lineHeight: 1.55 }}
                  >
                    API 키는 서버에 암호화되어 저장되며 모든 기기에서 사용할 수
                    있습니다. 키는 LLM 제공자 API에 직접 전달되며 평문으로
                    저장되지 않습니다.
                  </p>
                </Block>

                <Block label="Password" hint="Change your account password">
                  <PasswordChangeForm />
                </Block>
              </>
            )}

            {/* Footer */}
            <footer
              className="mt-16 flex flex-col items-start gap-2 border-t pt-6 text-[12px] sm:flex-row sm:items-center sm:justify-between"
              style={{ borderColor: c.hairlineSoft, color: c.steel }}
            >
              <span>Rad Conclusion · Settings</span>
              <button
                type="button"
                onClick={() => router.back()}
                className="inline-flex items-center gap-1"
                style={{ color: c.slate }}
              >
                ← Back
              </button>
            </footer>
          </div>
        </main>
      </div>
    </div>
  );
}
