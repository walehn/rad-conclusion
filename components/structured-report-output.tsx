"use client";

import * as React from "react";
import { Copy, Check, Loader2, RotateCw, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  RCC_SECTION_ORDER,
  type RccReportSection,
} from "@/lib/prompts/disease-templates/rcc";
import { cn } from "@/lib/utils";

interface StructuredReportOutputProps {
  /** Full streaming content accumulated so far. */
  content: string;
  /** True while the SSE stream is in progress. */
  isStreaming: boolean;
  /** Total generation time in milliseconds (once streaming ends). */
  elapsedMs?: number | null;
  /** Retry callback; shown when error is non-empty. */
  onRetry?: () => void;
  /** Error message from the last generation attempt. */
  error?: string | null;
}

/**
 * Korean labels for each SAR/RCC report section.
 * The English uppercase header remains the authoritative anchor used by the
 * parser; the Korean label is only a secondary visual aid for readers.
 */
const SECTION_LABELS_KO: Record<RccReportSection, string> = {
  "CLINICAL INFORMATION": "임상 정보",
  TECHNIQUE: "기법",
  COMPARISON: "비교",
  FINDINGS: "소견",
  STAGING: "병기",
  IMPRESSION: "결론",
};

/**
 * Parse the streaming report into its six sections.
 *
 * Strategy:
 *   - Look for lines that match exactly one of the SAR section headers
 *     ("SECTION NAME:"), optionally preceded by whitespace. Each header
 *     starts a new section; the body continues until the next recognized
 *     header or end of input.
 *   - If no recognized header is found at all (e.g., first few tokens of a
 *     stream arrive before the model emits the header), the whole content
 *     is treated as a "raw" prelude and surfaced in the first section slot
 *     (CLINICAL INFORMATION) so streaming feels alive. Once the first real
 *     header arrives, parsing switches to the normal header-based layout.
 */
interface ParsedSections {
  sections: Record<RccReportSection, string>;
  /** Which section is currently being written (last one seen in the stream). */
  activeSection: RccReportSection | null;
  /** True when at least one recognized header has been seen in the content. */
  headersDetected: boolean;
  /** Text that appeared before any recognized header (fallback buffer). */
  prelude: string;
}

function parseSections(content: string): ParsedSections {
  const empty: Record<RccReportSection, string> = {
    "CLINICAL INFORMATION": "",
    TECHNIQUE: "",
    COMPARISON: "",
    FINDINGS: "",
    STAGING: "",
    IMPRESSION: "",
  };

  if (!content) {
    return {
      sections: empty,
      activeSection: null,
      headersDetected: false,
      prelude: "",
    };
  }

  // Escape any potentially-regex-sensitive characters in section names.
  // (All current names are [A-Z ]+ but this future-proofs the pattern.)
  const headerAlternation = RCC_SECTION_ORDER.map((s) =>
    s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  ).join("|");

  // Match a line whose entire non-whitespace content is "<SECTION NAME>:"
  // (trailing whitespace allowed). Multiline + global flags so we collect every
  // occurrence and know their exact positions.
  const headerRegex = new RegExp(
    `^[ \\t]*(${headerAlternation}):[ \\t]*$`,
    "gm"
  );

  const matches: Array<{ name: RccReportSection; start: number; end: number }> =
    [];
  let m: RegExpExecArray | null;
  while ((m = headerRegex.exec(content)) !== null) {
    matches.push({
      name: m[1] as RccReportSection,
      start: m.index,
      end: m.index + m[0].length,
    });
  }

  if (matches.length === 0) {
    return {
      sections: empty,
      activeSection: null,
      headersDetected: false,
      prelude: content,
    };
  }

  // Preserve any text before the first header (rare but possible mid-stream).
  const prelude = content.slice(0, matches[0].start).trim();

  // For each header, body runs until the next header (or end of string).
  for (let i = 0; i < matches.length; i += 1) {
    const current = matches[i];
    const bodyStart = current.end;
    const bodyEnd = i + 1 < matches.length ? matches[i + 1].start : content.length;
    // Strip the leading newline that typically follows the colon, and trim
    // trailing whitespace so section boxes look tidy mid-stream.
    const body = content.slice(bodyStart, bodyEnd).replace(/^\r?\n/, "").trimEnd();
    // If the same header appears twice (model error), the later occurrence wins.
    empty[current.name] = body;
  }

  return {
    sections: empty,
    activeSection: matches[matches.length - 1].name,
    headersDetected: true,
    prelude,
  };
}

/**
 * Format an elapsed-time value in milliseconds as a compact human-readable
 * label. Sub-second values drop the decimal; anything >= 1 second keeps two
 * decimal places for consistency with the Conclusion Generator.
 */
