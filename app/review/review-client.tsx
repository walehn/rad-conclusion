"use client";

import * as React from "react";
import {
  ChevronDown,
  ChevronRight,
  Clock,
  Copy,
  Check,
  Search,
  Loader2,
  Inbox,
  History,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { postProcess } from "@/lib/post-process";
import { cn } from "@/lib/utils";
import {
  CURRENT_PROMPT_REVISION,
  PROMPT_REVISIONS,
  findPromptRevision,
} from "@/lib/prompts/revisions";

interface EvaluationSummary {
  scores: Record<string, number | undefined>;
  issues: string[];
  overallScore: number | null;
}

interface GenerationItem {
  id: number;
  promptVersion: "v1" | "v2";
  /** Registry id of the prompt text used. Null on pre-versioning rows. */
  promptRevision: string | null;
  promptHash: string | null;
  conclusion: string;
  style: string;
  lang: string;
  provider: string;
  model: string;
  finishReason: string | null;
  promptTokens: number | null;
  completionTokens: number | null;
  ttftMs: number | null;
  totalMs: number | null;
  createdAt: string;
  isMine: boolean;
  evaluation: EvaluationSummary | null;
}

interface GenerationBatch {
  batchId: string;
  createdAt: string;
  findings: string;
  items: GenerationItem[];
}

const PAGE_SIZE = 20;

const SCORE_LABELS: Record<string, string> = {
  conciseness: "간결성",
  intervalChange: "경과 변화",
  dxAppropriateness: "진단 적절성",
  redundancy: "중복 없음",
  hedgingAccuracy: "확신 표현",
  clinicalPriority: "임상 우선순위",
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(ms: number | null): string {
  if (ms === null) return "—";
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}초` : `${ms}ms`;
}

/**
 * Renders the prompt revision behind one conclusion.
 *
 * The id alone is meaningless to a reader, so the summary and the text
 * fingerprint are attached as a tooltip. Rows written before prompt
 * versioning existed carry no id and are labelled as such.
 */
function RevisionBadge({
  revision,
  hash,
}: {
  revision: string | null;
  hash: string | null;
}): React.ReactElement {
  const known = findPromptRevision(revision);
  const label = revision ?? "미기록";
  const title = known
    ? `${known.id} (${known.date}) — ${known.summary}${hash ? ` · ${hash}` : ""}`
    : revision === "unregistered"
      ? `레지스트리에 등록되지 않은 프롬프트${hash ? ` · ${hash}` : ""}`
      : "프롬프트 버전 추적 이전에 생성된 기록";

  return (
    <span
      title={title}
      className={cn(
        "rounded px-1.5 py-0.5 font-mono text-[11px] font-medium",
        known
          ? "bg-primary/10 text-primary"
          : "bg-muted text-muted-foreground"
      )}
    >
      {label}
    </span>
  );
}

/** Collapsible change log, rendered straight from lib/prompts/revisions.ts. */
function PromptHistory(): React.ReactElement {
  return (
    <details className="mb-6 rounded-lg border border-border bg-card">
      <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-foreground">
        <span className="inline-flex items-center gap-2">
          <History className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          프롬프트 변경 이력
          <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
            현재 {CURRENT_PROMPT_REVISION.id}
          </span>
        </span>
      </summary>
      <ol className="border-t border-border px-4 py-3">
        {[...PROMPT_REVISIONS].reverse().map((rev) => (
          <li key={rev.id} className="border-b border-border/60 py-2 last:border-b-0">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="font-mono text-xs font-semibold text-primary">
                {rev.id}
              </span>
              <span className="text-xs text-muted-foreground">{rev.date}</span>
              <span className="text-sm text-foreground">{rev.summary}</span>
              <span className="font-mono text-[11px] text-muted-foreground">
                {rev.fingerprint}
              </span>
            </div>
            {rev.changes.length > 0 && (
              <ul className="mt-1 list-disc pl-5 text-xs text-muted-foreground">
                {rev.changes.map((change) => (
                  <li key={change}>{change}</li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ol>
    </details>
  );
}

export function ReviewClient(): React.ReactElement {
  const [batches, setBatches] = React.useState<GenerationBatch[]>([]);
  const [total, setTotal] = React.useState(0);
  const [offset, setOffset] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  // `query` is the live input; `search` is the value actually sent, so typing
  // does not fire a request per keystroke.
  const [query, setQuery] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [versionFilter, setVersionFilter] = React.useState<"" | "v1" | "v2">("");
  const [revisionFilter, setRevisionFilter] = React.useState("");
  const [mineOnly, setMineOnly] = React.useState(false);

  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = React.useState<number | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");

    const params = new URLSearchParams({
      limit: String(PAGE_SIZE),
      offset: String(offset),
    });
    if (search) params.set("q", search);
    if (versionFilter) params.set("promptVersion", versionFilter);
    if (revisionFilter) params.set("promptRevision", revisionFilter);
    if (mineOnly) params.set("mine", "1");

    fetch(`/api/generations?${params.toString()}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`요청 실패 (${res.status})`);
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        setBatches(data.batches ?? []);
        setTotal(data.total ?? 0);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message || "기록을 불러오지 못했습니다.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [offset, search, versionFilter, revisionFilter, mineOnly]);

  // Any filter change invalidates the current page position.
  const applySearch = (): void => {
    setOffset(0);
    setSearch(query.trim());
  };

  const changeVersion = (v: "" | "v1" | "v2"): void => {
    setOffset(0);
    setVersionFilter(v);
  };

  const toggleExpanded = (batchId: string): void => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(batchId)) next.delete(batchId);
      else next.add(batchId);
      return next;
    });
  };

  const copyConclusion = async (item: GenerationItem): Promise<void> => {
    try {
      await navigator.clipboard.writeText(postProcess(item.conclusion, "Conclusion"));
      setCopiedId(item.id);
      window.setTimeout(() => setCopiedId(null), 1500);
    } catch {
      // Clipboard is unavailable outside a secure context; nothing to recover.
    }
  };

  const pageStart = total === 0 ? 0 : offset + 1;
  const pageEnd = Math.min(offset + PAGE_SIZE, total);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          생성 기록 리뷰
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          입력한 Findings와 그로부터 생성된 모든 결론을 시간순으로 확인합니다.
          A/B 비교로 생성된 v1·v2는 같은 항목 안에 나란히 표시됩니다.
        </p>
      </header>

      <PromptHistory />

      {/* Filters */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 basis-64">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") applySearch();
            }}
            placeholder="Findings 또는 결론 내용 검색"
            aria-label="기록 검색"
            className={cn(
              "h-9 w-full rounded-md border border-border bg-background pl-9 pr-3 text-sm",
              "placeholder:text-muted-foreground",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            )}
          />
        </div>
        <Button onClick={applySearch} variant="outline" size="sm">
          검색
        </Button>

        <div
          role="group"
          aria-label="프롬프트 버전 필터"
          className="flex items-center gap-1 rounded-full bg-muted/50 p-1"
        >
          {([
            ["", "전체"],
            ["v1", "v1"],
            ["v2", "v2"],
          ] as const).map(([value, label]) => (
            <button
              key={label}
              type="button"
              onClick={() => changeVersion(value)}
              aria-pressed={versionFilter === value}
              className={cn(
                "rounded-full px-3 py-1 text-sm font-medium transition-colors",
                versionFilter === value
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <select
          value={revisionFilter}
          onChange={(e) => {
            setOffset(0);
            setRevisionFilter(e.target.value);
          }}
          aria-label="프롬프트 리비전 필터"
          className={cn(
            "h-9 rounded-md border border-border bg-background px-2 text-sm text-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          )}
        >
          <option value="">모든 리비전</option>
          {[...PROMPT_REVISIONS].reverse().map((rev) => (
            <option key={rev.id} value={rev.id}>
              {rev.id} · {rev.date}
            </option>
          ))}
          {/* Rows whose prompt text was never registered. */}
          <option value="unregistered">미등록 프롬프트</option>
        </select>

        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={mineOnly}
            onChange={(e) => {
              setOffset(0);
              setMineOnly(e.target.checked);
            }}
            className="h-4 w-4 rounded border-border"
          />
          내 기록만
        </label>
      </div>

      {/* States */}
      {loading && (
        <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          <span className="text-sm">불러오는 중…</span>
        </div>
      )}

      {!loading && error && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {error}
        </div>
      )}

      {!loading && !error && batches.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
          <Inbox className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">
            {search || versionFilter || mineOnly
              ? "조건에 맞는 기록이 없습니다."
              : "아직 저장된 생성 기록이 없습니다. 결론을 생성하면 여기에 쌓입니다."}
          </p>
        </div>
      )}

      {/* Results */}
      {!loading && !error && batches.length > 0 && (
        <>
          <p className="mb-3 text-xs text-muted-foreground">
            전체 {total}건 중 {pageStart}–{pageEnd}
          </p>

          <ul className="space-y-3">
            {batches.map((batch) => {
              const isOpen = expanded.has(batch.batchId);
              return (
                <li
                  key={batch.batchId}
                  className="overflow-hidden rounded-lg border border-border bg-card"
                >
                  <button
                    type="button"
                    onClick={() => toggleExpanded(batch.batchId)}
                    aria-expanded={isOpen}
                    className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/40"
                  >
                    {isOpen ? (
                      <ChevronDown
                        className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
                        aria-hidden="true"
                      />
                    ) : (
                      <ChevronRight
                        className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
                        aria-hidden="true"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          "text-sm text-foreground",
                          !isOpen && "line-clamp-2"
                        )}
                      >
                        {batch.findings}
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3 w-3" aria-hidden="true" />
                          {formatTime(batch.createdAt)}
                        </span>
                        {batch.items.map((item) => (
                          <span
                            key={item.id}
                            className="rounded bg-muted px-1.5 py-0.5 font-medium"
                          >
                            {item.promptVersion}
                            {item.promptRevision && ` · ${item.promptRevision}`}
                            {item.totalMs !== null &&
                              ` · ${formatDuration(item.totalMs)}`}
                          </span>
                        ))}
                        <span className="truncate">{batch.items[0]?.model}</span>
                      </div>
                    </div>
                  </button>

                  {isOpen && (
                    <div className="border-t border-border bg-background/50 px-4 py-4">
                      {/* Full findings */}
                      <section className="mb-4">
                        <h2 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Findings (입력)
                        </h2>
                        <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-md border border-border bg-muted/40 p-3 font-sans text-sm text-foreground">
                          {batch.findings}
                        </pre>
                      </section>

                      {/* Conclusions, side by side when a batch has both versions */}
                      <div
                        className={cn(
                          "grid gap-4",
                          batch.items.length > 1
                            ? "md:grid-cols-2"
                            : "grid-cols-1"
                        )}
                      >
                        {batch.items.map((item) => (
                          <section
                            key={item.id}
                            className="rounded-md border border-border bg-card p-3"
                          >
                            <div className="mb-2 flex items-center justify-between gap-2">
                              <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                결론 · {item.promptVersion}
                                <RevisionBadge
                                  revision={item.promptRevision}
                                  hash={item.promptHash}
                                />
                              </h2>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => copyConclusion(item)}
                                aria-label={`${item.promptVersion} 결론 복사`}
                                className="h-7 px-2"
                              >
                                {copiedId === item.id ? (
                                  <Check
                                    className="h-3.5 w-3.5"
                                    aria-hidden="true"
                                  />
                                ) : (
                                  <Copy
                                    className="h-3.5 w-3.5"
                                    aria-hidden="true"
                                  />
                                )}
                              </Button>
                            </div>

                            <pre className="whitespace-pre-wrap font-sans text-sm text-foreground">
                              {postProcess(item.conclusion, "Conclusion")}
                            </pre>

                            <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 border-t border-border pt-2 text-xs text-muted-foreground">
                              <div className="flex justify-between gap-2">
                                <dt>총 시간</dt>
                                <dd className="text-foreground">
                                  {formatDuration(item.totalMs)}
                                </dd>
                              </div>
                              <div className="flex justify-between gap-2">
                                <dt>첫 토큰</dt>
                                <dd className="text-foreground">
                                  {formatDuration(item.ttftMs)}
                                </dd>
                              </div>
                              <div className="flex justify-between gap-2">
                                <dt>토큰</dt>
                                <dd className="text-foreground">
                                  {item.completionTokens ?? "—"}
                                </dd>
                              </div>
                              <div className="flex justify-between gap-2">
                                <dt>스타일</dt>
                                <dd className="text-foreground">
                                  {item.style} / {item.lang}
                                </dd>
                              </div>
                            </dl>

                            {item.evaluation && (
                              <div className="mt-3 border-t border-border pt-2">
                                <div className="mb-1.5 flex items-center justify-between">
                                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                    LLM 평가
                                  </h3>
                                  {item.evaluation.overallScore !== null && (
                                    <span className="text-xs font-semibold text-foreground">
                                      {item.evaluation.overallScore.toFixed(1)} / 5
                                    </span>
                                  )}
                                </div>
                                <ul className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                                  {Object.entries(item.evaluation.scores).map(
                                    ([k, v]) =>
                                      typeof v === "number" ? (
                                        <li
                                          key={k}
                                          className="flex justify-between gap-2"
                                        >
                                          <span>{SCORE_LABELS[k] ?? k}</span>
                                          <span className="text-foreground">
                                            {v}
                                          </span>
                                        </li>
                                      ) : null
                                  )}
                                </ul>
                                {item.evaluation.issues.length > 0 && (
                                  <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-muted-foreground">
                                    {item.evaluation.issues.map((issue, i) => (
                                      <li key={i}>{issue}</li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                            )}
                          </section>
                        ))}
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          {/* Pagination */}
          <nav
            aria-label="페이지 이동"
            className="mt-6 flex items-center justify-center gap-3"
          >
            <Button
              variant="outline"
              size="sm"
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            >
              이전
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={offset + PAGE_SIZE >= total}
              onClick={() => setOffset(offset + PAGE_SIZE)}
            >
              다음
            </Button>
          </nav>
        </>
      )}
    </main>
  );
}
