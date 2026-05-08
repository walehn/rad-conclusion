"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
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
import {
  notionTokens,
  C,
  SidebarSection,
  SidebarItem,
  PropRow,
  EmojiPickerTrigger,
  REPORT_EMOJI,
} from "@/components/notion-tone";
import { ThemeToggle } from "@/components/theme-toggle";
import { DiseaseCategoryIndicator } from "@/components/disease-category-indicator";
import type { DiseaseCategory } from "@/lib/prompts/disease-registry";

type EntryMeta = {
  displayNameKo: string;
  description: string;
  supportedModalities: readonly string[];
};

export type SelectorEntry = {
  category: DiseaseCategory;
  slug: string;
  meta: EntryMeta;
};

interface Props {
  entries: SelectorEntry[];
}

/**
 * Notion-tone selector page for /structured-report.
 *
 * Workspace shell (sidebar + main) shared with /conclusion. The sidebar's
 * Templates section is wired to the disease registry, so each entry doubles
 * as a real navigation item to /structured-report/<slug>.
 */
export function StructuredReportSelectorClient({ entries }: Props) {
  const router = useRouter();

  // ── UX state (sidebar collapse, page emoji) ────────────────
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
      if (pageEmoji) localStorage.setItem("radc.reports-page-emoji", pageEmoji);
      else localStorage.removeItem("radc.reports-page-emoji");
    } catch {}
  }, [pageEmoji, hydrated]);

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

              {/* Quick access */}
              <SidebarSection title="Quick access" mt={10}>
                <SidebarItem
                  icon={<Stethoscope className="h-3.5 w-3.5" />}
                  onClick={() => router.push("/conclusion")}
                >
                  New conclusion
                </SidebarItem>
                <SidebarItem
                  icon={<ClipboardList className="h-3.5 w-3.5" />}
                  active
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

              {/* Templates wired to disease registry */}
              <SidebarSection
                title="Templates"
                mt={6}
                action={<Plus className="h-3.5 w-3.5" />}
              >
                {entries.map(({ category, slug, meta }) => (
                  <SidebarItem
                    key={category}
                    icon={
                      <Hash
                        className="h-3.5 w-3.5"
                        style={{ color: C.stone }}
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
              <span>Workspace</span>
              <ChevronRight className="h-3 w-3" />
              <span style={{ color: C.charcoal }}>Structured reports</span>
            </nav>

            {/* Page emoji picker */}
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
                <ClipboardList className="h-7 w-7" style={{ color: C.charcoal }} />
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
              구조화 리포트 생성기
            </h1>
            <p
              className="mt-2 text-[15px]"
              style={{ color: C.slate, lineHeight: 1.55 }}
            >
              질병을 선택하면 해당 리포트 작성 화면으로 이동합니다. 템플릿은
              표준 가이드라인(PI-RADS, ACR 등)에 정렬되어 있습니다.
            </p>

            {/* Property bar */}
            <dl
              className="mt-6 grid grid-cols-1 gap-y-1.5 text-[13px] sm:grid-cols-[120px_1fr]"
              style={{ color: C.charcoal }}
            >
              <PropRow
                label="Categories"
                value={`${entries.length} templates available`}
                pillBg={C.surface}
              />
              <PropRow
                label="Standards"
                value="PI-RADS v2.1 · ACR · 통합 영상의학"
                pillBg={C.surface}
              />
              <PropRow
                label="Status"
                value="Production ready"
                pillBg={C.accentBg}
                pillColor={C.primary}
              />
            </dl>

            <div
              className="my-8 h-px"
              style={{ background: C.hairlineSoft }}
            />

            {/* Section header */}
            <div className="mb-4 flex items-baseline justify-between">
              <h2
                className="text-[15px] font-semibold"
                style={{ color: C.ink, letterSpacing: "-0.1px" }}
              >
                Disease categories
              </h2>
              <span className="text-[12px]" style={{ color: C.steel }}>
                {entries.length}개 등록됨
              </span>
            </div>

            {entries.length === 0 ? (
              <div
                className="rounded-lg border p-8 text-center text-[14px]"
                style={{
                  borderColor: C.hairline,
                  background: C.surfaceSoft,
                  color: C.slate,
                }}
              >
                등록된 질병이 없습니다 — No diseases registered.
              </div>
            ) : (
              <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 list-none p-0">
                {entries.map(({ category, slug, meta }, idx) => (
                  <li key={category}>
                    <Link
                      href={`/structured-report/${slug}`}
                      aria-label={`질병 선택: ${meta.displayNameKo} (#${idx + 1})`}
                      className="group block rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
                      style={{
                        ["--tw-ring-color" as string]: C.primary,
                      }}
                    >
                      <article
                        className="h-full rounded-xl border p-5 transition-all duration-200 ease-out group-hover:-translate-y-0.5"
                        style={{
                          borderColor: C.hairline,
                          background: C.card,
                        }}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <DiseaseCategoryIndicator
                            category={category}
                            variant="hero"
                            index={idx + 1}
                          />
                          <span
                            className="rounded-full px-2 py-0.5 text-[11px] font-medium"
                            style={{
                              background: C.surface,
                              color: C.steel,
                            }}
                          >
                            #{idx + 1}
                          </span>
                        </div>

                        <p
                          className="mt-4 text-[14px] leading-relaxed"
                          style={{ color: C.slate }}
                        >
                          {meta.description}
                        </p>

                        <div className="mt-4 flex flex-wrap gap-1.5">
                          {meta.supportedModalities.map((m) => (
                            <span
                              key={m}
                              className="inline-flex items-center rounded px-2 py-0.5 text-[11px] font-medium"
                              style={{
                                background: C.surface,
                                color: C.charcoal,
                                border: `1px solid ${C.hairlineSoft}`,
                              }}
                            >
                              {m}
                            </span>
                          ))}
                        </div>

                        <div
                          className="mt-5 flex items-center justify-between border-t pt-4 text-[13px]"
                          style={{ borderColor: C.hairlineSoft }}
                        >
                          <span style={{ color: C.steel }}>
                            {meta.displayNameKo}
                          </span>
                          <span
                            className="inline-flex items-center gap-1 font-medium transition-transform group-hover:translate-x-0.5"
                            style={{ color: C.primary }}
                          >
                            리포트 생성 시작
                            <ArrowRight className="h-3.5 w-3.5" />
                          </span>
                        </div>
                      </article>
                    </Link>
                  </li>
                ))}
              </ul>
            )}

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
                href="/conclusion"
                className="inline-flex items-center gap-1"
                style={{ color: C.slate }}
              >
                ← Back to conclusion workspace
              </Link>
            </footer>
          </div>
        </main>
      </div>
    </div>
  );
}