function formatElapsed(ms: number): string {
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

/**
 * Structured Report streaming output.
 *
 * Renders six section boxes in the fixed RCC_SECTION_ORDER. As the stream
 * arrives, header-delimited content is routed into its matching box; empty
 * sections display a muted placeholder. Once streaming finishes the user can
 * copy the complete report or retry on error.
 */
export function StructuredReportOutput({
  content,
  isStreaming,
  elapsedMs,
  onRetry,
  error,
}: StructuredReportOutputProps) {
  const [copied, setCopied] = React.useState(false);

  const parsed = React.useMemo(() => parseSections(content), [content]);

  const handleCopy = async () => {
    if (!content) return;
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for non-secure contexts (e.g., http:// dev hosts)
      const textarea = document.createElement("textarea");
      textarea.value = content;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    }
  };

  const hasAnyContent = Boolean(content);
  const showEmptyState = !hasAnyContent && !isStreaming && !error;

  return (
    <div className="flex flex-col gap-3">
      {/* Toolbar: elapsed time, copy, retry */}
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-foreground">
          Structured Report
        </label>
        <div className="flex items-center gap-2">
          {typeof elapsedMs === "number" && elapsedMs > 0 && (
            <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary ring-1 ring-primary/20">
              {formatElapsed(elapsedMs)}
            </span>
          )}
          {hasAnyContent && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              aria-label="Copy full report"
              className={cn(
                "h-8 gap-1.5 px-2.5 text-xs transition-colors",
                copied
                  ? "text-green-600 dark:text-green-400"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  <span>Copy</span>
                </>
              )}
            </Button>
          )}
          {error && onRetry && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRetry}
              aria-label="Retry report generation"
              className="h-8 gap-1.5 px-2.5 text-xs"
            >
              <RotateCw className="h-3.5 w-3.5" />
              <span>Retry</span>
            </Button>
          )}
        </div>
      </div>

      {/* Error banner (preserves any partial output below) */}
      {error && (
        <div
          role="alert"
          className="rounded-md bg-destructive/10 p-3 ring-1 ring-destructive/20"
        >
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* Empty-state placeholder (pre-generation) */}
      {showEmptyState && (
        <div className="flex min-h-[300px] flex-col items-center justify-center gap-3 rounded-lg border border-border/70 bg-card p-6 text-muted-foreground shadow-inner">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
            <FileText className="h-5 w-5" />
          </div>
          <p className="text-sm">
            Generated structured report will appear here.
          </p>
        </div>
      )}

      {/* Streaming prelude (content before any header arrives) */}
      {!parsed.headersDetected && isStreaming && parsed.prelude && (
        <div className="rounded-md border border-border/70 bg-card p-4 text-sm text-muted-foreground shadow-inner">
          <div className="mb-1 flex items-center gap-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
            <span className="text-xs">Preparing sections...</span>
          </div>
          <pre className="whitespace-pre-wrap font-[Georgia,_'Times_New_Roman',_serif] text-sm leading-relaxed text-card-foreground">
            {parsed.prelude}
          </pre>
        </div>
      )}

      {/* Section boxes (always rendered in canonical order) */}
      {(hasAnyContent || isStreaming) && (
        <div className="space-y-3">
          {RCC_SECTION_ORDER.map((section) => {
            const body = parsed.sections[section];
            const isActive =
              isStreaming && parsed.activeSection === section;
            const isEmpty = body.length === 0;
            const headerId = `section-${section
              .toLowerCase()
              .replace(/\s+/g, "-")}`;

            return (
              <section
                key={section}
                aria-labelledby={headerId}
                className={cn(
                  "rounded-lg border bg-card p-4 shadow-inner transition-colors",
                  isActive
                    ? "border-primary/40 ring-1 ring-primary/20"
                    : "border-border/70"
                )}
              >
                <div className="mb-2 flex items-baseline justify-between gap-2">
                  <h3
                    id={headerId}
                    className="text-xs font-semibold uppercase tracking-wider text-foreground"
                  >
                    {section}
                    <span className="ml-2 text-[11px] font-normal normal-case tracking-normal text-muted-foreground">
                      {SECTION_LABELS_KO[section]}
                    </span>
                  </h3>
                  {isActive && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-primary">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      writing
                    </span>
                  )}
                </div>
                {isEmpty ? (
                  <p className="text-xs italic text-muted-foreground">
                    아직 생성되지 않음
                  </p>
                ) : (
                  <pre className="whitespace-pre-wrap font-[Georgia,_'Times_New_Roman',_serif] text-sm leading-relaxed tracking-wide text-card-foreground">
                    {body}
                    {isActive && (
                      <span
                        aria-hidden="true"
                        className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-primary/60 align-text-bottom"
                      />
                    )}
                  </pre>
                )}
              </section>
            );
          })}
        </div>
      )}

      {/* Global streaming hint below the section stack */}
      {isStreaming && hasAnyContent && (
        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
          <span>Streaming...</span>
        </div>
      )}
    </div>
  );
}
