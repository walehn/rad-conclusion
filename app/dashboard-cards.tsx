"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Settings,
  Search,
  ChevronRight,
  FileText,
  Plus,
  Hash,
  Clock,
  ArrowRight,
  PanelLeftClose,
  PanelLeftOpen,
  ClipboardList,
  Stethoscope,
  Home,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  useNotionPalette,
  SidebarSection,
  SidebarItem,
  EmojiPickerTrigger,
  REPORT_EMOJI,
} from "@/components/notion-tone";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  DISEASE_REGISTRY,
  diseaseCategoryToSlug,
  type DiseaseCategory,
} from "@/lib/prompts/disease-registry";

/**
 * Dashboard hub for the authenticated landing page (`/`).
 *
 * Shares the Notion-tone workspace shell with /conclusion, /structured-report,
 * and /settings. Two primary cards launch the conclusion generator and the
 * structured-report flow. Sidebar Templates section navigates directly to
 * disease-specific report pages.
 */
export function DashboardCards() {
  const router = useRouter();
  const { c, tokens } = useNotionPalette();

  // ── Notion-tone UX state ──────────────────────────────────
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);
  const [pageEmoji, setPageEmoji] = React.useState<string | null>("🩻");
  const [emojiPickerOpen, setEmojiPickerOpen] = React.useState(false);
  const [hydrated, setHydrated] = React.useState(false);

  React.useEffect(() => {
    try {
      const collapsed = localStorage.getItem("radc.sidebar-collapsed");
      if (collapsed === "1") setSidebarCollapsed(true);
      const e = localStorage.getItem("radc.home-page-emoji");
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
      if (pageEmoji) localStorage.setItem("radc.home-page-emoji", pageEmoji);
      else localStorage.removeItem("radc.home-page-emoji");
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
                  icon={<Home className="h-3.5 w-3.5" />}
                  active
                >
                  Home
                </SidebarItem>
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

          <div className="mx-auto max-w-5xl py-12">
            <nav
              className="flex items-center gap-1.5 text-[12px]"
              style={{ color: c.steel }}
            >
              <span style={{ color: c.charcoal }}>Workspace</span>
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
                <Sparkles className="h-7 w-7" style={{ color: c.charcoal }} />
              }
              emojis={REPORT_EMOJI}
              popoverLabel="Workspace icons"
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
              시작할 기능을 선택하세요
            </h1>
            <p
              className="mt-2 text-[15px]"
              style={{ color: c.slate, lineHeight: 1.55 }}
            >
              Findings를 어떻게 처리하시겠어요? 결론 한 단락만 필요하면 결론
              생성기, 6개 섹션의 구조화된 리포트가 필요하면 리포트 생성기를
              선택하세요.
            </p>

            <div
              className="my-8 h-px"
              style={{ background: c.hairlineSoft }}
            />

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <DashboardCard
                href="/conclusion"
                ariaLabel="결론 생성기 시작 — Findings로부터 Impression 생성"
                icon={<Stethoscope className="h-6 w-6" />}
                title="결론 생성기"
                description="Findings 텍스트로부터 정제된 결론(Impression)을 생성합니다. V1/V2 비교, 스타일/언어 선택을 지원합니다."
                tag="Conclusion"
              />
              <DashboardCard
                href="/structured-report"
                ariaLabel="구조화 리포트 생성기 시작 — 섹션 구조화된 리포트 생성"
                icon={<ClipboardList className="h-6 w-6" />}
                title="구조화 리포트 생성기"
                description="다중 질병 지원 — 질병 선택 후 6개 섹션 (CLINICAL INFORMATION / TECHNIQUE / COMPARISON / FINDINGS / STAGING / IMPRESSION)으로 구조화된 리포트를 생성합니다."
                tag="Structured report"
              />
            </div>

            <footer
              className="mt-16 flex flex-col items-start gap-2 border-t pt-6 text-[12px] sm:flex-row sm:items-center sm:justify-between"
              style={{ borderColor: c.hairlineSoft, color: c.steel }}
            >
              <span>Rad Conclusion · Workspace</span>
              <Link
                href="/settings"
                className="inline-flex items-center gap-1"
                style={{ color: c.slate }}
              >
                Settings →
              </Link>
            </footer>
          </div>
        </main>
      </div>
    </div>
  );
}

/* ─── Local Notion-tone dashboard card ─────────────────────────── */

function DashboardCard({
  href,
  ariaLabel,
  icon,
  title,
  description,
  tag,
}: {
  href: string;
  ariaLabel: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  tag: string;
}) {
  const { c } = useNotionPalette();
  return (
    <Link
      href={href}
      prefetch
      aria-label={ariaLabel}
      className="group block rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
      style={{ ["--tw-ring-color" as string]: c.primary }}
    >
      <article
        className="flex h-full flex-col rounded-xl border p-6 transition-all duration-200 ease-out group-hover:-translate-y-0.5"
        style={{ borderColor: c.hairline, background: c.card }}
      >
        <div className="flex items-start justify-between gap-3">
          <span
            className="grid h-10 w-10 place-items-center rounded-lg"
            style={{
              background: c.surface,
              color: c.charcoal,
              border: `1px solid ${c.hairlineSoft}`,
            }}
          >
            {icon}
          </span>
          <span
            className="rounded-full px-2 py-0.5 text-[11px] font-medium"
            style={{ background: c.accentBg, color: c.primary }}
          >
            {tag}
          </span>
        </div>
        <h2
          className="mt-4 text-[22px] font-semibold"
          style={{ color: c.ink, letterSpacing: "-0.3px" }}
        >
          {title}
        </h2>
        <p
          className="mt-2 flex-1 text-[14px] leading-relaxed"
          style={{ color: c.slate }}
        >
          {description}
        </p>
        <div
          className="mt-5 flex items-center justify-between border-t pt-4 text-[13px]"
          style={{ borderColor: c.hairlineSoft }}
        >
          <span style={{ color: c.steel }}>준비되면 시작</span>
          <span
            className="inline-flex items-center gap-1 font-medium transition-transform group-hover:translate-x-0.5"
            style={{ color: c.primary }}
          >
            시작하기
            <ArrowRight className="h-3.5 w-3.5" />
          </span>
        </div>
      </article>
    </Link>
  );
}
